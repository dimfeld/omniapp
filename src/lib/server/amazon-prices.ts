import type { Database } from "bun:sqlite";
import { db } from "$lib/server/database";
import { dueWatches, savePrice, savePriceError } from "$lib/server/amazon-watches";
import { sendPriceAlert } from "$lib/server/push";

export const priceCheckIntervalMs = 2 * 60 * 60 * 1000;

type FetchFunction = typeof fetch;
type AmazonConfig = {
  clientId: string;
  clientSecret: string;
  partnerTag: string;
  tokenUrl: string;
};
type AmazonItem = {
  asin: string;
  itemInfo?: { title?: { displayValue?: string } };
  offersV2?: {
    listings?: Array<{
      isBuyBoxWinner?: boolean;
      condition?: { value?: string };
      price?: { money?: { amount?: number; currency?: string } };
    }>;
  };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export function amazonConfigured() {
  return Boolean(
    process.env.AMAZON_CREATORS_CLIENT_ID &&
    process.env.AMAZON_CREATORS_CLIENT_SECRET &&
    process.env.AMAZON_PARTNER_TAG
  );
}

function config(): AmazonConfig | null {
  if (!amazonConfigured()) return null;
  const endpoints: Record<string, string> = {
    "3.1": "https://api.amazon.com/auth/o2/token",
    "3.2": "https://api.amazon.co.uk/auth/o2/token",
    "3.3": "https://api.amazon.co.jp/auth/o2/token",
  };
  return {
    clientId: process.env.AMAZON_CREATORS_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CREATORS_CLIENT_SECRET!,
    partnerTag: process.env.AMAZON_PARTNER_TAG!,
    tokenUrl: endpoints[process.env.AMAZON_CREATORS_VERSION ?? "3.1"] ?? endpoints["3.1"],
  };
}

async function accessToken(settings: AmazonConfig, fetchImpl: FetchFunction) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetchImpl(settings.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      scope: "creatorsapi::default",
    }),
  });
  if (!response.ok) {
    const message = `Amazon authentication failed (${response.status}).`;
    console.error(message, await response.text());
    throw new Error(message);
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Amazon did not return an access token.");
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

export async function getAmazonItems(asins: string[], fetchImpl: FetchFunction = fetch) {
  const settings = config();
  if (!settings) throw new Error("Amazon Creators API is not configured.");
  const token = await accessToken(settings, fetchImpl);
  const response = await fetchImpl("https://creatorsapi.amazon/catalog/v1/getItems", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-marketplace": "www.amazon.com",
    },
    body: JSON.stringify({
      itemIds: asins,
      itemIdType: "ASIN",
      marketplace: "www.amazon.com",
      partnerTag: settings.partnerTag,
      resources: [
        "itemInfo.title",
        "offersV2.listings.price",
        "offersV2.listings.condition",
        "offersV2.listings.isBuyBoxWinner",
      ],
    }),
  });
  if (!response.ok) {
    const message = `Amazon price request failed (${response.status}).`;
    console.error(message, await response.text());
    throw new Error(message);
  }
  const body = (await response.json()) as {
    itemResults?: { items?: AmazonItem[] };
    itemsResult?: { items?: AmazonItem[] };
  };
  return new Map(
    (body.itemResults?.items ?? body.itemsResult?.items ?? []).map((item) => [item.asin, item])
  );
}

export function offerPrice(item: AmazonItem) {
  const listing =
    item.offersV2?.listings?.find(
      (offer) => offer.isBuyBoxWinner && offer.condition?.value === "New"
    ) ?? item.offersV2?.listings?.find((offer) => offer.condition?.value === "New");
  const money = listing?.price?.money;
  if (
    money?.currency !== "USD" ||
    typeof money.amount !== "number" ||
    !Number.isFinite(money.amount) ||
    money.amount <= 0
  )
    return null;
  return Math.round(money.amount * 100);
}

export async function refreshAmazonPrices(
  options: {
    database?: Database;
    fetchImpl?: FetchFunction;
    now?: number;
    ids?: string[];
    notify?: typeof sendPriceAlert;
  } = {}
) {
  const database = options.database ?? db;
  const now = options.now ?? Date.now();
  const watches = dueWatches(
    options.ids?.length ? Number.MAX_SAFE_INTEGER : now - priceCheckIntervalMs,
    database,
    options.ids
  );
  if (!watches.length) return;
  if (!amazonConfigured()) {
    for (const watch of watches)
      savePriceError(watch.id, "Set Amazon Creators API credentials on the server.", now, database);
    return;
  }
  for (let index = 0; index < watches.length; index += 10) {
    const batch = watches.slice(index, index + 10);
    try {
      const items = await getAmazonItems(
        batch.map((watch) => watch.asin),
        options.fetchImpl
      );
      for (const watch of batch) {
        const item = items.get(watch.asin);
        const price = item ? offerPrice(item) : null;
        if (price === null) {
          savePriceError(
            watch.id,
            item ? "No new-item price is available." : "Amazon did not return this product.",
            now,
            database
          );
          continue;
        }
        const name =
          watch.name === watch.asin ? (item?.itemInfo?.title?.displayValue ?? null) : null;
        if (savePrice(watch.id, price, name, now, database)) {
          await (options.notify ?? sendPriceAlert)({
            ...watch,
            name: name ?? watch.name,
            priceCents: price,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check Amazon prices.";
      for (const watch of batch) savePriceError(watch.id, message, now, database);
    }
  }
}

let running: Promise<void> | null = null;
function runScheduledCheck() {
  if (running) return;
  running = refreshAmazonPrices().finally(() => {
    running = null;
  });
}
export function startAmazonPriceScheduler() {
  const state = globalThis as typeof globalThis & { __omniAmazonPriceSchedulerStarted?: boolean };
  if (state.__omniAmazonPriceSchedulerStarted) return;
  state.__omniAmazonPriceSchedulerStarted = true;
  runScheduledCheck();
  // Due times belong to each product, so check for due work between price checks.
  const timer = setInterval(runScheduledCheck, 60_000);
  timer.unref?.();
}
