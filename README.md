# Ercole · FS-first Markdown Notes (JSON index)

Ercole is a simple system for managing Markdown notes with **YAML frontmatter** where the **filesystem is the source of truth**. A watcher indexes the `.md` files in `notes/` and maintains a JSON index (`notes-index.json`) for quick searches and statistics.

> Philosophy: **The DB/index is derivable** and can be regenerated at any time. No content lives alone there.

---

## Requirements

- **Node.js >= 20.19** (20.x LTS recommended)
- **pnpm** (or npm/yarn; the examples here use pnpm)

## Setup

```bash
pnpm install
