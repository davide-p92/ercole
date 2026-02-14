import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, "..");
export const NOTES_DIR = path.resolve(ROOT_DIR, "notes");
export const APP_DIR = path.resolve(ROOT_DIR, ".app");
export const DB_PATH = path.resolve(APP_DIR, "index.sqlite");
export const INDEX_PATH = path.resolve(ROOT_DIR, "notes-index.json");
