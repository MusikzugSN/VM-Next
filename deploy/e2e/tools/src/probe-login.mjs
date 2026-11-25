// Rauchtest der Anmeldung (nur mit ./run.sh up --realm-import): VM-Web → Keycloak → zurück nach Mein Bereich.
// Legt dabei das erste Konto an; danach den Stack mit ./run.sh up neu starten.
//   node src/probe-login.mjs [mcp-url] [benutzer] [passwort]
const [url = 'http://browser:8931/mcp', username = 'admin', password = 'Admin-e2e-1'] = process.argv.slice(2);
/** Value as a JS literal for code sent to `browser_evaluate`; also escapes `<`, `>`, `/` and U+2028/9 (CodeQL js/bad-code-sanitization). */
const jsLiteral = (value) => JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
let session;
let id = 0;
async function rpc(method, params, notify = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) },
    body: JSON.stringify(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params }),
  });
  session ??= res.headers.get('mcp-session-id');
  if (notify) return null;
  const text = await res.text();
  const data = text.includes('data:') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).pop() : text;
  return JSON.parse(data).result;
}
const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).content.map((c) => c.text ?? '').join('\n');
const where = (t) => `${(t.match(/Page URL: .*/) ?? [''])[0]}  ${(t.match(/Page Title: .*/) ?? [''])[0]}`;

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vm-e2e-probe', version: '1' } });
await rpc('notifications/initialized', {}, true);
console.log('Start:', where(await call('browser_navigate', { url: 'https://vm.test' })));
console.log('Keycloak:', where(await call('browser_navigate', { url: 'https://vm.test/internal/v1/auth/login?returnTo=%2Fme' })));
await call('browser_evaluate', {
  function: `() => { document.querySelector('#username').value = ${jsLiteral(username)}; document.querySelector('#password').value = ${jsLiteral(password)}; document.querySelector('form').submit(); return 'ok'; }`,
});
await new Promise((r) => setTimeout(r, 6000));
const snap = await call('browser_snapshot');
console.log('Nach Login:', where(snap));
console.log(snap.split('\n').filter((l) => /heading|dialog|Stimme|Alex/.test(l)).slice(0, 15).join('\n'));
console.log(await call('browser_console_messages'));
