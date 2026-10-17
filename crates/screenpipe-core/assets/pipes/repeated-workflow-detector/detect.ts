// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
// Repeated workflow detector for screenpipe.
// Reads input events (window changes, clicks) from GET /search and finds a
// generic pattern: "an item opened in app A is followed, within a few minutes,
// by a NEW record created in app B". No AI, no app-specific rules.
//
// With --handoff it also writes handoff.json / handoff.md: the full problem statement
// (pattern, environment, real examples, open questions, acceptance test) for the AI that
// will build the automation, optionally notifies the desktop app (--notify) and POSTs it to a webhook.
// The app's "Find an automation" button reads handoff.json and sends its own notification.
//
// Usage: bun ./detect.ts [--start ISO] [--end ISO] [--out DIR]
//        [--min-occurrences 3] [--window-minutes 8] [--fixture rows.json]
//        [--handoff] [--webhook URL | env SCREENPIPE_HANDOFF_WEBHOOK] [--notify]

type Row = Record<string, unknown>;
type Ev = { t: number; type: string; app: string; title: string; el: string; role: string; frame: number | null };
type Norm = { site: string; page: string; key: string | null; account?: string };
type Visit = Norm & {
  start: number; end: number; app: string; frames: number[]; clicks: { t: number; el: string }[];
  kind?: "hub" | "item" | "record"; isNew?: boolean;
};

const argv = Bun.argv.slice(2);
const arg = (name: string, dflt?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const now = new Date();
const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
const START = new Date(arg("start", midnight.toISOString())!);
const END = new Date(arg("end", now.toISOString())!);
const OUT = arg("out", "./output")!;
const MIN_OCC = Number(arg("min-occurrences", "3"));
const WINDOW_MS = Number(arg("window-minutes", "8")) * 60_000;
const FIXTURE = arg("fixture");
const BASE = process.env.SCREENPIPE_LOCAL_API_URL || "http://localhost:3030";
const KEY = process.env.SCREENPIPE_LOCAL_API_KEY || "";

if (Number.isNaN(START.getTime()) || Number.isNaN(END.getTime()) || START >= END) {
  console.error("Invalid --start/--end range"); process.exit(2);
}

// ---------- fetch ----------
const FIELDS = ["timestamp", "event_type", "app_name", "window_title", "element_name", "element_role", "frame_id"]
  .map(f => `content.${f}`).join(",");
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let requests = 0;
const warnings: string[] = [];

async function page(from: Date, to: Date, offset: number): Promise<{ rows: Row[]; total: number }> {
  const qs = new URLSearchParams({
    content_type: "input", start_time: from.toISOString(), end_time: to.toISOString(),
    limit: "200", offset: String(offset), fields: FIELDS,
  });
  for (let attempt = 0; ; attempt++) {
    requests++;
    const r = await fetch(`${BASE}/search?${qs}`, {
      headers: KEY ? { Authorization: `Bearer ${KEY}` } : {}, signal: AbortSignal.timeout(45_000),
    }).catch(e => { throw new Error(`recorder unreachable: ${e}`); });
    if ((r.status === 503 || r.status === 429) && attempt < 6) {
      const body = await r.json().catch(() => ({})) as { retry_after_ms?: number };
      await sleep(Math.max(500, body.retry_after_ms ?? 1500)); continue;
    }
    if (r.status === 504) throw Object.assign(new Error("timeout"), { split: true });
    if (!r.ok) throw new Error(`GET /search ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const d = await r.json() as { data?: Row[]; pagination?: { total?: number } };
    return { rows: d.data ?? [], total: d.pagination?.total ?? 0 };
  }
}

async function chunk(from: Date, to: Date): Promise<Row[]> {
  try {
    const out: Row[] = [];
    for (let offset = 0; ; ) {
      const { rows, total } = await page(from, to, offset);
      out.push(...rows); offset += rows.length;
      if (!rows.length || offset >= total) return out;
    }
  } catch (e: any) {
    const span = to.getTime() - from.getTime();
    if (e?.split && span > 5 * 60_000) {
      const mid = new Date(from.getTime() + span / 2);
      return [...await chunk(from, mid), ...await chunk(mid, to)];
    }
    throw e;
  }
}

async function load(): Promise<Row[]> {
  if (FIXTURE) return await Bun.file(FIXTURE).json();
  const rows: Row[] = [];
  for (let t = START.getTime(); t < END.getTime(); t += 30 * 60_000) {
    rows.push(...await chunk(new Date(t), new Date(Math.min(t + 30 * 60_000, END.getTime()))));
  }
  return rows;
}

const field = (r: Row, k: string) => (r[`content.${k}`] ?? (r.content as Row | undefined)?.[k]) as unknown;
function toEv(r: Row): Ev | null {
  const t = Date.parse(String(field(r, "timestamp") ?? ""));
  const title = String(field(r, "window_title") ?? "").trim();
  if (!t || !title) return null;
  const fid = field(r, "frame_id");
  return {
    t, title, type: String(field(r, "event_type") ?? ""), app: String(field(r, "app_name") ?? ""),
    el: String(field(r, "element_name") ?? "").replace(/\s+/g, " ").trim(),
    role: String(field(r, "element_role") ?? ""),
    frame: typeof fid === "number" ? fid : null,
  };
}

// ---------- generic title normalization ----------
const BROWSERS = /^(google chrome|chrome|safari|firefox|mozilla firefox|microsoft edge|edge|arc|brave|opera|vivaldi|chromium)$/i;
const NOISE = /(m[ée]moire|memory)|^\d+([.,]\d+)?\s?(ko|mo|go|kb|mb|gb)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_RE = /\[([A-Z][A-Z0-9]{1,9}-\d+)\]|^([A-Z][A-Z0-9]{1,9}-\d+)\b/;

function normalize(app: string, title: string): Norm {
  let parts = title.split(/\s+[-–|]\s+/).map(s => s.trim()).filter(Boolean);
  const account = parts.find(p => EMAIL.test(p));
  parts = parts.filter(p => !NOISE.test(p) && !EMAIL.test(p));
  while (parts.length > 1 && (BROWSERS.test(parts[parts.length - 1]) || parts[parts.length - 1] === app)) parts.pop();
  const isBrowser = BROWSERS.test(app);
  const site = isBrowser ? (parts.length > 1 ? parts.pop()! : parts[0] ?? app) : app;
  let page = (isBrowser ? parts : parts.filter(p => p !== app)).join(" - ") || site;
  page = page.replace(/\s*\(\d[\d\s]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const m = page.match(KEY_RE);
  return { site, page, key: m ? (m[1] || m[2]) : null, ...(account ? { account } : {}) };
}

// ---------- visits ----------
function buildVisits(evs: Ev[]): Visit[] {
  const visits: Visit[] = [];
  for (const ev of evs) {
    const n = normalize(ev.app, ev.title);
    const last = visits[visits.length - 1];
    if (last && last.site === n.site && last.page === n.page && ev.t - last.end < 10 * 60_000) {
      last.end = ev.t;
    } else {
      visits.push({ ...n, start: ev.t, end: ev.t, app: ev.app, frames: [], clicks: [] });
    }
    const v = visits[visits.length - 1];
    if (ev.frame != null && v.frames.length < 3) v.frames.push(ev.frame);
    // Clicks on containers (page background, landmarks) are not actions.
    if (ev.type === "click" && ev.el && !/^AX(WebArea|Group|ScrollArea|SplitGroup|Window)$/.test(ev.role)) {
      v.clicks.push({ t: ev.t, el: ev.el });
    }
  }
  // Hubs (inbox, board, home) are pages you leave for many different pages of the same app,
  // or the only page of a single-window app. Keyed pages are records; everything else is
  // an item (a specific message, document or form), even when revisited later in the day.
  const stats = new Map<string, { n: number; out: Set<string> }>();
  const sitePages = new Map<string, Set<string>>();
  const lastBySite = new Map<string, Visit>();
  for (const v of visits) {
    const k = `${v.site}|${v.page}`;
    const s = stats.get(k) ?? { n: 0, out: new Set<string>() };
    s.n++; stats.set(k, s);
    sitePages.set(v.site, (sitePages.get(v.site) ?? new Set<string>()).add(v.page));
    const prev = lastBySite.get(v.site);
    if (prev && prev.page !== v.page && v.start - prev.end < 15 * 60_000) {
      stats.get(`${prev.site}|${prev.page}`)!.out.add(v.page);
    }
    lastBySite.set(v.site, v);
  }
  // Relative to each app's busiest page, so a message thread revisited later in the day does
  // not rank with the inbox it was opened from.
  const maxOut = new Map<string, number>();
  for (const [k, s] of stats) {
    const site = k.slice(0, k.indexOf("|"));
    maxOut.set(site, Math.max(maxOut.get(site) ?? 0, s.out.size));
  }
  const isHub = (site: string, s: { n: number; out: Set<string> }) =>
    (s.n >= 3 && s.out.size >= Math.max(3, Math.ceil((maxOut.get(site) ?? 0) / 2))) ||
    (sitePages.get(site)!.size === 1 && s.n >= 3);
  // A record counts as created only when it first appears right after a create/submit click
  // in the same app; opening an existing record for the first time is not a creation.
  const seen = new Set<string>();
  for (const v of visits) {
    const s = stats.get(`${v.site}|${v.page}`)!;
    if (v.key) {
      v.kind = "record";
      const createClick = visits.some(o => o.site === v.site && o.clicks.some(c =>
        c.t <= v.start && v.start - c.t < 120_000 && /^(cr[ée]er|create|submit|save|enregistrer|ajouter|add)\b/i.test(c.el)));
      v.isNew = !seen.has(v.key) && createClick;
      seen.add(v.key);
    } else {
      v.kind = isHub(v.site, s) ? "hub" : "item";
    }
  }
  return visits;
}

// ---------- pattern mining ----------
type Occ = { source: Visit; created: Visit; steps: string[]; returned: boolean; considered: string[] };
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3));
function similarity(a: string, b: string) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
const cleanEl = (s: string) => {
  const half = s.length / 2;  // "Ada Lovelace Ada Lovelace" → "Ada Lovelace"
  const t = Number.isInteger(half) && s.slice(0, half).trim() === s.slice(half).trim() ? s.slice(0, half).trim() : s;
  return t.length > 60 ? t.slice(0, 57) + "…" : t;
};

function mine(visits: Visit[]) {
  const creations = visits.map((v, i) => ({ v, i })).filter(x => x.v.isNew);
  // Pass 1: which source sites precede each creation?
  const counts = new Map<string, number>();
  const prevCreation = new Map<string, number>();
  const windows = creations.map(({ v, i }) => {
    const floor = Math.max(v.start - WINDOW_MS, prevCreation.get(v.site) ?? -Infinity);
    prevCreation.set(v.site, v.start);
    const sites = new Set<string>();
    for (let k = i - 1; k >= 0 && visits[k].start >= floor; k--) {
      if (visits[k].kind === "item" && visits[k].site !== v.site) sites.add(visits[k].site);
    }
    for (const s of sites) counts.set(`${s}→${v.site}`, (counts.get(`${s}→${v.site}`) ?? 0) + 1);
    return { v, i, floor };
  });
  // Pass 2: build occurrences for each source→target pair.
  const patterns = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([pair]) => {
    const [A, B] = pair.split("→");
    const occs: Occ[] = [];
    for (const { v, i, floor } of windows) {
      if (v.site !== B) continue;
      // Source = the item of app A whose title is closest to the created record; otherwise the
      // most recent item of app A in the window.
      let src = -1, best = 0;
      const target = v.page.replace(KEY_RE, "");
      for (let k = i - 1; k >= 0 && visits[k].start >= floor; k--) {
        if (visits[k].kind !== "item" || visits[k].site !== A) continue;
        if (src < 0) src = k;
        const sim = similarity(visits[k].page, target);
        if (sim > best + 0.15) { best = sim; src = k; }
      }
      if (src < 0) continue;
      // first visit of this source item inside the window = start of the occurrence
      let first = src;
      for (let k = src - 1; k >= 0 && visits[k].start >= floor; k--) {
        if (visits[k].site === A && visits[k].page === visits[src].page) first = k;
      }
      const steps: string[] = [];
      for (let k = first; k <= i; k++) if (visits[k].site === B) steps.push(...visits[k].clicks.map(c => cleanEl(c.el)));
      for (let k = i; k < visits.length && visits[k].site === B && visits[k].start - v.start < 180_000; k++) {
        if (k > i) steps.push(...visits[k].clicks.map(c => cleanEl(c.el)));
        else steps.push(...v.clicks.map(c => cleanEl(c.el)));
      }
      const next = visits.slice(i + 1).find(x => x.site !== B);
      // Pages of app A seen in the window, newest first: explains the source choice in result.json.
      const considered: string[] = [];
      for (let k = i - 1; k >= 0 && visits[k].start >= floor && considered.length < 12; k--) {
        if (visits[k].site === A) considered.push(`${new Date(visits[k].start).toISOString().slice(11, 19)} ${visits[k].kind} ${visits[k].page}`);
      }
      occs.push({ considered, source: { ...visits[src], start: visits[first].start }, created: v, steps,
        returned: !!next && next.site === A && next.start - v.end < 180_000 });
    }
    return { A, B, occs };
  }).filter(p => p.occs.length >= 2);
  return patterns;
}

// ---------- report ----------
const fmtT = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtD = (t: number) => new Date(t).toLocaleDateString("fr-FR");
const esc = (s: string) => s.replace(/\|/g, "\\|");

function sessions(ts: number[]) {
  let n = ts.length ? 1 : 0;
  for (let k = 1; k < ts.length; k++) if (ts[k] - ts[k - 1] > 30 * 60_000) n++;
  return n;
}

const rows = await load();
const evs = rows.map(toEv).filter((e): e is Ev => !!e).sort((a, b) => a.t - b.t);
const visits = buildVisits(evs);
const patterns = mine(visits);

const out: string[] = [];
out.push(`# Workflows répétés détectés`, ``,
  `Plage analysée : ${fmtD(START.getTime())} ${fmtT(START.getTime())} → ${fmtD(END.getTime())} ${fmtT(END.getTime())}  `,
  `Source : \`GET /search?content_type=input\` (${evs.length} événements, ${visits.length} passages dans des fenêtres, ${FIXTURE ? "fixture" : requests + " requêtes"}).  `,
  `Règle : un élément ouvert dans une app A, suivi en moins de ${WINDOW_MS / 60_000} min de la création d'un **nouvel** enregistrement dans une app B. ` +
  `Retenu à partir de ${MIN_OCC} occasions séparées ou de 2 jours différents. Aucune IA, aucune règle propre à une application.`, ``);

const qualified = patterns.filter(p => p.occs.length >= MIN_OCC || new Set(p.occs.map(o => fmtD(o.created.start))).size >= 2);
if (!qualified.length) out.push(`**Aucune séquence ne dépasse le seuil.**`, ``);

for (const p of patterns) {
  const n = p.occs.length;
  const days = new Set(p.occs.map(o => fmtD(o.created.start))).size;
  const ok = qualified.includes(p);
  const freq = new Map<string, number>();
  for (const o of p.occs) for (const s of new Set(o.steps)) freq.set(s, (freq.get(s) ?? 0) + 1);
  const common = [...freq.entries()].filter(([, c]) => c >= Math.ceil(n / 2)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const gaps = p.occs.map(o => (o.created.start - o.source.start) / 60_000).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const returned = p.occs.filter(o => o.returned).length;
  out.push(`## ${ok ? "✅" : "·"} ${p.A} → nouvel enregistrement dans ${p.B} — ${n} occurrence${n > 1 ? "s" : ""}`, ``,
    `- **Déclencheur :** ouverture d'un élément dans ${p.A} (${n} éléments différents).`,
    `- **Résultat :** ${n} enregistrement${n > 1 ? "s" : ""} créé${n > 1 ? "s" : ""} dans ${p.B} : ${p.occs.map(o => o.created.key).join(", ")}.`,
    `- **Répétition :** ${n} occasions, ${sessions(p.occs.map(o => o.created.start))} session(s), ${days} jour(s)${ok ? " — seuil atteint." : " — sous le seuil."}`,
    `- **Écart médian élément → création :** ${median.toFixed(1)} min (horodatage des événements, pas du temps actif mesuré).`,
    `- **Retour dans ${p.A} juste après la création :** ${returned}/${n}.`);
  if (common.length) out.push(`- **Actions fréquentes dans ${p.B}** (au moins une occurrence sur deux) : ${common.map(([s, c]) => `« ${s} » (${c}/${n})`).join(", ")}.`);
  out.push(``, `| # | Début | Création | Élément source (${esc(p.A)}) | Enregistrement créé (${esc(p.B)}) | Titres proches | Captures |`,
    `|---|---|---|---|---|---|---|`);
  p.occs.forEach((o, k) => {
    const sim = similarity(o.source.page, o.created.page.replace(KEY_RE, ""));
    out.push(`| ${k + 1} | ${fmtT(o.source.start)} | ${fmtT(o.created.start)} | ${esc(o.source.page)} | **${o.created.key}** ${esc(o.created.page.replace(KEY_RE, "").trim())} | ${Math.round(sim * 100)} % | ${[...o.source.frames.slice(0, 1), ...o.created.frames.slice(0, 1)].join(", ")} |`);
  });
  out.push(``);
}

await Bun.write(`${OUT}/result.md`, out.join("\n"));
await Bun.write(`${OUT}/result.json`, JSON.stringify({
  range: { start: START.toISOString(), end: END.toISOString() }, events: evs.length, visits: visits.length,
  minOccurrences: MIN_OCC, windowMinutes: WINDOW_MS / 60_000,
  patterns: patterns.map(p => ({
    source: p.A, target: p.B, qualified: qualified.includes(p),
    occurrences: p.occs.map(o => ({
      sourceTitle: o.source.page, sourceStart: new Date(o.source.start).toISOString(),
      created: o.created.key, createdTitle: o.created.page, createdAt: new Date(o.created.start).toISOString(),
      frames: [...o.source.frames, ...o.created.frames], steps: o.steps, returnedToSource: o.returned, considered: o.considered,
    })),
  })),
}, null, 2));
if (argv.includes("--debug")) {
  await Bun.write(`${OUT}/visits.json`, JSON.stringify(visits.map(v => ({
    at: new Date(v.start).toISOString(), site: v.site, page: v.page, kind: v.kind, isNew: v.isNew ?? false,
  })), null, 1));
}
console.log(`${qualified.length} pattern(s) above threshold, ${patterns.length} candidate(s). Report: ${OUT}/result.md`);

// ---------- handoff to the automation builder ----------
if (argv.includes("--handoff")) await handoff();

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    requests++;
    const r = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      headers: KEY ? { Authorization: `Bearer ${KEY}` } : {}, signal: AbortSignal.timeout(45_000),
    });
    if ((r.status === 503 || r.status === 429) && attempt < 6) {
      const body = await r.json().catch(() => ({})) as { retry_after_ms?: number };
      await sleep(Math.max(500, body.retry_after_ms ?? 1500)); continue;
    }
    if (!r.ok) throw new Error(`GET ${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
}

type Shot = { frame: number; at: string; text: string; url: string | null };
// Screen text of one window: only frames whose title contains `mustContain` exactly, accessibility
// text preferred over OCR, trimmed to start at the first line that mentions `anchor`.
async function shot(app: string, mustContain: string, anchor: string, before: number,
  from: number, to: number, pick: "latest" | "longest"): Promise<Shot | null> {
  if (FIXTURE) return null;
  // The API's window_name filter is fuzzy, so fetch every frame of the app in this short
  // range and match the window title exactly here.
  const all: Row[] = [];
  for (let offset = 0; offset < 300; offset += 20) {
    let d: any = null;
    for (let attempt = 0; attempt < 3 && !d; attempt++) {
      d = await apiGet("/search", {
        content_type: "ocr", app_name: app, limit: "20", offset: String(offset),
        start_time: new Date(from).toISOString(), end_time: new Date(to).toISOString(),
        fields: "content.frame_id,content.timestamp,content.text,content.browser_url,content.window_name,content.text_source",
      }).catch(e => { warnings.push(`screen text ${mustContain} @${new Date(from).toISOString()} offset ${offset}: ${e}`); return null; });
      if (!d) await sleep(2_000);
    }
    const page = (d?.data ?? []) as Row[];
    all.push(...page);
    if (page.length < 20) break;
  }
  const rows = all.filter(r => String(field(r, "window_name") ?? "").includes(mustContain) && field(r, "text"));
  if (!rows.length) warnings.push(`no frame titled "${mustContain}" between ${new Date(from).toISOString()} and ${new Date(to).toISOString()} (${all.length} frames of ${app} scanned)`);
  const a11y = rows.filter(r => /access/i.test(String(field(r, "text_source") ?? "")));
  const pool = (a11y.length ? a11y : rows).map(r => {
    const lines = String(field(r, "text")).split("\n").map(l => l.trim()).filter(Boolean);
    const i = lines.findIndex(l => l.includes(anchor));
    return {
      frame: Number(field(r, "frame_id")), at: String(field(r, "timestamp") ?? ""),
      text: (i >= 0 ? lines.slice(Math.max(0, i - before)) : lines).join("\n"),
      url: (field(r, "browser_url") as string | null) ?? null, anchored: i >= 0,
    };
  });
  const anchored = pool.filter(s => s.anchored);
  const cands = anchored.length ? anchored : pool;
  if (!cands.length) return null;
  const best = pick === "latest" ? cands[0] : cands.reduce((x, y) => (y.text.length > x.text.length ? y : x));
  return { frame: best.frame, at: best.at, text: best.text, url: best.url };
}

// Remove app chrome generically: a line present in every screenshot of the same app is
// chrome, unless it labels a line that varies (e.g. "Priorité" above "Medium").
function stripChrome(shots: (Shot | null)[]): string[] {
  const lines = shots.map(s => (s?.text ?? "").split("\n").map(l => l.trim()).filter(Boolean)
    .filter((l, i, a) => l !== a[i - 1] && !NOISE.test(l)));
  const present = lines.filter(l => l.length).length;
  const count = new Map<string, number>();
  for (const ls of lines) for (const l of new Set(ls)) count.set(l, (count.get(l) ?? 0) + 1);
  const common = (l?: string) => l !== undefined && present >= 3 && count.get(l) === present;
  return lines.map(ls => {
    const kept = ls.filter((l, i) => !(common(l) && (l.length > 60 || common(ls[i + 1]) || i + 1 >= ls.length)));
    const text = (kept.length ? kept : ls).join("\n");
    return text.length > 4000 ? text.slice(0, 4000) + "\n…" : text;
  });
}

async function handoff() {
  const p = [...qualified].sort((a, b) => b.occs.length - a.occs.length)[0];
  const notify = async (title: string, body: string) => {
    if (FIXTURE || !argv.includes("--notify")) return "skipped";
    // The desktop app passes its notification port to pipes (dev builds use another one).
    const url = process.env.SCREENPIPE_NOTIFY_URL || `http://localhost:${process.env.SCREENPIPE_FOCUS_PORT || "11435"}/notify`;
    return fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, pipe_name: "repeated-workflow-detector", priority: "high" }),
      signal: AbortSignal.timeout(10_000),
    }).then(r => (r.ok ? "sent" : `failed ${r.status}`)).catch(e => `failed ${e}`);
  };
  if (!p) {
    console.log(`notification: ${await notify("Aucune automatisation détectée", "Aucune séquence répétée ne dépasse le seuil aujourd'hui.")}`);
    return;
  }

  // Starred sessions are the user's own "this is my work" marks: prefer them as examples.
  const starred: [number, number][] = FIXTURE ? [] : ((await apiGet("/starred-sessions", {
    start_time: START.toISOString(), end_time: END.toISOString(), limit: "100",
  }).catch(() => ({ data: [] }))).data ?? []).map((s: { start: string; end: string }) => [Date.parse(s.start), Date.parse(s.end)]);
  const isStarred = (o: Occ) => starred.some(([a, b]) => o.created.start >= a && o.created.start <= b);
  const starredOccs = p.occs.filter(isStarred);
  const examples = starredOccs.length >= MIN_OCC ? starredOccs : p.occs;

  // The record's final state: its last frame before the user left it.
  // Only the first visit right after creation: later visits to the same page may show the
  // next record's creation form on top of it.
  const recordEnd = (o: Occ) => Math.min(o.created.end, o.created.start + 180_000) + 2_000;
  const srcShots: (Shot | null)[] = [], dstShots: (Shot | null)[] = [];
  for (const o of examples) {
    srcShots.push(await shot(o.source.app, o.source.page, o.source.page, 0, o.source.start - 5_000, o.created.start, "longest"));
    dstShots.push(await shot(o.created.app, `[${o.created.key}]`, o.created.key!, 2, o.created.start, recordEnd(o), "latest"));
  }
  const srcText = stripChrome(srcShots), dstText = stripChrome(dstShots);

  const origin = (u?: string | null) => { try { return u ? new URL(u).origin : null; } catch { return null; } };
  const mostCommon = <T,>(xs: (T | null | undefined)[]) => {
    const c = new Map<T, number>(); for (const x of xs) if (x != null) c.set(x, (c.get(x) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const account = mostCommon(p.occs.map(o => o.source.account));
  const prefix = mostCommon(p.occs.map(o => o.created.key?.replace(/-\d+$/, "")));
  const dstUrl = mostCommon(dstShots.map(s => s?.url ?? null));
  const recordUrl = dstUrl && prefix ? dstUrl.replace(new RegExp(`${prefix}-\\d+`), "{KEY}") : null;

  // Ordered steps: actions present in at least half of the occurrences, by typical position.
  const pos = new Map<string, number[]>();
  for (const o of p.occs) [...new Set(o.steps)].forEach((s, i, a) => { const l = pos.get(s) ?? []; l.push(i / Math.max(1, a.length - 1)); pos.set(s, l); });
  const steps = [...pos.entries()].filter(([, l]) => l.length >= Math.ceil(p.occs.length / 2))
    .map(([s, l]) => ({ action: s, seenIn: l.length, position: l.reduce((a, b) => a + b, 0) / l.length }))
    .sort((a, b) => a.position - b.position);
  const gaps = p.occs.map(o => (o.created.start - o.source.start) / 60_000).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  const days = new Set(p.occs.map(o => fmtD(o.created.start))).size;

  const doc = {
    schema: "screenpipe.automation-handoff/v1",
    generatedAt: new Date().toISOString(),
    detector: {
      pipe: "repeated-workflow-detector", method: "deterministic", source: "GET /search (content_type=input, ocr), GET /starred-sessions",
      range: { start: START.toISOString(), end: END.toISOString() }, events: evs.length,
      rule: `item opened in ${p.A}, then a new ${p.B} record within ${WINDOW_MS / 60_000} min; kept at >= ${MIN_OCC} separate occasions or >= 2 days`,
    },
    problem: `À chaque demande reçue dans ${p.A}${account ? ` (${account})` : ""}, l'utilisateur crée à la main un enregistrement ` +
      `dans ${p.B}${prefix ? ` (projet ${prefix})` : ""} en recopiant le contenu de la demande, puis complète ses champs. ` +
      `Observé ${p.occs.length} fois (${days} jour(s)), environ ${median.toFixed(1)} min entre l'ouverture et la création. ` +
      `Objectif : automatiser la création de l'enregistrement à partir du message, de façon déterministe.`,
    trigger: { app: p.A, event: `nouvel élément reçu dans ${p.A}`, account, url: origin(mostCommon(srcShots.map(s => s?.url ?? null))) },
    target: { app: p.B, action: "créer un enregistrement", keyPrefix: prefix, baseUrl: origin(dstUrl), recordUrl },
    evidence: {
      occurrences: p.occs.length, starredOccurrences: starredOccs.length, sessions: sessions(p.occs.map(o => o.created.start)), days,
      medianMinutesToCreate: Number(median.toFixed(1)), returnedToSource: `${p.occs.filter(o => o.returned).length}/${p.occs.length}`,
      createdKeys: p.occs.map(o => o.created.key),
    },
    observedSteps: [
      `Ouvrir l'élément reçu dans ${p.A} et le lire`,
      ...steps.map(s => `${p.B} : « ${s.action} » (${s.seenIn}/${p.occs.length})`),
      `Revenir dans ${p.A} (${p.occs.filter(o => o.returned).length}/${p.occs.length})`,
    ],
    examples: examples.map((o, k) => ({
      starred: isStarred(o),
      input: { app: p.A, title: o.source.page, openedAt: new Date(o.source.start).toISOString(), frameId: srcShots[k]?.frame ?? o.source.frames[0] ?? null, url: srcShots[k]?.url ?? null, text: srcText[k] },
      output: { app: p.B, key: o.created.key, title: o.created.page.replace(KEY_RE, "").trim(), createdAt: new Date(o.created.start).toISOString(), frameId: dstShots[k]?.frame ?? o.created.frames[0] ?? null, url: dstShots[k]?.url ?? null, text: dstText[k] },
    })),
    openQuestions: [
      `Comment déduire chaque champ de ${p.B} (type, résumé, description, priorité, étiquettes, composants, personne assignée, dates) à partir du message ? Les exemples montrent les valeurs choisies à la main.`,
      `Que faire quand le message est incomplet ? Vérifier dans les exemples s'il y a eu un échange avec le demandeur avant la création.`,
      `Faut-il une validation humaine avant la création, ou créer directement ?`,
      `Faut-il répondre à l'expéditeur avec la clé de l'enregistrement et classer le message ?`,
      `Identifiants à fournir par l'utilisateur pour ${p.A} et ${p.B} (jamais inclus dans ce dossier).`,
    ],
    acceptanceTest: `Envoyer un message de test ${account ? `à ${account}` : `dans ${p.A}`} : un nouvel enregistrement ${prefix ?? ""} est créé dans ${p.B}, ` +
      `son résumé et sa description reprennent le message, et il est retrouvable à l'adresse ${recordUrl ?? "du site cible"}.`,
    privacy: "Les exemples contiennent du texte capturé à l'écran (les adresses e-mail y sont masquées par screenpipe). Aucun identifiant ni jeton n'est inclus.",
  };

  // Keep the human-readable dossier short: Pipe agents relay it, and full texts live in handoff.json.
  const excerpt = (t?: string) => {
    const text = (t || "(texte non capturé)").replace(/\n{2,}/g, "\n");
    return text.length > 300 ? text.slice(0, 300) + "…" : text;
  };
  const md: string[] = [
    `# Dossier d'automatisation : ${p.A} → ${p.B}`, ``,
    `> Généré par le pipe screenpipe « repeated-workflow-detector », sans IA, le ${fmtD(Date.now())} à ${fmtT(Date.now())}.`, ``,
    `## Problématique`, ``, doc.problem, ``,
    `## Déclencheur`, ``, `- App : ${p.A}${account ? `, boîte ${account}` : ""}${doc.trigger.url ? ` (${doc.trigger.url})` : ""}`, `- Événement : ${doc.trigger.event}`, ``,
    `## Cible`, ``, `- App : ${p.B}${doc.target.baseUrl ? ` (${doc.target.baseUrl})` : ""}`, `- Action : créer un enregistrement${prefix ? ` dans le projet ${prefix}` : ""}`, ...(recordUrl ? [`- Adresse d'un enregistrement : ${recordUrl}`] : []), ``,
    `## Ce que l'utilisateur fait aujourd'hui`, ``, ...doc.observedSteps.map((s, i) => `${i + 1}. ${s}`), ``,
    `## Preuves`, ``, `- ${p.occs.length} occurrences (${starredOccs.length} dans des sessions étoilées), ${doc.evidence.sessions} session(s), ${days} jour(s)`,
    `- Enregistrements créés : ${doc.evidence.createdKeys.join(", ")}`, `- Écart médian ouverture → création : ${doc.evidence.medianMinutesToCreate} min`, ``,
    `## Exemples réels (${examples.length})`, ``, `Extraits courts ; le texte complet de chaque exemple est dans \`handoff.json\`.`, ``,
    ...doc.examples.flatMap((e, k) => [
      `### Exemple ${k + 1} : « ${e.input.title} » → ${e.output.key}`, ``,
      `Entrée (${p.A}, capture ${e.input.frameId}) :`, "```", excerpt(e.input.text), "```", ``,
      `Sortie (${p.B}, capture ${e.output.frameId}) :`, "```", excerpt(e.output.text), "```", ``,
    ]),
    `## Questions à trancher pour construire l'automatisation`, ``, ...doc.openQuestions.map(q => `- ${q}`), ``,
    `## Test d'acceptation`, ``, doc.acceptanceTest, ``,
    `## Confidentialité`, ``, doc.privacy, ``,
  ];

  await Bun.write(`${OUT}/warnings.log`, warnings.join("\n") + (warnings.length ? "\n" : ""));
  await Bun.write(`${OUT}/handoff.json`, JSON.stringify(doc, null, 2));
  await Bun.write(`${OUT}/handoff.md`, md.join("\n"));

  // Destination for the builder AI: --webhook, then $SCREENPIPE_HANDOFF_WEBHOOK, then config.json.
  const cfg = await Bun.file(new URL("./config.json", import.meta.url)).json().catch(() => ({})) as { webhook?: string };
  const webhook = arg("webhook", process.env.SCREENPIPE_HANDOFF_WEBHOOK || cfg.webhook || undefined);
  const sent = webhook && !FIXTURE ? await fetch(webhook, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc), signal: AbortSignal.timeout(20_000),
  }).then(r => `webhook ${r.status}`).catch(e => `webhook failed: ${e}`) : "webhook not configured";
  const notified = await notify(`Automatisation détectée : ${p.A} → ${p.B}`,
    `${p.occs.length} occurrences (${doc.evidence.createdKeys.join(", ")}). Dossier prêt pour l'IA qui construira l'automatisation.`);
  console.log(`handoff: ${OUT}/handoff.md, ${OUT}/handoff.json · ${sent} · notification ${notified}`);
}
