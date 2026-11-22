// Gegenprobe (M-2): eine eigene Profilstimme allein ausgewählt → kein „Aushilfe“.
const url = process.argv[2] ?? 'http://browser:8934/mcp';
let session, id = 0;
async function rpc(method, params, notify = false) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(session ? { 'Mcp-Session-Id': session } : {}) }, body: JSON.stringify(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params }) });
  session ??= res.headers.get('mcp-session-id');
  if (notify) return null;
  const text = await res.text();
  const data = text.includes('data:') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5)).pop() : text;
  return JSON.parse(data).result;
}
const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).content.map((c) => c.text ?? '').join('\n');
const result = (t) => (t.match(/### Result\n([\s\S]*?)\n###/) ?? [null, t])[1].trim();
await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'p', version: '1' } });
await rpc('notifications/initialized', {}, true);
await call('browser_navigate', { url: 'https://vm.test/me' });
console.log(result(await call('browser_evaluate', { function: `async () => {
  const r = await fetch('/internal/v1/me/voice-context'); const ctx = await r.json();
  const horn = ctx.profileVoices.find((v) => v.name === 'Horn 1 in F');
  sessionStorage.setItem('vmweb.voiceOverride', JSON.stringify([horn.id]));
  return 'Override gesetzt: ' + horn.name + ' (Profil: ' + ctx.profileVoices.map((v) => v.name).join(', ') + ')';
}` })));
await call('browser_navigate', { url: 'https://vm.test/me' });
await new Promise((r) => setTimeout(r, 2000));
console.log(result(await call('browser_evaluate', { function: `() => { const b = document.querySelector('button[aria-label^="Aktive Stimme"]'); return b.getAttribute('aria-label') + ' | Text: ' + b.textContent.replace(/\s+/g, ' ').trim(); }` })));
await call('browser_evaluate', { function: `() => { sessionStorage.removeItem('vmweb.voiceOverride'); return 1; }` });
