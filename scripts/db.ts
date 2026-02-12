// scripts/json-db.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Source - https://stackoverflow.com/a/50052194
// Posted by GOTO 0, modified by community. See post 'Timeline' for change history
// Retrieved 2026-02-12, License - CC BY-SA 4.0

const __dirname = dirname(fileURLToPath(import.meta.url));

const NOTES_DIR = path.resolve(__dirname, '../notes');
const INDEX_PATH = path.resolve(__dirname, '../notes-index.json');

type Note = {
  id: string;
  path: string;
  title: string;
  created: string;
  updated: string;
  tags: string[];
  links: string[];
  content: string;
  content_hash: string;
};

type TagStats = {
  tag: string;
  count: number;
};

type DatabaseStats = {
  totalNotes: number;
  totalTags: number;
  totalWords: number;
  topTags: TagStats[];
};

class JSONDatabase {
  private notes: Map<string, Note> = new Map();
  private tagsIndex: Map<string, Set<string>> = new Map();
  private contentIndex: Map<string, string> = new Map(); // For fast search

  load(): void {
    if (fs.existsSync(INDEX_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        this.notes.clear();
        this.tagsIndex.clear();
        this.contentIndex.clear();

        data.forEach((note: Note) => {
          this.notes.set(note.id, note);
          
          // Index tags
          note.tags.forEach((tag: string) => {
            if (!this.tagsIndex.has(tag)) {
              this.tagsIndex.set(tag, new Set());
            }
            const tagSet = this.tagsIndex.get(tag);
            if (tagSet) {
              tagSet.add(note.id);
            }
          });
          
          // Index content for search
          this.contentIndex.set(note.id, note.content.toLowerCase());
        });

        console.log(`Loaded ${this.notes.size} notes from index`);
      } catch (error) {
        console.error('Failed to load index:', error);
      }
    }
  }

  save(): void {
    const notesArray = Array.from(this.notes.values());
    fs.writeFileSync(INDEX_PATH, JSON.stringify(notesArray, null, 2));
    console.log(`✅ Saved ${notesArray.length} notes to ${INDEX_PATH}`);
  }

  walk(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory does not exist: ${dir}`);
      return [];
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry: fs.Dirent) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return this.walk(fullPath);
      if (entry.isFile() && entry.name.endsWith('.md')) return [fullPath];
      return [];
    });
  }

  sha256(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
private lastHashByPath: Map<string, string> = new Map();

// salva immediatamente l'indice? -> gestiremo fuori (watcher) con debounce
save(): void {
  const notesArray = Array.from(this.notes.values());
  fs.writeFileSync(INDEX_PATH, JSON.stringify(notesArray, null, 2));
  console.log(`✅ Saved ${notesArray.length} notes to ${INDEX_PATH}`);
}

// nuovo: parseAndMaybeUpsert restituisce true se ha cambiato qualcosa
parseAndMaybeUpsert(filePath: string): boolean {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const relPath = path.relative(NOTES_DIR, filePath);
  const data = parsed.data as any;

  // (opzionale) valida frontmatter se vuoi enforcement stretto
  // validateFrontmatter(data, relPath);

  const today = new Date().toISOString().split("T")[0];
  const contentHash = this.sha256(raw);
  const lastHash = this.lastHashByPath.get(relPath);
  if (lastHash === contentHash) {
    // contenuto invariato: nessun update necessario
    return false;
  }

  // costruisci l'oggetto Note con fallback sicuri
  const note: Note = {
    id: (data.id ?? path.basename(filePath, ".md")).toString(),
    title: (data.title ?? "Untitled").toString(),
    created: (data.created ?? today).toString(),
    updated: (data.updated ?? today).toString(),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    links: Array.isArray(data.links) ? data.links.map(String) : [],
    path: relPath,
    content: (parsed.content ?? "").trim(),
    content_hash: contentHash,
  };

  this.notes.set(note.id, note);
  this.lastHashByPath.set(relPath, contentHash);
  console.log(`✨ Indexed: ${note.path}`);
  return true;
}

// utile quando rimuovi un file: elimina via path
removeByPath(relPath: string): boolean {
  let removed = false;
  for (const [id, note] of this.notes.entries()) {
    if (note.path === relPath) {
      this.notes.delete(id);
      this.lastHashByPath.delete(relPath);
      console.log(`🗑 Removed: ${relPath}`);
      removed = true;
      break;
    }
  }
  return removed;
}
  parseNote(filePath: string): Note {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const relPath = path.relative(NOTES_DIR, filePath);
    
    const data = parsed.data as any;
    const today = new Date().toISOString().split("T")[0];
    
    return {
      id: (data.id ?? path.basename(filePath, '.md')).toString(),
      path: relPath,
      title: (data.title ?? 'Untitled').toString(),
      created: (data.created ?? today).toString(),
      updated: (data.updated ?? today).toString(),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      links: Array.isArray(data.links) ? data.links.map(String) : [],
      content: (parsed.content ?? '').trim(),
      content_hash: this.sha256(raw)
    };
  }

  indexNotes(): Note[] {
    console.log(`📁 Scanning ${NOTES_DIR} for markdown files...`);
    
    // Check if notes directory exists
    if (!fs.existsSync(NOTES_DIR)) {
      console.log(`Creating notes directory at ${NOTES_DIR}...`);
      fs.mkdirSync(NOTES_DIR, { recursive: true });
      
      // Create a sample note
      const sampleNote = `---
id: sample-note
title: Welcome to Your Note System
created: 2024-01-01
updated: 2024-01-01
tags: [welcome, getting-started]
links: []
---

# Welcome!

This is your first note. You can:

1. Add more notes in the \`notes/\` directory
2. Use frontmatter for metadata
3. Search notes with \`pnpm search "query"\`

## Frontmatter Example

\`\`\`yaml
---
id: unique-id
title: Note Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tag1, tag2]
links: [other-note-id]
---
\`\`\``;
      
      fs.writeFileSync(path.join(NOTES_DIR, 'welcome.md'), sampleNote);
    }
    
    const files = this.walk(NOTES_DIR);
    console.log(`📄 Found ${files.length} markdown files`);
    
    if (files.length === 0) {
      console.log('No markdown files found. A sample note has been created.');
      files.push(path.join(NOTES_DIR, 'welcome.md'));
    }
    
    const notes: Note[] = [];
    const seenIds = new Set<string>();
    
    for (const file of files) {
      try {
        const note = this.parseNote(file);
        
        if (seenIds.has(note.id)) {
          console.warn(`⚠️  Duplicate ID: "${note.id}" in ${note.path}`);
          // Make ID unique
          note.id = `${note.id}-${Date.now()}`;
        }
        seenIds.add(note.id);
        
        notes.push(note);
        console.log(`✓ ${note.path}`);
      } catch (error: any) {
        console.error(`✗ Error processing ${file}:`, error.message);
      }
    }
    
    // Update database
    this.notes.clear();
    this.tagsIndex.clear();
    this.contentIndex.clear();
    
    notes.forEach((note: Note) => {
      this.notes.set(note.id, note);
      
      // Index tags
      note.tags.forEach((tag: string) => {
        if (!this.tagsIndex.has(tag)) {
          this.tagsIndex.set(tag, new Set());
        }
        const tagSet = this.tagsIndex.get(tag);
        if (tagSet) {
          tagSet.add(note.id);
        }
      });
      
      // Index content for search
      this.contentIndex.set(note.id, note.content.toLowerCase());
    });
    
    this.save();
    
    // Sort by updated date (newest first)
    notes.sort((a: Note, b: Note) => b.updated.localeCompare(a.updated));
    
    return notes;
  }

  search(query: string): Note[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.notes.values())
      .filter((note: Note) => {
        return note.title.toLowerCase().includes(lowerQuery) ||
               note.content.toLowerCase().includes(lowerQuery) ||
               note.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)) ||
               note.id.toLowerCase().includes(lowerQuery);
      })
      .sort((a: Note, b: Note) => b.updated.localeCompare(a.updated));
  }

  getStats(): DatabaseStats {
    const notes = Array.from(this.notes.values());
    const tags = new Map<string, number>();
    
    notes.forEach((note: Note) => {
      note.tags.forEach((tag: string) => {
        tags.set(tag, (tags.get(tag) || 0) + 1);
      });
    });
    
    const topTags: TagStats[] = Array.from(tags.entries())
      .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]: [string, number]) => ({ tag, count }));
    
    return {
      totalNotes: notes.length,
      totalTags: tags.size,
      totalWords: notes.reduce((sum: number, note: Note) => sum + note.content.split(/\s+/).length, 0),
      topTags
    };
  }
}

// Create and export database instance
const db = new JSONDatabase();
db.load();

// Command line interface
// --- CLI ENTRYPOINT (ES MODULE COMPATIBLE) ---

const command = process.argv[2];

if (command === "index") {
  console.log("🔍 Indexing notes...");
  const notes = db.indexNotes();
  const stats = db.getStats();
  console.log("\n📊 Summary:");
  console.log(` Total notes: ${stats.totalNotes}`);
  console.log(` Total tags: ${stats.totalTags}`);
  console.log(` Total words: ${stats.totalWords}`);
  if (stats.topTags.length > 0) {
    console.log(` Top tags: ${stats.topTags.map(t => `${t.tag}(${t.count})`).join(", ")}`);
  }
} else if (command === "search") {
  const query = process.argv.slice(3).join(" ").trim();
  if (!query) {
    console.error('Usage: pnpm search-db "query"');
    process.exit(1);
  }
  console.log(`🔍 Searching for "${query}"...`);
  const results = db.search(query);
  if (results.length === 0) console.log("No results found.");
  else {
    console.log(`\nFound ${results.length} result(s):\n`);
    for (const note of results) {
      console.log(`- [${note.id}] ${note.title}`);
      console.log(`  Path: ${note.path}`);
      console.log(`  Updated: ${note.updated}`);
      if (note.tags.length > 0) console.log(`  Tags: ${note.tags.join(", ")}`);
      const excerpt = note.content.substring(0, 150).replace(/\n/g, " ");
      console.log(`  Excerpt: ${excerpt}${note.content.length > 150 ? "..." : ""}\n`);
    }
  }
} else if (command === "list") {
  const allNotes = Array.from(db["notes"].values()).sort((a, b) =>
    b.updated.localeCompare(a.updated)
  );
  console.log(`Total notes: ${allNotes.length}\n`);
  for (const note of allNotes) {
    console.log(`- [${note.id}] ${note.title}`);
    console.log(`  ${note.path} (updated: ${note.updated})`);
    if (note.tags.length > 0) console.log(`  Tags: ${note.tags.join(", ")}`);
    console.log();
  }
} else if (command === "stats") {
  const stats = db.getStats();
  console.log("📈 Statistics:");
  console.log(` Total notes: ${stats.totalNotes}`);
  console.log(` Total tags: ${stats.totalTags}`);
  console.log(` Total words: ${stats.totalWords}`);
  if (stats.topTags.length > 0) {
    console.log("\n Top tags:");
    for (const tag of stats.topTags) {
      console.log(`  ${tag.tag}: ${tag.count}`);
    }
  }
} else {
  console.log("📝 Note Management System (JSON)");
  console.log("==============================\n");
  console.log("Usage:");
  console.log(" pnpm index-db   - Index all notes");
  console.log(" pnpm search-db  - Search notes");
  console.log(" pnpm list-db    - List all notes");
  console.log(" pnpm stats-db   - Show statistics\n");
}

