import type { Database } from "bun:sqlite";
import { db } from "$lib/server/database";

export type AmazonWatch = {
  id: string;
  asin: string;
  name: string;
  targetCents: number;
  priceCents: number | null;
  currency: string;
  checkedAt: number | null;
  error: string | null;
  alerted: boolean;
  alertActive: boolean;
  addedAt: number;
};

type Row = {
  id: string;
  asin: string;
  name: string;
  target_cents: number;
  price_cents: number | null;
  currency: string;
  checked_at: number | null;
  error: string | null;
  alerted: number;
  alert_active: number;
  added_at: number;
};

function record(row: Row): AmazonWatch {
  return {
    id: row.id,
    asin: row.asin,
    name: row.name,
    targetCents: row.target_cents,
    priceCents: row.price_cents,
    currency: row.currency,
    checkedAt: row.checked_at,
    error: row.error,
    alerted: row.alerted === 1,
    alertActive: row.alert_active === 1,
    addedAt: row.added_at,
  };
}

export function parseAmazonAsin(input: string) {
  const value = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(value)) return value.toUpperCase();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !/^(www\.)?amazon\.com$/.test(url.hostname)) return null;
    return (
      url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1].toUpperCase() ?? null
    );
  } catch {
    return null;
  }
}

export function listWatches(database: Database = db) {
  return database
    .query<Row, []>("SELECT * FROM amazon_watches ORDER BY added_at DESC")
    .all()
    .map(record);
}

export function getWatch(id: string, database: Database = db) {
  const row = database.query<Row, [string]>("SELECT * FROM amazon_watches WHERE id = ?").get(id);
  return row ? record(row) : null;
}

export function addWatch(asin: string, name: string, targetCents: number, database: Database = db) {
  const id = crypto.randomUUID();
  database.run(
    "INSERT INTO amazon_watches (id, asin, name, target_cents, added_at) VALUES (?, ?, ?, ?, ?)",
    [id, asin, name, targetCents, Date.now()]
  );
  return getWatch(id, database)!;
}

export function updateWatch(
  id: string,
  update: { name?: string; targetCents?: number; dismiss?: boolean },
  database: Database = db
) {
  const current = getWatch(id, database);
  if (!current) return null;
  database.run(
    `UPDATE amazon_watches SET name = ?, target_cents = ?,
    alert_active = CASE WHEN ? THEN 0 ELSE alert_active END,
    alerted = CASE WHEN ? THEN 0 ELSE alerted END
    WHERE id = ?`,
    [
      update.name ?? current.name,
      update.targetCents ?? current.targetCents,
      update.dismiss ? 1 : 0,
      update.targetCents !== undefined ? 1 : 0,
      id,
    ]
  );
  return getWatch(id, database);
}

export function deleteWatch(id: string, database: Database = db) {
  return database.run("DELETE FROM amazon_watches WHERE id = ?", [id]).changes > 0;
}

export function dueWatches(before: number, database: Database = db, ids?: string[]) {
  const filter = ids?.length ? `AND id IN (${ids.map(() => "?").join(",")})` : "";
  return database
    .query<Row, Array<string | number>>(
      `SELECT * FROM amazon_watches WHERE (checked_at IS NULL OR checked_at <= ?) ${filter}`
    )
    .all(before, ...(ids ?? []))
    .map(record);
}

export function savePrice(
  id: string,
  priceCents: number,
  name: string | null,
  checkedAt: number,
  database: Database = db
) {
  const current = getWatch(id, database);
  if (!current) return false;
  const below = priceCents < current.targetCents;
  const newDrop = below && !current.alerted;
  database.run(
    `UPDATE amazon_watches SET price_cents = ?, name = ?, checked_at = ?, error = NULL,
    alerted = ?, alert_active = ? WHERE id = ?`,
    [
      priceCents,
      name || current.name,
      checkedAt,
      below ? 1 : 0,
      below ? (newDrop || current.alertActive ? 1 : 0) : 0,
      id,
    ]
  );
  return newDrop;
}

export function savePriceError(
  id: string,
  error: string,
  checkedAt: number,
  database: Database = db
) {
  database.run("UPDATE amazon_watches SET error = ?, checked_at = ? WHERE id = ?", [
    error,
    checkedAt,
    id,
  ]);
}

export function listActiveAlerts(database: Database = db) {
  return database
    .query<Row, []>("SELECT * FROM amazon_watches WHERE alert_active = 1 ORDER BY checked_at DESC")
    .all()
    .map(record);
}

export function saveSubscription(
  subscription: PushSubscriptionJSON & { endpoint: string },
  database: Database = db
) {
  database.run(
    "INSERT INTO push_subscriptions (endpoint, subscription_json) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json",
    [subscription.endpoint, JSON.stringify(subscription)]
  );
}

export function listSubscriptions(database: Database = db) {
  return database
    .query<{ endpoint: string; subscription_json: string }, []>("SELECT * FROM push_subscriptions")
    .all()
    .map((row) => ({
      endpoint: row.endpoint,
      subscription: JSON.parse(row.subscription_json) as PushSubscriptionJSON,
    }));
}

export function deleteSubscription(endpoint: string, database: Database = db) {
  database.run("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
}
