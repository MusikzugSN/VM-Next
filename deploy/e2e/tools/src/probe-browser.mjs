// Rauchtest des Browser-Containers über einen Persona-MCP-Server: TLS mit Test-CA, Kiosk-Druck nach
// CUPS-PDF und Downloads. Ändert keine Daten in VM-Web.
//   node src/probe-browser.mjs [mcp-url]     Standard: http://browser:8931/mcp
const url = process.argv[2] ?? 'http://browser:8931/mcp';
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
  const msg = JSON.parse(data);
  if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
  return msg.result;
}
const call = async (name, args = {}) => (await rpc('tools/call', { name, arguments: args })).content.map((c) => c.text ?? `[${c.type}]`).join('\n');

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vm-e2e-probe', version: '1' } });
await rpc('notifications/initialized', {}, true);

console.log('--- navigate https://vm.test');
console.log((await call('browser_navigate', { url: 'https://vm.test' })).slice(0, 1200));

console.log('--- window.print()');
console.log(await call('browser_evaluate', { function: '() => { window.print(); return "print aufgerufen"; }' }));

console.log('--- Download');
console.log(
  await call('browser_evaluate', {
    function: `() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['probe'], { type: 'text/plain' })); a.download = 'probe-download.txt'; document.body.append(a); a.click(); return 'Download angestoßen'; }`,
  }),
);
await new Promise((r) => setTimeout(r, 3000));
console.log(await call('browser_snapshot'));
console.log('--- Konsole');
console.log(await call('browser_console_messages'));
