import chokidar from "chokidar";
import path from "path";
import fs from "fs";
import matter from "gray-matter";
import crypto from "crypto";

const NOTES_DIR = path.resolve(__dirname, "../notes");
const INDEX_PATH = path.resolve(__dirname, "../notes-index.json");

// --- Types ---
interface Note {
  id: string;
  path: string;
  title: string;
  created: string;
  updated: string;
  tags: string[];
  links: string[];
  content: string;
  content_hash: string;
}

class JSONDatabase {
  private notes: Map<string, Note> = new Map();

  constructor() {
    this.load();
  }

  // Load index from disk if present
  load() {
    if (fs.existsSync(INDEX_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
        this.notes.clear();
        data.forEach((note: Note) => this.notes.set(note.id, note));
        console.log(`📚 Loaded ${this.notes.size} notes from index`);
      } catch (err) {
        console.error("Failed to load index:\n", err);
      }
    }
  }

  save() {
    fs.writeFileSync(
      INDEX_PATH,
      JSON.stringify([...this.notes.values()], null, 2)
    );
    console.log(`💾 Saved index (${this.notes.size} notes)`);
  }

  removeByPath(relPath: string) {
    for (const [id, note] of this.notes.entries()) {
      if (note.path === relPath) {
        this.notes.delete(id);
        console.log(`🗑 Removed: ${relPath}`);
        return;
      }
    }
  }

  sha256(text: string) {
    return crypto.createHash("sha256").update(text).digest("hex");
  }

  parseNote(filePath: string): Note {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);

    const data = parsed.data as any;
    const rel = path.relative(NOTES_DIR, filePath);

    if (!data.id) throw new Error(`Missing id in ${rel}`);
    if (!data.title) throw new Error(`Missing title in ${rel}`);
    if (!data.created) throw new Error(`Missing created in ${rel}`);
    if (!data.updated) throw new Error(`Missing updated in ${rel}`);

    return {
      id: data.id,
      title: data.title,
      created: data.created,
      updated: data.updated,
      tags: Array.isArray(data.tags) ? data.tags : [],
      links: Array.isArray(data.links) ? data.links : [],
      path: rel,
      content: parsed.content.trim(),
      content_hash: this.sha256(raw)
    };
  }

  upsertFromFile(filePath: string) {
    try {
      const note = this.parseNote(filePath);
      this.notes.set(note.id, note);
      console.log(`✨ Indexed: ${note.path}`);
      this.save();
    } catch (err: any) {
      console.error(`❌ Error parsing ${filePath}:`, err.message);
    }
  }
}

//
// --- MAIN WATCHER LOGIC ---
//
(async () => {
  const db = new JSONDatabase();

  console.log("👀 Watching notes folder:", NOTES_DIR);

  const watcher = chokidar.watch(`${NOTES_DIR}/**/*.md`, {
    ignoreInitial: false,
    persistent: true,
  });

  watcher
    .on("add", (file) => {
      console.log("\n📄 Added:", file);
      db.upsertFromFile(file);
    })
    .on("change", (file) => {
      console.log("\n✏️ Modified:", file);
      db.upsertFromFile(file);
    })
    .on("unlink", (file) => {
      console.log("\n🗑 Deleted:", file);
      const rel = path.relative(NOTES_DIR, file);
      db.removeByPath(rel);
      db.save();
    });

})();
