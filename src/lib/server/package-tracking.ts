import type { Database } from "bun:sqlite";
import { db } from "$lib/server/database";
import {
  listFedexPackagesForTracking,
  saveTrackingError,
  saveTrackingUpdate,
} from "$lib/server/packages";
import { getFedexTracking, type FedexConfig, type FetchFunction } from "$lib/server/tracking/fedex";

export const trackingIntervalMs = 60 * 60 * 1000;
const fedexBatchSize = 30;

type RefreshOptions = {
  database?: Database;
  fetchImpl?: FetchFunction;
  now?: number;
  ids?: string[];
  config?: Partial<FedexConfig>;
};

function fedexConfig(overrides: Partial<FedexConfig> = {}): FedexConfig | null {
  const clientId = overrides.clientId ?? process.env.FEDEX_CLIENT_ID ?? "";
  const clientSecret = overrides.clientSecret ?? process.env.FEDEX_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    apiBaseUrl: (
      overrides.apiBaseUrl ??
      process.env.FEDEX_API_BASE_URL ??
      "https://apis.fedex.com"
    ).replace(/\/$/, ""),
  };
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Could not update tracking.";
}

export async function refreshFedexTracking(options: RefreshOptions = {}) {
  const database = options.database ?? db;
  const now = options.now ?? Date.now();
  const packages = listFedexPackagesForTracking(
    options.ids ? Number.MAX_SAFE_INTEGER : now - trackingIntervalMs,
    database,
    options.ids
  );
  if (!packages.length) return;

  const config = fedexConfig(options.config);
  if (!config) {
    for (const item of packages) {
      saveTrackingError(
        item.id,
        "FedEx tracking is not configured. Set FEDEX_CLIENT_ID and FEDEX_CLIENT_SECRET.",
        now,
        database
      );
    }
    return;
  }

  for (const batch of chunks(packages, fedexBatchSize)) {
    try {
      const results = await getFedexTracking(
        batch.map((item) => item.trackingNumber),
        config,
        { fetchImpl: options.fetchImpl, now }
      );
      for (const item of batch) {
        const result = results.get(item.trackingNumber);
        if (result) saveTrackingUpdate(item.id, result, now, database);
        else saveTrackingError(item.id, "FedEx did not return tracking details.", now, database);
      }
    } catch (error) {
      for (const item of batch) saveTrackingError(item.id, message(error), now, database);
    }
  }
}

let refreshInProgress: Promise<void> | null = null;

function runScheduledRefresh() {
  if (refreshInProgress) return;
  refreshInProgress = refreshFedexTracking().finally(() => {
    refreshInProgress = null;
  });
}

export function startPackageTrackingScheduler() {
  const trackingGlobal = globalThis as typeof globalThis & {
    __omniPackageTrackingSchedulerStarted?: boolean;
  };
  if (trackingGlobal.__omniPackageTrackingSchedulerStarted) return;
  trackingGlobal.__omniPackageTrackingSchedulerStarted = true;

  runScheduledRefresh();
  const timer = setInterval(runScheduledRefresh, trackingIntervalMs);
  timer.unref?.();
}
