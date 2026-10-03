import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDatabase } from "./database";
import { addWatch, getWatch, parseAmazonAsin, savePrice, updateWatch } from "./amazon-watches";

describe("Amazon price alerts", () => {
  it("accepts only Amazon.com product links and ASINs", () => {
    expect(parseAmazonAsin("https://www.amazon.com/dp/B012345678?ref=abc")).toBe("B012345678");
    expect(parseAmazonAsin("b012345678")).toBe("B012345678");
    expect(parseAmazonAsin("https://evil.example/dp/B012345678")).toBeNull();
  });

  it("alerts once per drop and keeps a dismissal until the price rises", () => {
    const database = new Database(":memory:");
    migrateDatabase(database);
    const watch = addWatch("B012345678", "Test item", 5000, database);
    expect(savePrice(watch.id, 4900, null, 1, database)).toBe(true);
    expect(getWatch(watch.id, database)?.alertActive).toBe(true);
    expect(savePrice(watch.id, 4800, null, 2, database)).toBe(false);
    updateWatch(watch.id, { dismiss: true }, database);
    expect(savePrice(watch.id, 4700, null, 3, database)).toBe(false);
    expect(getWatch(watch.id, database)?.alertActive).toBe(false);
    expect(savePrice(watch.id, 5100, null, 4, database)).toBe(false);
    expect(savePrice(watch.id, 4900, null, 5, database)).toBe(true);
    expect(getWatch(watch.id, database)?.alertActive).toBe(true);
    database.close();
  });
});
