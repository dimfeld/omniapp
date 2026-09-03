import type { Database } from "bun:sqlite";
import { db } from "$lib/server/database";

export type PackageRecord = {
  id: string;
  name: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  expectedDeliveryDate: string | null;
  delivered: boolean;
  addedAt: number;
};

type PackageRow = {
  id: string;
  name: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
  expected_delivery_date: string | null;
  delivered: number;
  added_at: number;
};

function toRecord(row: PackageRow): PackageRecord {
  return {
    id: row.id,
    name: row.name,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    expectedDeliveryDate: row.expected_delivery_date,
    delivered: row.delivered === 1,
    addedAt: row.added_at,
  };
}

const selectColumns = `
  id, name, carrier, tracking_number, tracking_url, expected_delivery_date, delivered, added_at
`;

export function listPackages(database: Database = db) {
  return database
    .query<PackageRow, []>(
      `SELECT ${selectColumns}
       FROM packages
       WHERE delivered = 0
       ORDER BY expected_delivery_date IS NOT NULL, expected_delivery_date ASC, added_at DESC`
    )
    .all()
    .map(toRecord);
}

export function createPackage(item: PackageRecord, database: Database = db) {
  database.run(
    `INSERT INTO packages
      (id, name, carrier, tracking_number, tracking_url, expected_delivery_date, delivered, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.carrier,
      item.trackingNumber,
      item.trackingUrl,
      item.expectedDeliveryDate,
      item.delivered ? 1 : 0,
      item.addedAt,
    ]
  );
  return item;
}

export function markPackageDelivered(id: string) {
  const result = db.run("UPDATE packages SET delivered = 1 WHERE id = ?", [id]);
  return result.changes > 0;
}

export function updatePackageExpectedDeliveryDate(id: string, expectedDeliveryDate: string | null) {
  const result = db.run("UPDATE packages SET expected_delivery_date = ? WHERE id = ?", [
    expectedDeliveryDate,
    id,
  ]);
  return result.changes > 0;
}

export function deletePackage(id: string) {
  const result = db.run("DELETE FROM packages WHERE id = ?", [id]);
  return result.changes > 0;
}
