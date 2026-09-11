import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDatabase } from "./database";
import {
  createPackage,
  listFedexPackagesForTracking,
  listPackages,
  saveTrackingUpdate,
  updatePackage,
} from "./packages";

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

  it("stores normalized tracking details, scan history, and the raw response", () => {
    const database = new Database(":memory:");
    migrateDatabase(database);
    createPackage(
      {
        id: "tracked",
        name: "Tracked",
        carrier: "fedex",
        trackingNumber: "541114253561",
        trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=541114253561",
        expectedDeliveryDate: null,
        delivered: false,
        addedAt: 1,
      },
      database
    );

    saveTrackingUpdate(
      "tracked",
      {
        statusCode: "IT",
        status: "On the way",
        description: "In transit",
        estimatedDeliveryStart: "2026-09-12T09:00:00-05:00",
        estimatedDeliveryEnd: "2026-09-12T13:00:00-05:00",
        lastUpdatedAt: "2026-09-11T10:00:00-05:00",
        complete: false,
        details: {
          service: "FedEx Ground",
          packageType: "Package",
          origin: null,
          destination: null,
          signedBy: "",
        },
        events: [
          {
            id: "event-1",
            occurredAt: "2026-09-11T10:00:00-05:00",
            code: "IT",
            description: "On the way",
            location: {
              city: "Memphis",
              stateOrProvinceCode: "TN",
              postalCode: "38116",
              countryCode: "US",
            },
            details: { eventType: "IT" },
          },
        ],
        response: { trackingNumberInfo: { trackingNumber: "541114253561" } },
      },
      1_000,
      database
    );

    const item = listPackages(database)[0];
    const rawResponse = database
      .query<{ response_json: string }, []>("SELECT response_json FROM package_tracking")
      .get();
    expect(item.tracking).toMatchObject({
      status: "On the way",
      lastCheckedAt: 1_000,
      events: [{ code: "IT", description: "On the way" }],
    });
    expect(JSON.parse(rawResponse!.response_json)).toMatchObject({
      trackingNumberInfo: { trackingNumber: "541114253561" },
    });
    database.close();
  });

  it("makes a FedEx package due again at the hourly boundary", () => {
    const database = new Database(":memory:");
    migrateDatabase(database);
    createPackage(
      {
        id: "tracked",
        name: "Tracked",
        carrier: "fedex",
        trackingNumber: "541114253561",
        trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=541114253561",
        expectedDeliveryDate: null,
        delivered: false,
        addedAt: 1,
      },
      database
    );
    database.run(
      "INSERT INTO package_tracking (package_id, last_checked_at, error) VALUES (?, ?, ?)",
      ["tracked", 1_000, "Temporary error"]
    );

    expect(listFedexPackagesForTracking(999, database)).toEqual([]);
    expect(listFedexPackagesForTracking(1_000, database)).toEqual([
      { id: "tracked", trackingNumber: "541114253561" },
    ]);
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
      tracking: null,
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
