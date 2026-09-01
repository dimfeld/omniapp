import { db } from "$lib/server/database";

export type PackageRecord = {
  id: string;
  name: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  delivered: boolean;
  addedAt: number;
};

type PackageRow = {
  id: string;
  name: string;
  carrier: string;
  tracking_number: string;
  tracking_url: string;
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
    delivered: row.delivered === 1,
    addedAt: row.added_at,
  };
}

const selectColumns = `
  id, name, carrier, tracking_number, tracking_url, delivered, added_at
`;

export function listPackages() {
  return db
    .query<PackageRow, []>(
      `SELECT ${selectColumns} FROM packages ORDER BY delivered ASC, added_at DESC`
    )
    .all()
    .map(toRecord);
}

export function createPackage(item: PackageRecord) {
  db.run(
    `INSERT INTO packages
      (id, name, carrier, tracking_number, tracking_url, delivered, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.carrier,
      item.trackingNumber,
      item.trackingUrl,
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

export function deletePackage(id: string) {
  const result = db.run("DELETE FROM packages WHERE id = ?", [id]);
  return result.changes > 0;
}
