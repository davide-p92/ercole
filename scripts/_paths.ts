import path from "path";

export const ROOT_DIR = path.resolve(__dirname, "..");
export const NOTES_DIR = path.resolve(ROOT_DIR, "notes");
export const APP_DIR = path.resolve(ROOT_DIR, ".app");
export const DB_PATH = path.resolve(APP_DIR, "index.sqlite");
