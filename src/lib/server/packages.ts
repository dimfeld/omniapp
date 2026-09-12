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

export const allowedCarriers = new Set(["usps", "ups", "fedex", "dhl", "ontrac", "custom"]);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the normalized date, or `undefined` when the value is not a valid `YYYY-MM-DD` date. */
export function normalizeExpectedDeliveryDate(value: string | null | undefined) {
  if (value !== null && value !== undefined && typeof value !== "string") return undefined;
  const date = value?.trim() || null;
  if (date && !datePattern.test(date)) return undefined;
  return date;
}

/** Returns the normalized URL, or `undefined` when the value is not a valid http(s) URL. */
export function normalizeTrackingUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
  return parsed.toString();
}

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

export type PackageUpdate = {
  name?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  expectedDeliveryDate?: string | null;
  delivered?: boolean;
};

export function updatePackage(id: string, update: PackageUpdate, database: Database = db) {
  const current = database
    .query<PackageRow, [string]>(`SELECT ${selectColumns} FROM packages WHERE id = ?`)
    .get(id);
  if (!current) return null;

  const next: PackageRow = {
    ...current,
    name: update.name ?? current.name,
    carrier: update.carrier ?? current.carrier,
    tracking_number: update.trackingNumber ?? current.tracking_number,
    tracking_url: update.trackingUrl ?? current.tracking_url,
    expected_delivery_date:
      update.expectedDeliveryDate === undefined
        ? current.expected_delivery_date
        : update.expectedDeliveryDate,
    delivered: update.delivered === undefined ? current.delivered : update.delivered ? 1 : 0,
  };

  database.run(
    `UPDATE packages
     SET name = ?, carrier = ?, tracking_number = ?, tracking_url = ?,
         expected_delivery_date = ?, delivered = ?
     WHERE id = ?`,
    [
      next.name,
      next.carrier,
      next.tracking_number,
      next.tracking_url,
      next.expected_delivery_date,
      next.delivered,
      id,
    ]
  );

  return toRecord(next);
}

export function deletePackage(id: string) {
  const result = db.run("DELETE FROM packages WHERE id = ?", [id]);
  return result.changes > 0;
}
