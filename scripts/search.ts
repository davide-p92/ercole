// scripts/search.ts
// Ricerca su notes-index.json con:
// - OperatorI:  AND (default), OR, NOT (o prefisso -)
// - Filtri:     --tag t1,t2  --after YYYY-MM-DD  --before YYYY-MM-DD
// - Paging:     --limit N  --offset N
// - Output:     --json  (stampa SOLO JSON; OK per pipeline con jq)

import fs from "node:fs";
import { INDEX_PATH } from "./_paths.ts";

type Note = {
  id: string;
  title: string;
  path: string;
  updated: string;
  content: string;
  tags: string[];
};

// Evita stacktrace quando la pipe a valle (es. jq) chiude lo stream.
process.stdout.on("error", (err: any) => {
  if (err && err.code === "EPIPE") process.exit(0);
  throw err;
});

// -------------------- Arg parsing --------------------
const rawArgs = process.argv.slice(2);

let jsonMode = false;
let limit = 50;
let offset = 0;

const opts = {
  tags: [] as string[],
  after: "",
  before: ""
};

// Query “boolean”: disgiunzione (OR) di clausole; ogni clausola è una congiunzione (AND) di termini.
// Esempi:
//   "foo bar OR baz -qux" => clauses: [ ["foo","bar"], ["baz"] ], negatives: ["qux"]
type Clause = string[];
const clauses: Clause[] = [];
const negatives: string[] = [];

const qParts: string[] = [];
let currentClause: Clause = [];

// tokenizzazione con frasi tra virgolette
const tokens: string[] = [];
{
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  const raw = rawArgs.join(" ");
  while ((m = re.exec(raw)) !== null) {
    tokens.push(m[1] ?? m[2]);
  }
}

// parse dei token
for (let i = 0; i < tokens.length; i++) {
  const t0 = tokens[i];

  if (t0 === "--json") { jsonMode = true; continue; }
  if (t0 === "--tag" || t0 === "-t") {
    const val = tokens[++i] ?? "";
    opts.tags = val.split(",").map(s => s.trim()).filter(Boolean);
    continue;
  }
  if (t0 === "--after") { opts.after = (tokens[++i] ?? ""); continue; }
  if (t0 === "--before"){ opts.before = (tokens[++i] ?? ""); continue; }
  if (t0 === "--limit") { limit = Math.max(1, parseInt(tokens[++i] ?? "50", 10) || 50); continue; }
  if (t0 === "--offset"){ offset = Math.max(0, parseInt(tokens[++i] ?? "0", 10) || 0); continue; }

  // operatori booleani
  if (/^or$/i.test(t0)) {
    // chiudi clausola corrente, se vuota la scartiamo
    if (currentClause.length > 0) clauses.push(currentClause);
    currentClause = [];
    continue;
  }
  if (/^not$/i.test(t0)) {
    const t1 = tokens[++i];
    if (t1) negatives.push(t1.toLowerCase());
    continue;
  }

  // NOT con prefisso '-'
  if (t0.startsWith("-") && t0.length > 1) {
    negatives.push(t0.slice(1).toLowerCase());
    continue;
  }

  // termine positivo in clausola corrente
  currentClause.push(t0.toLowerCase());
}
// push finale
if (currentClause.length > 0) clauses.push(currentClause);

// se non ci sono clausole né filtri, mostriamo usage se non in json
const onlyFilters = (clauses.length === 0 && negatives.length === 0);
if (onlyFilters && !opts.tags.length && !opts.after && !opts.before) {
  if (!jsonMode) {
    console.error('Usage: pnpm search-db "query (AND/OR/NOT)" [--json] [--tag t1,t2] [--after YYYY-MM-DD] [--before YYYY-MM-DD] [--limit N] [--offset N]');
  }
  process.exit(1);
}

// -------------------- Caricamento indice --------------------
if (!fs.existsSync(INDEX_PATH)) {
  if (!jsonMode) console.error(`Index not found: ${INDEX_PATH}. Run "pnpm index-db" first.`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as Note[];

// -------------------- Utils di match --------------------
function dateOk(iso: string) {
  // Confronto lessicografico su YYYY-MM-DD
  if (opts.after && iso < opts.after) return false;
  if (opts.before && iso > opts.before) return false;
  return true;
}

function hasTerm(n: Note, term: string) {
  const body = (n.content || "").toLowerCase();
  return (
    n.title.toLowerCase().includes(term) ||
    n.id.toLowerCase().includes(term) ||
    body.includes(term) ||
    n.tags.some(t => t.toLowerCase().includes(term))
  );
}

function matchesNegatives(n: Note) {
  for (const t of negatives) if (hasTerm(n, t)) return false;
  return true;
}

function matchesClauses(n: Note) {
  // Nessuna clausola => tutto OK (si applicano solo filtri/negativi)
  if (clauses.length === 0) return true;
  // OR tra clausole; ogni clausola = AND dei termini
  for (const clause of clauses) {
    let ok = true;
    for (const term of clause) {
      if (!hasTerm(n, term)) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

// -------------------- Ranking --------------------
// Pesatura semplice: title(5) > tags(3) > content(2) > id(1)
// Bonus per match a inizio parola; tasso document length in modo leggero.
function score(n: Note) {
  if (clauses.length === 0) return 0;
  const body = (n.content || "").toLowerCase();
  let s = 0;
  const allTerms = new Set<string>(clauses.flat());

  for (const q of allTerms) {
    if (n.title.toLowerCase().includes(q)) s += 5;
    if (n.tags.some(t => t.toLowerCase().includes(q))) s += 3;
    if (body.includes(q)) s += 2;
    if (n.id.toLowerCase().includes(q)) s += 1;

    // bonus inizio parola su title/body
    if (new RegExp(`\\b${escapeReg(q)}`).test(n.title.toLowerCase())) s += 1;
    if (new RegExp(`\\b${escapeReg(q)}`).test(body)) s += 0.5;
  }
  // penalità minima per testi lunghi (evita gonfiore body)
  const len = Math.max(1, body.length);
  s -= Math.min(1, len / 20000); // max -1
  return s;
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// -------------------- Highlight (solo output umano) --------------------
function highlight(text: string, terms: string[]) {
  const t = (text || "");
  if (!t) return "";
  // trova il primo match di qualsiasi termine
  const lower = t.toLowerCase();
  let bestIdx = -1, bestTerm = "";
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (bestIdx === -1 || i < bestIdx)) { bestIdx = i; bestTerm = term; }
  }
  const excerptLen = 120;
  if (bestIdx < 0) return t.slice(0, excerptLen) + (t.length > excerptLen ? "..." : "");
  const start = Math.max(0, bestIdx - 40);
  const end = Math.min(t.length, bestIdx + bestTerm.length + 40);
  const pre = t.slice(start, bestIdx);
  const mid = t.slice(bestIdx, bestIdx + bestTerm.length);
  const post = t.slice(bestIdx + bestTerm.length, end);
  return `${start>0?"...":""}${pre}[${mid}]${post}${end<t.length?"...":""}`;
}

// -------------------- Run --------------------
const tagSetFilter = new Set(opts.tags.map(t => t.toLowerCase()));

const filtered = data.filter(n => {
  if (!dateOk(n.updated)) return false;
  if (tagSetFilter.size > 0) {
    const ntags = new Set(n.tags.map(t => t.toLowerCase()));
    for (const t of tagSetFilter) if (!ntags.has(t)) return false;
  }
  if (!matchesNegatives(n)) return false;
  if (!matchesClauses(n)) return false;
  return true;
});

const ranked = clauses.length > 0
  ? filtered.sort((a, b) => score(b) - score(a) || b.updated.localeCompare(a.updated))
  : filtered.sort((a, b) => b.updated.localeCompare(a.updated));

// paging
const slice = ranked.slice(offset, offset + limit);

// --------- Output ---------
if (jsonMode) {
  const allTerms = clauses.flat(); // per excerpt
  const out = slice.map(r => ({
    id: r.id,
    title: r.title,
    path: r.path,
    updated: r.updated,
    tags: r.tags,
    excerpt: allTerms.length ? highlight(r.content || "", allTerms).replace(/\n/g, " ") : ""
  }));
  process.stdout.write(JSON.stringify({
    query: tokens.join(" "),
    filters: { ...opts, limit, offset, negatives },
    total: ranked.length,
    count: out.length,
    results: out
  }, null, 2) + "\n");
  process.exit(0);
}

// output umano
if (slice.length === 0) {
  console.log("No results.");
  process.exit(0);
}
console.log(`Found ${ranked.length} result(s). Showing ${slice.length} (offset ${offset})`);
const allTerms = clauses.flat();
for (const r of slice) {
  const ex = allTerms.length ? highlight(r.content || "", allTerms).replace(/\n/g, " ") : "";
  console.log(`\n - [${r.id}] ${r.title} (${r.path})  updated:${r.updated}${r.tags.length? "  tags:"+r.tags.join(","): ""}`);
  if (ex) console.log(`   ${ex}`);
}
