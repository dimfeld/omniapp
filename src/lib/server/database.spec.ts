import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDatabase } from "./database";

describe("database migrations", () => {
  it("applies each migration once", () => {
    const database = new Database(":memory:");

    migrateDatabase(database);
    migrateDatabase(database);

    const migrationCount = database
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM schema_migrations")
      .get();
    const packageTable = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'packages'"
      )
      .get();

    expect(migrationCount?.count).toBe(1);
    expect(packageTable?.name).toBe("packages");
    database.close();
  });

  it("rolls back a failed migration", () => {
    const database = new Database(":memory:");

    expect(() =>
      migrateDatabase(database, [
        {
          version: 99,
          name: "invalid_migration",
          statements: ["CREATE TABLE temporary_table (id INTEGER)", "INVALID SQL"],
        },
      ])
    ).toThrow();

    const table = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'temporary_table'"
      )
      .get();
    expect(table).toBeNull();
    database.close();
  });
});
