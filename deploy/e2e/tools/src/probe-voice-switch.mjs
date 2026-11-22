// Prüft die Korrekturen aus Lauf 1 im laufenden System über den Browser von Musiker B:
// fremde Stimme in der Kopfzeile (M-2), „Aushilfe“ nur bei fremder Stimme, keine ResizeObserver-Fehler.
//   node src/probe-voice-switch.mjs [mcp-url]
const url = process.argv[2] ?? 'http://browser:8934/mcp';
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Klickt das erste sichtbare Element mit genau diesem Text (Button, Menüeintrag). */
const clickText = (text) =>
  call('browser_evaluate', {
    function: `() => { const el = [...document.querySelectorAll('button, a, [role=menuitem], [role=menuitemradio]')].find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)}) && e.offsetParent !== null); if (!el) return 'nicht gefunden: ' + ${JSON.stringify(text)}; el.click(); return 'geklickt: ' + ${JSON.stringify(text)}; }`,
  });
const header = () =>
  call('browser_evaluate', {
    function: `() => { const b = document.querySelector('button[aria-label^="Aktive Stimme"]'); return b ? b.getAttribute('aria-label') + ' | Text: ' + b.textContent.replace(/\\s+/g, ' ').trim() : 'kein Stimmen-Button'; }`,
  });
const result = (t) => (t.match(/### Result\n([\s\S]*?)\n###/) ?? [null, t])[1].trim();

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vm-e2e-probe', version: '1' } });
await rpc('notifications/initialized', {}, true);

await call('browser_navigate', { url: 'https://vm.test/me' });
await wait(2000);
// Neues Browserprofil: über Keycloak als musiker-b anmelden
if ((await call('browser_evaluate', { function: '() => location.host' })).includes('vm.test') && (await call('browser_evaluate', { function: '() => location.pathname' })).includes('/login')) {
  await call('browser_navigate', { url: 'https://vm.test/internal/v1/auth/login?returnTo=%2Fme' });
  await call('browser_evaluate', {
    function: `() => { document.querySelector('#username').value = 'musiker-b'; document.querySelector('#password').value = 'MusikerB-e2e-1'; document.querySelector('form').submit(); return 1; }`,
  });
  await wait(5000);
}
console.log('Start:', result(await header()));
console.log(result(await call('browser_evaluate', { function: '() => location.href' })));

// 1. Eigene Stimme „Horn 1 in F“ wählen: keine Aushilfe
console.log(result(await call('browser_evaluate', { function: `() => { document.querySelector('button[aria-label^="Aktive Stimme"]').click(); return 'Menü offen'; }` })));
await wait(500);
console.log(result(await call('browser_evaluate', { function: `() => [...document.querySelectorAll('[role=menuitemradio], [role=menuitem], [z-dropdown-menu-item]')].map((e) => e.textContent.trim()).join(' | ')` })));
console.log(result(await clickText('Horn 1 in F')));
await wait(1500);
console.log('Eigene Stimme:', result(await header()));

// 2. Fremde Stimme über „Andere Stimme …“
await call('browser_evaluate', { function: `() => { document.querySelector('button[aria-label^="Aktive Stimme"]').click(); return 1; }` });
await wait(500);
console.log(result(await clickText('Andere Stimme')));
await wait(800);
console.log(result(await call('browser_evaluate', { function: `() => document.querySelector('[role=dialog] h2')?.textContent ?? 'kein Dialog'` })));
console.log(result(await clickText('Flügelhorn 1 in B')));
await wait(1500);
console.log('Fremde Stimme:', result(await header()));

// 3. Notenansicht mit PDF-Vorschau, Fenster verkleinern, Konsole prüfen
await clickText('Alle meine Stimmen');
await call('browser_evaluate', { function: `() => { sessionStorage.removeItem('vmweb.voiceOverride'); return 1; }` });
await call('browser_navigate', { url: 'https://vm.test/me/folders' });
await wait(1500);
console.log(result(await clickText('Konzertmappe')));
await wait(1500);
console.log(result(await clickText('Heimatgrüße')));
await wait(3000);
await call('browser_resize', { width: 360, height: 800 });
await wait(1000);
await call('browser_resize', { width: 390, height: 844 });
await wait(1000);
console.log(result(await call('browser_evaluate', { function: '() => location.pathname' })));
console.log(await call('browser_console_messages'));
