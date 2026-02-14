# Ercole · FS-first Markdown Notes (JSON Index)

Ercole is a lightweight and portable system for managing Markdown notes with **YAML frontmatter**, indexed via a **derivable JSON index**.
The filesystem is the *source of truth*: everything else (index, graph, statistics) can be regenerated at any time.

---

## ✨ Main Features

- **FS-first**: Each note is a `.md` with YAML frontmatter.
- **Derivable JSON index**: `notes-index.json` can be rebuilt at any time.
- **Advanced Search**:
- Implicit AND: `foo bar`
- Explicit OR: `foo OR bar`
- NOT: `foo -bar` or `foo NOT bar`
- Filters: `--tag`, `--after`, `--before`
- Paging: `--limit`, `--offset`
- Machine-readable output: `--json`
- **Live Watcher** with:
- Debounce
- Skip over unchanged content via `content_hash`
- **Link Graph** → `graph.json`
- **ESM + tsx**: Locale / GitHub Codespaces compatible.

---

## 🚀 Requirements

- **Node.js ≥ 20.19**
- **pnpm** recommended

---

## 📦 Setup

```bash
pnpm install

## 📝 Note Format

Every note must begin with a YAML frontmatter:



id: my-note-id
title: "Note title"
created: 2026-02-08
updated: 2026-02-08
tags: [ai, notes]
links: [altra-nota]
status: active       # optional: draft|active|archived
---
Free md content…

## Fundamental Rules:

ID is the identity (stable even if you rename/move the file).
Paths can vary → they are not identities.
No note can exist only in the index or database: it must always exist on the filesystem.

## 🔧 Main commands
## ▶️ Index all notes

pnpm index-db

Generates / updates notes-index.json

## ▶️ Search (advanced)
Examples:
# Base search
pnpm --silent search-db "transformer" --json | jq .

# AND (implicit)
pnpm search-db "transformer diffusion"

# OR
pnpm search-db "transformer OR diffusion"

# NOT
pnpm search-db "transformer -draft"
pnpm search-db "transformer NOT draft"

# Filters
pnpm search-db "ai" --tag test
pnpm search-db "ai" --after 2026-02-01
pnpm search-db "ai" --before 2026-02-28

# Paging
pnpm search-db "ai" --limit 20 --offset 40 --json | jq .

# Pure JSON mode (pipeline jq)
Use pnpm --silent to avoid banner:
pnpm --silent search-db "transformer" --json | jq .

## 👁 Live Watcher
Automatically updates the table of contents as you edit notes:
pnpm watch-db

Includes:
- Debounce (reduces writes)
- SHA-256 hash detection to avoid unnecessary re-indexing

## 🔗 Graph generation (links → graph.json)
pnpm graph

Creates:
{
  "nodes": [...],
  "edges": [...],
  "meta": {
    "nodes": N,
    "edges": M,
    "generatedAt": "2026-02-14T..."
  }
}

Usable for viewer web, d3-force, analysis, mental maps.

## 📊 Stats
pnpm stats-db

Shows:
- Note n.
- Tag n.
- Word n.
- Top tags

## 🧩 Project Philosophy
Ercole was born with three principles:

Filesystem-first → .md files are the truth.
Derivable index → ​​never depend on a database.
Complete portability → local, GitHub Codespaces, containers.

This approach avoids lock-in, maintains absolute simplicity, and facilitates hackability.

## 🛣 Roadmap

Static web viewer (note view + graph)
Automatic backlinks (built from links)
VS Code Extensions / Unified CLI Ercole <cmd>
Selective exports (by tag, by range, by project)

## 📜 License
MIT

