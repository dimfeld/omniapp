import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDatabase } from "./database";
import { createPackage, listPackages, updatePackage } from "./packages";

describe("package listing", () => {
  it("only lists packages that are not delivered", () => {
    const database = new Database(":memory:");
    migrateDatabase(database);

    createPackage(
      {
        id: "in-transit",
        name: "In transit",
        carrier: "ups",
        trackingNumber: "1Z123",
        trackingUrl: "https://example.com/in-transit",
        expectedDeliveryDate: null,
        delivered: false,
        addedAt: 2,
      },
      database
    );
    createPackage(
      {
        id: "delivered",
        name: "Delivered",
        carrier: "usps",
        trackingNumber: "940123",
        trackingUrl: "https://example.com/delivered",
        expectedDeliveryDate: null,
        delivered: true,
        addedAt: 1,
      },
      database
    );

    expect(listPackages(database).map((item) => item.id)).toEqual(["in-transit"]);
    database.close();
  });
});

describe("package updates", () => {
  function seed() {
    const database = new Database(":memory:");
    migrateDatabase(database);
    createPackage(
      {
        id: "package",
        name: "Coffee beans",
        carrier: "usps",
        trackingNumber: "940123",
        trackingUrl: "https://example.com/940123",
        expectedDeliveryDate: "2026-01-02",
        delivered: false,
        addedAt: 1,
      },
      database
    );
    return database;
  }

  it("updates the edited fields and leaves the rest alone", () => {
    const database = seed();

    const updated = updatePackage(
      "package",
      {
        name: "Espresso beans",
        carrier: "ups",
        trackingNumber: "1Z999",
        trackingUrl: "https://example.com/1Z999",
      },
      database
    );

    expect(updated).toEqual({
      id: "package",
      name: "Espresso beans",
      carrier: "ups",
      trackingNumber: "1Z999",
      trackingUrl: "https://example.com/1Z999",
      expectedDeliveryDate: "2026-01-02",
      delivered: false,
      addedAt: 1,
    });
    expect(listPackages(database)).toEqual([updated]);
    database.close();
  });

  it("clears the expected delivery date when it is set to null", () => {
    const database = seed();

    updatePackage("package", { expectedDeliveryDate: null }, database);

    expect(listPackages(database)[0]?.expectedDeliveryDate).toBeNull();
    database.close();
  });

  it("removes a package from the list once it is delivered", () => {
    const database = seed();

    expect(updatePackage("package", { delivered: true }, database)?.delivered).toBe(true);
    expect(listPackages(database)).toEqual([]);
    database.close();
  });

  it("returns null for a package that does not exist", () => {
    const database = seed();

    expect(updatePackage("missing", { name: "Nope" }, database)).toBeNull();
    database.close();
  });
});
