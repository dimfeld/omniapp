import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "create_packages",
    statements: [
      `CREATE TABLE packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        carrier TEXT NOT NULL,
        tracking_number TEXT NOT NULL DEFAULT '',
        tracking_url TEXT NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0 CHECK (delivered IN (0, 1)),
        added_at INTEGER NOT NULL
      )`,
      "CREATE INDEX packages_delivery_order ON packages(delivered, added_at DESC)",
    ],
  },
  {
    version: 2,
    name: "add_expected_delivery_date",
    statements: ["ALTER TABLE packages ADD COLUMN expected_delivery_date TEXT"],
  },
];

export function migrateDatabase(database: Database, availableMigrations = migrations) {
  database.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const appliedRows = database
    .query<{ version: number }, []>("SELECT version FROM schema_migrations ORDER BY version")
    .all();
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const migration of availableMigrations) {
    if (applied.has(migration.version)) continue;

    database.run("BEGIN IMMEDIATE");
    try {
      for (const statement of migration.statements) database.run(statement);
      database.run("INSERT INTO schema_migrations (version, name) VALUES (?, ?)", [
        migration.version,
        migration.name,
      ]);
      database.run("COMMIT");
    } catch (error) {
      database.run("ROLLBACK");
      throw error;
    }
  }
}

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path, { create: true });
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA foreign_keys = ON");
  database.run("PRAGMA busy_timeout = 5000");
  migrateDatabase(database);
  return database;
}

const databasePath = resolve(process.env.OMNI_DATABASE_PATH ?? "data/omni.sqlite");

export const db = openDatabase(databasePath);
