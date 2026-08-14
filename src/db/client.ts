import Database from '@tauri-apps/plugin-sql';

// Schema creation lives in Rust (src-tauri/src/lib.rs) as plugin migrations,
// which run automatically on load — so this only has to open the handle.
let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:freel.db').then(async (db) => {
      await db.execute('PRAGMA foreign_keys = ON;');
      return db;
    });
  }
  return dbPromise;
}
