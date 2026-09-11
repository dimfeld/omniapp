import type { Database } from "bun:sqlite";
import type {
  PackageRecord,
  PackageTracking,
  PackageTrackingDetails,
  PackageTrackingEvent,
  PackageTrackingLocation,
} from "$lib/packages/types";
import { db } from "$lib/server/database";

export type { PackageRecord } from "$lib/packages/types";

export type NewPackageRecord = Omit<PackageRecord, "tracking">;

export type TrackablePackage = {
  id: string;
  trackingNumber: string;
};

export type TrackingUpdate = Omit<PackageTracking, "lastCheckedAt" | "error" | "events"> & {
  events: Array<PackageTrackingEvent & { details: unknown }>;
  response: unknown;
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
  status_code: string | null;
  tracking_status: string | null;
  tracking_description: string | null;
  estimated_delivery_start: string | null;
  estimated_delivery_end: string | null;
  last_updated_at: string | null;
  last_checked_at: number | null;
  tracking_complete: number | null;
  tracking_error: string | null;
  details_json: string | null;
};

type TrackingEventRow = {
  package_id: string;
  event_id: string;
  occurred_at: string;
  code: string;
  description: string;
  location_json: string | null;
};

const emptyTrackingDetails: PackageTrackingDetails = {
  service: "",
  packageType: "",
  origin: null,
  destination: null,
  signedBy: "",
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toRecord(row: PackageRow, events: PackageTrackingEvent[]): PackageRecord {
  const storedDetails = parseJson<Partial<PackageTrackingDetails>>(row.details_json, {});
  const tracking =
    row.last_checked_at === null
      ? null
      : ({
          statusCode: row.status_code ?? "",
          status: row.tracking_status ?? "",
          description: row.tracking_description ?? "",
          estimatedDeliveryStart: row.estimated_delivery_start,
          estimatedDeliveryEnd: row.estimated_delivery_end,
          lastUpdatedAt: row.last_updated_at,
          lastCheckedAt: row.last_checked_at,
          complete: row.tracking_complete === 1,
          error: row.tracking_error,
          details: { ...emptyTrackingDetails, ...storedDetails },
          events,
        } satisfies PackageTracking);

  return {
    id: row.id,
    name: row.name,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    expectedDeliveryDate: row.expected_delivery_date,
    delivered: row.delivered === 1,
    addedAt: row.added_at,
    tracking,
  };
}

const selectColumns = `
  p.id, p.name, p.carrier, p.tracking_number, p.tracking_url,
  p.expected_delivery_date, p.delivered, p.added_at,
  pt.status_code, pt.status AS tracking_status, pt.description AS tracking_description,
  pt.estimated_delivery_start, pt.estimated_delivery_end, pt.last_updated_at,
  pt.last_checked_at, pt.complete AS tracking_complete, pt.error AS tracking_error,
  pt.details_json
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
function eventRowsForActivePackages(database: Database) {
  return database
    .query<TrackingEventRow, []>(
      `SELECT package_id, event_id, occurred_at, code, description, location_json
       FROM package_tracking_events
       WHERE package_id IN (SELECT id FROM packages WHERE delivered = 0)
       ORDER BY occurred_at DESC`
    )
    .all();
}

function eventsByPackage(rows: TrackingEventRow[]) {
  const events = new Map<string, PackageTrackingEvent[]>();
  for (const row of rows) {
    const item: PackageTrackingEvent = {
      id: row.event_id,
      occurredAt: row.occurred_at,
      code: row.code,
      description: row.description,
      location: parseJson<PackageTrackingLocation | null>(row.location_json, null),
    };
    const packageEvents = events.get(row.package_id) ?? [];
    packageEvents.push(item);
    events.set(row.package_id, packageEvents);
  }
  for (const packageEvents of events.values()) {
    packageEvents.sort((a, b) => {
      const aTime = Date.parse(a.occurredAt);
      const bTime = Date.parse(b.occurredAt);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      return b.occurredAt.localeCompare(a.occurredAt);
    });
  }
  return events;
}

export function listPackages(database: Database = db) {
  const events = eventsByPackage(eventRowsForActivePackages(database));
  return database
    .query<PackageRow, []>(
      `SELECT ${selectColumns}
       FROM packages p
       LEFT JOIN package_tracking pt ON pt.package_id = p.id
       WHERE p.delivered = 0
       ORDER BY p.expected_delivery_date IS NOT NULL, p.expected_delivery_date ASC, p.added_at DESC`
    )
    .all()
    .map((row) => toRecord(row, events.get(row.id) ?? []));
}

export function getPackage(id: string, database: Database = db) {
  const row = database
    .query<PackageRow, [string]>(
      `SELECT ${selectColumns}
       FROM packages p
       LEFT JOIN package_tracking pt ON pt.package_id = p.id
       WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;

  const events = database
    .query<TrackingEventRow, [string]>(
      `SELECT package_id, event_id, occurred_at, code, description, location_json
       FROM package_tracking_events
       WHERE package_id = ?
       ORDER BY occurred_at DESC`
    )
    .all(id);
  return toRecord(row, eventsByPackage(events).get(id) ?? []);
}

export function createPackage(item: NewPackageRecord, database: Database = db) {
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
  return { ...item, tracking: null } satisfies PackageRecord;
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
    .query<PackageRow, [string]>(
      `SELECT ${selectColumns}
       FROM packages p
       LEFT JOIN package_tracking pt ON pt.package_id = p.id
       WHERE p.id = ?`
    )
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

  const events = database
    .query<TrackingEventRow, [string]>(
      `SELECT package_id, event_id, occurred_at, code, description, location_json
       FROM package_tracking_events
       WHERE package_id = ?
       ORDER BY occurred_at DESC`
    )
    .all(id);
  return toRecord(next, eventsByPackage(events).get(id) ?? []);
}

export function listFedexPackagesForTracking(
  dueBefore: number,
  database: Database = db,
  ids?: string[]
) {
  const idFilter = ids?.length ? `AND p.id IN (${ids.map(() => "?").join(", ")})` : "";
  const parameters = ids?.length ? [dueBefore, ...ids] : [dueBefore];
  return database
    .query<TrackablePackage, Array<number | string>>(
      `SELECT p.id, p.tracking_number AS trackingNumber
       FROM packages p
       LEFT JOIN package_tracking pt ON pt.package_id = p.id
       WHERE p.delivered = 0
         AND p.carrier = 'fedex'
         AND p.tracking_number <> ''
         AND COALESCE(pt.complete, 0) = 0
         AND (pt.last_checked_at IS NULL OR pt.last_checked_at <= ?)
         ${idFilter}
       ORDER BY p.added_at ASC`
    )
    .all(...parameters);
}

export function saveTrackingUpdate(
  packageId: string,
  update: TrackingUpdate,
  checkedAt: number,
  database: Database = db
) {
  database.run("BEGIN IMMEDIATE");
  try {
    database.run(
      `INSERT INTO package_tracking (
        package_id, status_code, status, description, estimated_delivery_start,
        estimated_delivery_end, last_updated_at, last_checked_at, complete, error,
        details_json, response_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(package_id) DO UPDATE SET
        status_code = excluded.status_code,
        status = excluded.status,
        description = excluded.description,
        estimated_delivery_start = excluded.estimated_delivery_start,
        estimated_delivery_end = excluded.estimated_delivery_end,
        last_updated_at = excluded.last_updated_at,
        last_checked_at = excluded.last_checked_at,
        complete = excluded.complete,
        error = NULL,
        details_json = excluded.details_json,
        response_json = excluded.response_json`,
      [
        packageId,
        update.statusCode,
        update.status,
        update.description,
        update.estimatedDeliveryStart,
        update.estimatedDeliveryEnd,
        update.lastUpdatedAt,
        checkedAt,
        update.complete ? 1 : 0,
        JSON.stringify(update.details),
        JSON.stringify(update.response),
      ]
    );

    const eventStatement = database.prepare(
      `INSERT INTO package_tracking_events (
        package_id, event_id, occurred_at, code, description, location_json, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(package_id, event_id) DO UPDATE SET
        occurred_at = excluded.occurred_at,
        code = excluded.code,
        description = excluded.description,
        location_json = excluded.location_json,
        details_json = excluded.details_json`
    );
    for (const event of update.events) {
      eventStatement.run(
        packageId,
        event.id,
        event.occurredAt,
        event.code,
        event.description,
        event.location ? JSON.stringify(event.location) : null,
        JSON.stringify(event.details)
      );
    }
    database.run("COMMIT");
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}

export function saveTrackingError(
  packageId: string,
  error: string,
  checkedAt: number,
  database: Database = db
) {
  database.run(
    `INSERT INTO package_tracking (package_id, last_checked_at, error)
     VALUES (?, ?, ?)
     ON CONFLICT(package_id) DO UPDATE SET
       last_checked_at = excluded.last_checked_at,
       error = excluded.error`,
    [packageId, checkedAt, error]
  );
}

export function markPackageDelivered(id: string, database: Database = db) {
  const result = database.run("UPDATE packages SET delivered = 1 WHERE id = ?", [id]);
  return result.changes > 0;
}

export function updatePackageExpectedDeliveryDate(
  id: string,
  expectedDeliveryDate: string | null,
  database: Database = db
) {
  const result = database.run("UPDATE packages SET expected_delivery_date = ? WHERE id = ?", [
    expectedDeliveryDate,
    id,
  ]);
  return result.changes > 0;
}

export function deletePackage(id: string, database: Database = db) {
  const result = database.run("DELETE FROM packages WHERE id = ?", [id]);
  return result.changes > 0;
}
