# Note Format - Ercole

## 1. Source of Truth
- Every note is a Markdown (.md) file on disk
- The filesystem is the main source
- Every index/cache/DB is deriveable and reconstructable

## 2. Position
- All notes found in `ercole/notes`
- Subfolders have only organization
- Path is NOT identity

## 3. Identity
- Every note has a stable `id`
- Id may not change even if:
    - file is renamed
    - file is moved
- Id is used for linking, graphs and internal references

## 4. Frontmatter (YAML)
Every note MUST begin with a valid YAML

### Mandatory fields:
- `id`: string (UUID or short-id)
- `title`: string
- `created`: ISO date
- `updated`: ISO date

### Optional fields:
- `tags`: string[]
- `links`: string[] # IDs of other notes
- `status`: draft | active | archived
- `source`: string # e.g. book, URL, project

### Example
```yaml
---
id: 9f2c1a6e
title: "Coding agent idea"
created: 2026-02-08
updated: 2026-02-10
tags: [ai, coding, agent]
links: [transformers, diffusion]
status: active
---

## Body
- Standard Markdown
- Code blocks allowed
- No mandatory inline HTML

## Rules
- Path is not identity (may change)
- ID is identity
- No note can exist exclusively in DB
