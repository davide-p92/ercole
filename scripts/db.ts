// scripts/json-db.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import crypto from 'crypto';

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

  parseNote(filePath: string): Note {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const relPath = path.relative(NOTES_DIR, filePath);
    
    const data = parsed.data as any;
    
    return {
      id: data.id || path.basename(filePath, '.md'),
      path: relPath,
      title: data.title || 'Untitled',
      created: data.created || new Date().toISOString().split('T')[0],
      updated: data.updated || new Date().toISOString().split('T')[0],
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      links: Array.isArray(data.links) ? data.links.map(String) : [],
      content: (parsed.content || '').trim(),
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
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'index':
      console.log('🔍 Indexing notes...');
      const notes = db.indexNotes();
      const stats = db.getStats();
      console.log('\n📊 Summary:');
      console.log(`  Total notes: ${stats.totalNotes}`);
      console.log(`  Total tags: ${stats.totalTags}`);
      console.log(`  Total words: ${stats.totalWords}`);
      if (stats.topTags.length > 0) {
        console.log(`  Top tags: ${stats.topTags.map((t: TagStats) => `${t.tag}(${t.count})`).join(', ')}`);
      }
      break;
      
    case 'search':
      if (!process.argv[3]) {
        console.error('Usage: pnpm search "query"');
        console.error('Example: pnpm search "machine learning"');
        process.exit(1);
      }
      const query = process.argv.slice(3).join(' ');
      console.log(`🔍 Searching for "${query}"...`);
      const results = db.search(query);
      
      if (results.length === 0) {
        console.log('No results found.');
      } else {
        console.log(`\nFound ${results.length} result(s):\n`);
        results.forEach((note: Note, i: number) => {
          console.log(`${i + 1}. [${note.id}] ${note.title}`);
          console.log(`   Path: ${note.path}`);
          console.log(`   Updated: ${note.updated}`);
          if (note.tags.length > 0) {
            console.log(`   Tags: ${note.tags.join(', ')}`);
          }
          // Show excerpt (first 150 chars)
          const excerpt = note.content.substring(0, 150).replace(/\n/g, ' ');
          console.log(`   Excerpt: ${excerpt}${note.content.length > 150 ? '...' : ''}\n`);
        });
      }
      break;
      
    case 'list':
      const allNotes = Array.from(db['notes'].values())
        .sort((a: Note, b: Note) => b.updated.localeCompare(a.updated));
      
      console.log(`Total notes: ${allNotes.length}\n`);
      allNotes.forEach((note: Note) => {
        console.log(`- [${note.id}] ${note.title}`);
        console.log(`  ${note.path} (updated: ${note.updated})`);
        if (note.tags.length > 0) {
          console.log(`  Tags: ${note.tags.join(', ')}`);
        }
        console.log();
      });
      break;
      
    case 'stats':
      const statsResult: DatabaseStats = db.getStats();
      console.log('📈 Statistics:');
      console.log(`  Total notes: ${statsResult.totalNotes}`);
      console.log(`  Total tags: ${statsResult.totalTags}`);
      console.log(`  Total words: ${statsResult.totalWords}`);
      if (statsResult.topTags.length > 0) {
        console.log('\n  Top tags:');
        statsResult.topTags.forEach((tag: TagStats) => {
          console.log(`    ${tag.tag}: ${tag.count} note${tag.count > 1 ? 's' : ''}`);
        });
      }
      break;
      
    default:
      console.log('📝 Note Management System');
      console.log('=======================\n');
      console.log('Usage:');
      console.log('  pnpm index          - Index all notes');
      console.log('  pnpm search <query> - Search notes');
      console.log('  pnpm list           - List all notes');
      console.log('  pnpm stats          - Show statistics\n');
      console.log('Examples:');
      console.log('  pnpm index');
      console.log('  pnpm search "transformer"');
      console.log('  pnpm list');
      console.log('  pnpm stats');
      process.exit(1);
  }
}
