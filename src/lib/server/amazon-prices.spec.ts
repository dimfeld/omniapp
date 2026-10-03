import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "./database";
import { addWatch, getWatch } from "./amazon-watches";
import { refreshAmazonPrices } from "./amazon-prices";

afterEach(() => vi.unstubAllEnvs());

describe("Amazon price checks", () => {
  it("records an offer and sends one alert for a new drop", async () => {
    vi.stubEnv("AMAZON_CREATORS_CLIENT_ID", "id");
    vi.stubEnv("AMAZON_CREATORS_CLIENT_SECRET", "secret");
    vi.stubEnv("AMAZON_PARTNER_TAG", "tag-20");
    const database = new Database(":memory:");
    migrateDatabase(database);
    const watch = addWatch("B012345678", "B012345678", 5000, database);
    const notify = vi.fn(async () => {});
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/auth/o2/token"))
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
          status: 200,
        });
      return new Response(
        JSON.stringify({
          itemResults: {
            items: [
              {
                asin: "B012345678",
                itemInfo: { title: { displayValue: "Test item" } },
                offersV2: {
                  listings: [
                    {
                      isBuyBoxWinner: true,
                      condition: { value: "New" },
                      price: { money: { amount: 49.99, currency: "USD" } },
                    },
                  ],
                },
              },
            ],
          },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    await refreshAmazonPrices({ database, ids: [watch.id], fetchImpl, notify, now: 100 });
    await refreshAmazonPrices({ database, ids: [watch.id], fetchImpl, notify, now: 200 });
    expect(getWatch(watch.id, database)).toMatchObject({
      name: "Test item",
      priceCents: 4999,
      alertActive: true,
    });
    expect(notify).toHaveBeenCalledTimes(1);
    database.close();
  });
});
