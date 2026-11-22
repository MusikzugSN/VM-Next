// Deterministisches Orakel des KI-Testlaufs (docs/e2e-acceptance.md). Prüft Datenbank, Keycloak,
// Downloads und CUPS-PDF-Ausgabe gegen fixtures/expected.json und schreibt Befunde nach run/findings/.
//   node src/oracle.mjs <check>      check: infra | phase1 | gate1 | phase2a | phase2 | phase3 | phase4 | phase5 | phase6 | final
// Exit 0 = keine Befunde, 1 = Befunde, 2 = Orakel selbst fehlgeschlagen.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { unzipSync } from 'fflate';
import pg from 'pg';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { readJson } from './lib.mjs';

const E2E = process.env.E2E_DIR ?? '/e2e';
const spec = readJson(join(E2E, 'fixtures/spec.json'));
const expected = readJson(join(E2E, 'fixtures/expected.json'));
const OUT = join(E2E, 'run/out');
const FINDINGS = join(E2E, 'run/findings');
const VM = process.env.VM_URL ?? 'https://vm.test';
const KC = process.env.KEYCLOAK_URL ?? 'https://auth.vm.test';
const EMAIL = (user) => `${user}@vm.test`;

const findings = [];
/** Befund nach E-4; `step` ist die ID aus docs/e2e-acceptance.md. */
function finding(step, description, expectedValue, actual) {
  findings.push({ step, category: 'orakel', description, expected: expectedValue, actual });
}
function check(step, ok, description, expectedValue, actual) {
  if (!ok) finding(step, description, expectedValue, actual);
  return ok;
}

// --- Datenquellen --------------------------------------------------------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0] ?? null;

async function keycloakToken() {
  const body = new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: process.env.KEYCLOAK_ADMIN_USER, password: process.env.KEYCLOAK_ADMIN_PASSWORD });
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, { method: 'POST', body });
  if (!res.ok) throw new Error(`Keycloak-Admin-Login: HTTP ${res.status}`);
  return (await res.json()).access_token;
}
async function kc(path) {
  const res = await fetch(`${KC}/admin/realms${path}`, { headers: { Authorization: `Bearer ${await keycloakToken()}` } });
  return { status: res.status, body: res.ok ? await res.json() : null };
}

async function pdfLabels(bytes) {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  // Jede Fixture-Seite trägt genau ein Textstück „Titel · Stimme · Seite n/m“; Leerseiten keines (null)
  const labels = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const items = (await (await doc.getPage(i)).getTextContent()).items.map((it) => it.str.trim());
    labels.push(items.find((s) => /^.+ · .+ · Seite \d+\/\d+$/.test(s)) ?? null);
  }
  await doc.destroy();
  return labels;
}
const sameLabels = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function files(dir, ext) {
  if (!existsSync(dir)) return [];
  const result = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) result.push(...files(path, ext));
    else if (name.toLowerCase().endsWith(ext)) result.push(path);
  }
  return result;
}

// --- Bausteine -------------------------------------------------------------------------------------------
const user = (name) => one('SELECT * FROM users WHERE lower(email) = $1', [EMAIL(name)]);
const ensemble = () => one('SELECT * FROM ensembles WHERE name = $1 AND archived_at IS NULL', [spec.ensemble]);
async function roleIn(userId, ensembleId) {
  return (await one('SELECT r.default_key FROM memberships m JOIN roles r ON r.id = m.role_id WHERE m.user_id = $1 AND m.ensemble_id = $2', [userId, ensembleId]))?.default_key ?? null;
}
const score = (title) => one('SELECT * FROM scores WHERE lower(title) = lower($1) ORDER BY created_at LIMIT 1', [title]);
async function sheet(title, voice) {
  return one('SELECT s.* FROM sheets s JOIN scores sc ON sc.id = s.score_id JOIN voices v ON v.id = s.voice_id WHERE lower(sc.title) = lower($1) AND v.name = $2', [title, voice]);
}
async function upload(fileName) {
  return one('SELECT * FROM uploads WHERE file_name = $1 ORDER BY created_at DESC LIMIT 1', [fileName]);
}

async function musicianAccount(step, name, voice) {
  const u = await user(name);
  if (!check(step, !!u, `Konto ${name} existiert`, EMAIL(name), null)) return null;
  const ens = await ensemble();
  check(step, !u.is_admin, `${name} ist kein Admin`, false, u.is_admin);
  check(step, (await roleIn(u.id, ens?.id)) === 'musician', `${name} ist Musiker:in im ${spec.ensemble}`, 'musician', await roleIn(u.id, ens?.id));
  if (voice) {
    const voices = (await q('SELECT v.name FROM user_voices uv JOIN voices v ON v.id = uv.voice_id WHERE uv.user_id = $1 ORDER BY uv.position', [u.id])).map((r) => r.name);
    check(step, voices.includes(voice), `${name} hat Profilstimme ${voice}`, voice, voices);
  }
  return u;
}

/** Druckausgaben (CUPS-PDF), je Datei die Seiten-Labels. */
async function printedFiles() {
  return Promise.all(files(join(OUT, 'cups-pdf'), '.pdf').map(async (path) => ({ path, labels: await pdfLabels(readFileSync(path)) })));
}

// --- Checks je Phase ---------------------------------------------------------------------------------------
const checks = {
  async infra() {
    const health = await fetch(`${VM}/health`).catch((e) => ({ status: String(e) }));
    check('E2E-0.1', health.status === 200, 'VM-Web /health über Traefik', 200, health.status);
    const disc = await fetch(`${KC}/realms/master/.well-known/openid-configuration`).catch((e) => ({ status: String(e) }));
    check('E2E-0.1', disc.status === 200, 'Keycloak-Discovery über Traefik', 200, disc.status);
  },

  async phase1() {
    const realm = await kc('/verein');
    check('E2E-1.1', realm.status === 200, 'Realm „verein“ existiert', 200, realm.status);
    const disc = await fetch(`${KC}/realms/verein/.well-known/openid-configuration`);
    check('E2E-1.1', disc.status === 200, 'Discovery des Realms', 200, disc.status);
    const clients = (await kc('/verein/clients?clientId=vm-web')).body ?? [];
    const client = clients[0];
    if (check('E2E-1.1', !!client, 'Client vm-web existiert', 'vm-web', null)) {
      check('E2E-1.1', client.publicClient === true, 'Client ist öffentlich (PKCE, ohne Secret)', true, client.publicClient);
      check('E2E-1.1', client.standardFlowEnabled === true, 'Authorization Code Flow aktiv', true, client.standardFlowEnabled);
      check('E2E-1.1', (client.redirectUris ?? []).some((u) => u === `${VM}/internal/v1/auth/callback` || u === `${VM}/*`), 'Redirect-URI eingetragen', `${VM}/internal/v1/auth/callback`, client.redirectUris);
    }
    for (const name of ['admin', 'notenwart', 'musiker-a', 'musiker-b', 'musiker-c']) {
      const u = ((await kc(`/verein/users?username=${encodeURIComponent(name)}&exact=true`)).body ?? [])[0];
      if (!check('E2E-1.1', !!u, `Keycloak-Benutzer ${name}`, name, null)) continue;
      check('E2E-1.1', u.enabled === true, `${name} aktiviert`, true, u.enabled);
      check('E2E-1.1', (u.requiredActions ?? []).length === 0, `${name} ohne Pflichtaktionen`, [], u.requiredActions);
      check('E2E-1.1', (u.email ?? '').toLowerCase() === EMAIL(name), `${name} hat E-Mail ${EMAIL(name)}`, EMAIL(name), u.email);
    }

    const admin = await user('admin');
    if (check('E2E-1.2', !!admin, 'Admin hat sich angemeldet', EMAIL('admin'), null)) {
      check('E2E-1.2', admin.is_admin === true, 'Admin-Kennzeichen gesetzt', true, admin.is_admin);
      const root = await one('SELECT id FROM ensembles WHERE is_root');
      check('E2E-1.2', (await roleIn(admin.id, root?.id)) === 'admin', 'Rolle admin im Wurzel-Ensemble', 'admin', await roleIn(admin.id, root?.id));
      check('E2E-1.2', !!admin.name?.trim(), 'Name aus Keycloak übernommen', 'nicht leer', admin.name);
    }

    const ens = await ensemble();
    if (check('E2E-1.3', !!ens, `Ensemble ${spec.ensemble}`, spec.ensemble, null)) {
      const template = readJson(join(E2E, 'defaults/lineup.default.json'));
      const want = template.instruments.flatMap((i) => i.voices.filter((v) => v.lineup !== false).map((v) => v.name)).sort();
      const have = (await q('SELECT v.name FROM ensemble_lineup_voices l JOIN voices v ON v.id = l.voice_id WHERE l.ensemble_id = $1', [ens.id])).map((r) => r.name).sort();
      check('E2E-1.3', JSON.stringify(want) === JSON.stringify(have), 'Besetzung = Vorlage Standard-Blasorchester', want.length, have.length);
    }
    await checks.gate1();
  },

  /** Vor jeder weiteren Anmeldung (E2E-1.4). */
  async gate1() {
    const s = await one('SELECT * FROM club_settings WHERE id = 1');
    const ens = await ensemble();
    const musician = await one("SELECT id FROM roles WHERE default_key = 'musician'");
    check('E2E-1.4', !!ens && s?.default_ensemble_id === ens.id, 'Standard-Ensemble = Hauptorchester', ens?.id, s?.default_ensemble_id);
    check('E2E-1.4', s?.default_role_id === musician?.id, 'Standardrolle = Musiker:in', musician?.id, s?.default_role_id);
    check('E2E-1.4', (s?.public_base_url ?? '').replace(/\/$/, '') === VM, 'VM-Web-Adresse für den Druckservice', VM, s?.public_base_url);
    const count = Number((await one('SELECT count(*) AS n FROM users')).n);
    check('E2E-1.4', count === 1, 'Noch niemand außer dem Admin angemeldet', 1, count);
  },

  async phase2a() {
    const u = await user('notenwart');
    if (!check('E2E-2.1', !!u, 'Notenwart:in hat sich angemeldet', EMAIL('notenwart'), null)) return;
    const ens = await ensemble();
    check('E2E-2.1', !u.is_admin, 'Notenwart:in ist kein Admin', false, u.is_admin);
    check('E2E-2.1', (await roleIn(u.id, ens?.id)) === 'musician', 'Zuerst Musiker:in im Hauptorchester (Standardrolle)', 'musician', await roleIn(u.id, ens?.id));
  },

  async phase2() {
    const u = await user('notenwart');
    const ens = await ensemble();
    check('E2E-2.2', !!u && (await roleIn(u.id, ens?.id)) === 'librarian', 'Rolle Notenwart:in im Hauptorchester', 'librarian', u && (await roleIn(u.id, ens?.id)));
  },

  async phase3() {
    const ens = await ensemble();
    const scoreCount = Number((await one('SELECT count(*) AS n FROM scores')).n);
    check('E2E-3.1/3.2/3.4', scoreCount === expected.scores.final, 'Anzahl Stücke nach beiden Importen und dem neuen Stück', expected.scores.final, scoreCount);
    const genre = await one("SELECT * FROM field_definitions WHERE name = 'Genre'");
    if (check('E2E-3.1', !!genre, 'Eigenes Feld „Genre“ angelegt', 'Genre', null)) {
      const options = Number((await one('SELECT count(*) AS n FROM field_options WHERE field_id = $1', [genre.id])).n);
      check('E2E-3.1', options > 0, '„Genre“ hat Auswahloptionen aus der Datei', '> 0', options);
    }
    const folder = await one('SELECT * FROM folders WHERE name = $1 AND ensemble_id = $2', [spec.folder, ens?.id]);
    if (check('E2E-3.1', !!folder, `Mappe ${spec.folder} im Hauptorchester`, spec.folder, null)) {
      check('E2E-3.5', folder.show_in_my_area === true, 'Mappe in Mein Bereich angezeigt', true, folder.show_in_my_area);
      for (const [title, number] of Object.entries(expected.folderNumbers)) {
        const row = await one('SELECT fe.number FROM folder_entries fe JOIN scores s ON s.id = fe.score_id WHERE fe.folder_id = $1 AND lower(s.title) = lower($2)', [folder.id, title]);
        check('E2E-3.1', row?.number === number, `Nummer von „${title}“ in der Mappe`, number, row?.number ?? null);
      }
    }
    for (const s of spec.uploads.sheets) {
      const row = await sheet(s.title, s.voice);
      if (check('E2E-3.3', !!row, `Blatt ${s.title} / ${s.voice}`, `${s.pages} Seiten`, null)) check('E2E-3.3', row.page_count === s.pages, `Seitenzahl ${s.title} / ${s.voice}`, s.pages, row.page_count);
    }
    check('E2E-3.4', !!(await score(spec.collection.newScore)), `Neues Stück „${spec.collection.newScore}“`, spec.collection.newScore, null);
    for (const s of spec.collection.sections) {
      const row = await sheet(s.title, s.voice);
      if (check('E2E-3.4', !!row, `Abschnitt ${s.title} / ${s.voice}`, `${s.pages} Seiten`, null)) check('E2E-3.4', row.page_count === s.pages, `Seitenzahl ${s.title} / ${s.voice}`, s.pages, row.page_count);
    }
    const nw = await user('notenwart');
    const pending = Number((await one("SELECT count(*) AS n FROM uploads WHERE uploaded_by = $1 AND status <> 'approved'", [nw?.id])).n);
    check('E2E-3.3', pending === 0, 'Uploads der Notenwart:in sofort freigegeben', 0, pending);

    const event = await one('SELECT * FROM events WHERE name = $1 AND ensemble_id = $2', [spec.event.name, ens?.id]);
    if (check('E2E-3.5', !!event, `Event ${spec.event.name}`, spec.event.name, null)) {
      check('E2E-3.5', event.show_in_my_area === true, 'Event in Mein Bereich angezeigt', true, event.show_in_my_area);
      check('E2E-3.5', new Date(event.date) > new Date(), 'Event liegt in der Zukunft', '> heute', event.date);
      const setlist = (await q('SELECT s.title FROM setlist_entries e JOIN scores s ON s.id = e.score_id WHERE e.event_id = $1 ORDER BY e.position', [event.id])).map((r) => r.title);
      check('E2E-3.5', JSON.stringify(setlist) === JSON.stringify(spec.event.setlist), 'Setlist in Spielreihenfolge', spec.event.setlist, setlist);
    }

    const printed = await printedFiles();
    const fp = expected.printing.folderPrint;
    // Druckverlauf und Status (D-5) prüft der Agent in der Oberfläche
    check('E2E-3.7', printed.some((p) => sameLabels(p.labels, fp.pages)), 'Mappendruck in der CUPS-PDF-Ausgabe (Reihenfolge, Leerseiten)', `${fp.totalPages} Seiten`, printed.map((p) => `${basename(p.path)}: ${p.labels.length} Seiten`));
  },

  async phase4() {
    const a = await musicianAccount('E2E-4.0', 'musiker-a', spec.voices['musiker-a']);
    const b = await musicianAccount('E2E-4.0', 'musiker-b', spec.voices['musiker-b']);
    const c = await musicianAccount('E2E-4.0', 'musiker-c', spec.voices['musiker-c']);
    void a;

    // A.2 / A.3: ZIPs im Download-Ordner von Musiker A
    const zips = files(join(OUT, 'downloads/musiker-a'), '.zip').map((path) => ({ path, entries: unzipSync(readFileSync(path)) }));
    for (const [step, want] of [['A.2', expected.downloads['musiker-a'].folderZip], ['A.3', expected.downloads['musiker-a'].eventZip]]) {
      const names = want.map((w) => w.name).sort();
      const zip = zips.find((z) => JSON.stringify(Object.keys(z.entries).sort()) === JSON.stringify(names));
      if (!check(`E2E-4.${step}`, !!zip, 'ZIP mit genau diesen Dateien', names, zips.map((z) => Object.keys(z.entries)))) continue;
      for (const w of want) {
        const labels = await pdfLabels(zip.entries[w.name]);
        const wantLabels = Array.from({ length: w.pages }, (_, i) => `${w.title} · ${w.voice} · Seite ${i + 1}/${w.pages}`);
        check(`E2E-4.${step}`, sameLabels(labels, wantLabels), `Inhalt von ${w.name}`, wantLabels.length, labels);
      }
    }

    // B.2 / B.3: Einzel-PDFs von Musiker B
    const bPdfs = await Promise.all(files(join(OUT, 'downloads/musiker-b'), '.pdf').map(async (path) => ({ path, labels: await pdfLabels(readFileSync(path)) })));
    const voiceOf = (p) => p.labels.find(Boolean)?.split(' · ')[1];
    check('E2E-4.B.2', bPdfs.filter((p) => voiceOf(p) === spec.voices['musiker-b']).length >= 2, 'Mindestens zwei Einzel-PDFs in der eigenen Stimme', 2, bPdfs.map(voiceOf));
    check('E2E-4.B.3', bPdfs.some((p) => voiceOf(p) === spec.voices['musiker-b-switch']), 'Download nach Stimmwechsel', spec.voices['musiker-b-switch'], bPdfs.map(voiceOf));
    if (b) {
      const tag = await one('SELECT t.id FROM personal_tags t WHERE t.user_id = $1 AND t.name = $2', [b.id, spec.personalTag.name]);
      if (check('E2E-4.B.4', !!tag, `Persönlicher Tag „${spec.personalTag.name}“`, spec.personalTag.name, null)) {
        const tagged = (await q('SELECT s.title FROM score_personal_tags st JOIN scores s ON s.id = st.score_id WHERE st.personal_tag_id = $1', [tag.id])).map((r) => r.title);
        check('E2E-4.B.4', JSON.stringify(tagged) === JSON.stringify([spec.personalTag.title]), 'Tag hängt genau an einem Stück', [spec.personalTag.title], tagged);
      }
    }

    // C.2 / C.3: Uploads von Musiker C in der Prüfung
    if (c) {
      for (const key of ['good', 'wrong']) {
        const u = await upload(spec.musicianUploads[key].file);
        check('E2E-4.C.2/C.3', u?.status === 'pending' && u?.uploaded_by === c.id, `Upload ${spec.musicianUploads[key].file} wartet auf Prüfung`, 'pending', u?.status ?? null);
      }
    }

    // A.4 / B.5 / C.5: Einzeldrucke über den Browser
    const printed = await printedFiles();
    for (const p of expected.printing.singlePrints) {
      check(`E2E-4 Druck ${p.user}`, printed.some((f) => sameLabels(f.labels, p.pages)), `Einzeldruck ${p.title} / ${p.voice} in der CUPS-PDF-Ausgabe`, p.pages, printed.map((f) => basename(f.path)));
    }
  },

  async phase5() {
    const good = await upload(spec.musicianUploads.good.file);
    check('E2E-5.1', good?.status === 'approved', 'Passender Upload angenommen', 'approved', good?.status ?? null);
    const sheetRow = await sheet(spec.musicianUploads.good.title, spec.musicianUploads.good.voice);
    check('E2E-5.1', !!sheetRow, 'Blatt nach Annahme vorhanden', `${spec.musicianUploads.good.title} / ${spec.musicianUploads.good.voice}`, null);
    const wrong = await upload(spec.musicianUploads.wrong.file);
    check('E2E-5.2', wrong?.status === 'rejected', 'Falscher Upload abgelehnt', 'rejected', wrong?.status ?? null);
    check('E2E-5.2', wrong?.rejection_reason?.trim() === spec.musicianUploads.rejectionReason, 'Ablehnungsgrund', spec.musicianUploads.rejectionReason, wrong?.rejection_reason ?? null);
  },

  async phase6() {
    const retry = await upload(spec.musicianUploads.retry.file);
    check('E2E-6.2/6.3', retry?.status === 'approved', 'Korrigierter Upload angenommen', 'approved', retry?.status ?? null);
    const c = await user('musiker-c');
    const counts = Object.fromEntries((await q('SELECT status, count(*)::int AS n FROM uploads WHERE uploaded_by = $1 GROUP BY status', [c?.id])).map((r) => [r.status, r.n]));
    const want = expected.uploads.musicianFinal;
    check('E2E-6.3', (counts.approved ?? 0) === want.approved && (counts.rejected ?? 0) === want.rejected && (counts.pending ?? 0) === want.pending, 'Uploads von Musiker C am Ende', want, counts);
    for (const key of ['good', 'retry']) {
      const u = spec.musicianUploads[key];
      check('E2E-6.3', !!(await sheet(u.title, u.voice)), `Blatt ${u.title} / ${u.voice}`, 'vorhanden', null);
    }
  },

  async final() {
    const sheetCount = Number((await one('SELECT count(*) AS n FROM sheets')).n);
    check('E2E-7.2', sheetCount === expected.sheets.final, 'Anzahl Blätter am Ende', expected.sheets.final, sheetCount);
    const users = Number((await one('SELECT count(*) AS n FROM users')).n);
    check('E2E-7.2', users === 5, 'Genau fünf Konten', 5, users);
    const admins = Number((await one('SELECT count(*) AS n FROM users WHERE is_admin')).n);
    check('E2E-7.2', admins === 1, 'Genau ein Admin-Kennzeichen', 1, admins);

    // 7.1: keine 5xx im Access-Log von Traefik (run.sh legt es ab)
    const log = join(E2E, 'run/logs/traefik.log');
    if (existsSync(log)) {
      // Statuscode steht direkt hinter der Anfrage („GET /x HTTP/2.0" 503 …); die Bereitschaftsprüfung
      // von run.sh (Keycloak-Discovery des Master-Realms beim Start) zählt nicht
      const errors = readFileSync(log, 'utf8')
        .split('\n')
        .filter((l) => /HTTP\/[\d.]+" 5\d\d /.test(l) && !l.includes('/realms/master/.well-known/openid-configuration'));
      check('E2E-7.1', errors.length === 0, 'Keine Antworten 5xx', 0, errors.slice(0, 10));
    } else finding('E2E-7.1', 'Access-Log von Traefik fehlt', log, null);

    // 7.3: jede Druckausgabe ist erklärt
    const printed = await printedFiles();
    const known = [expected.printing.folderPrint.pages, ...expected.printing.singlePrints.map((p) => p.pages)];
    const unexpected = printed.filter((p) => !known.some((k) => sameLabels(p.labels, k)));
    check('E2E-7.3', unexpected.length === 0, 'Keine unerwarteten Druckausgaben', 0, unexpected.map((p) => basename(p.path)));

    // 7.4: Befunde der Agenten
    const agentFindings = files(FINDINGS, '.json')
      .filter((p) => basename(p).startsWith('agent-'))
      .flatMap((p) => {
        try {
          return (readJson(p).findings ?? []).map((f) => ({ ...f, file: basename(p) }));
        } catch {
          return [{ step: basename(p), description: 'Befunddatei nicht lesbar' }];
        }
      });
    check('E2E-7.4', agentFindings.length === 0, 'Keine Befunde der Agenten', 0, agentFindings.length);
  },
};

// --- Ablauf ------------------------------------------------------------------------------------------------
const name = process.argv[2];
if (!name || !checks[name]) {
  console.log(`Aufruf: oracle.mjs <${Object.keys(checks).join(' | ')}>`);
  process.exit(name === '--help' ? 0 : 2);
}
if (expected.warnings?.length && name !== 'infra') for (const w of expected.warnings) finding('E-5', `expected.json unvollständig: ${w}`, 'keine Warnungen', w);
try {
  await db.connect();
  await checks[name]();
} catch (error) {
  console.error(`Orakel ${name} fehlgeschlagen:`, error);
  process.exit(2);
} finally {
  await db.end().catch(() => undefined);
}
mkdirSync(FINDINGS, { recursive: true });
writeFileSync(join(FINDINGS, `oracle-${name}.json`), `${JSON.stringify({ check: name, at: new Date().toISOString(), findings }, null, 2)}\n`);
for (const f of findings) console.log(`ROT  ${f.step}  ${f.description}  erwartet=${JSON.stringify(f.expected)}  ist=${JSON.stringify(f.actual)}`);
console.log(findings.length ? `oracle ${name}: ${findings.length} Befund(e)` : `oracle ${name}: grün`);
process.exit(findings.length ? 1 : 0);
