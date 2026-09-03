import { Database } from "bun:sqlite";
import { describe, expect, it } from "vitest";
import { migrateDatabase } from "./database";
import { createPackage, listPackages } from "./packages";

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
