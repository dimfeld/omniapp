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
    const expectedDateColumn = database
      .query<{ name: string }, [string]>(
        "SELECT name FROM pragma_table_info('packages') WHERE name = ?"
      )
      .get("expected_delivery_date");
    const filamentTable = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'filament_rolls'"
      )
      .get();

    const trackingTable = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'package_tracking'"
      )
      .get();
    const trackingEventsTable = database
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'package_tracking_events'"
      )
      .get();

    expect(migrationCount?.count).toBe(4);
    expect(packageTable?.name).toBe("packages");
    expect(expectedDateColumn?.name).toBe("expected_delivery_date");
    expect(filamentTable?.name).toBe("filament_rolls");
    expect(trackingTable?.name).toBe("package_tracking");
    expect(trackingEventsTable?.name).toBe("package_tracking_events");
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
