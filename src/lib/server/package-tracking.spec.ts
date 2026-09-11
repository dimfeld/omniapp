import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "./database";
import { refreshFedexTracking, trackingIntervalMs } from "./package-tracking";
import { createPackage, listPackages } from "./packages";
import { resetFedexTokenCache, type FetchFunction } from "./tracking/fedex";

describe("FedEx tracking refresh", () => {
  beforeEach(() => resetFedexTokenCache());

  it("uses the trackingnumbers endpoint and waits one hour before the next check", async () => {
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

    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchFunction = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = input.toString();
        requests.push({ url, init });
        if (url.endsWith("/oauth/token")) {
          return Response.json({ access_token: "token", expires_in: 3600 });
        }
        return Response.json({
          output: {
            completeTrackResults: [
              {
                trackingNumber: "541114253561",
                trackResults: [
                  {
                    trackingNumberInfo: { trackingNumber: "541114253561" },
                    latestStatusDetail: {
                      code: "IT",
                      statusByLocale: "On the way",
                      description: "In transit",
                    },
                    estimatedDeliveryTimeWindow: {
                      window: {
                        begins: "2026-09-12T09:00:00-05:00",
                        ends: "2026-09-12T13:00:00-05:00",
                      },
                    },
                    serviceDetail: { description: "FedEx Ground" },
                    packageDetails: { packagingDescription: "Package" },
                    shipperInformation: {
                      address: { city: "Austin", stateOrProvinceCode: "TX", countryCode: "US" },
                    },
                    recipientInformation: {
                      address: { city: "Boston", stateOrProvinceCode: "MA", countryCode: "US" },
                    },
                    scanEvents: [
                      {
                        date: "2026-09-11T10:00:00-05:00",
                        eventType: "IT",
                        eventDescription: "On the way",
                        scanLocation: {
                          city: "Memphis",
                          stateOrProvinceCode: "TN",
                          postalCode: "38116",
                          countryCode: "US",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
    );
    const config = {
      clientId: "client-id",
      clientSecret: "client-secret",
      apiBaseUrl: "https://apis-sandbox.fedex.com",
    };

    await refreshFedexTracking({ database, fetchImpl, now: 10_000, config });
    await refreshFedexTracking({
      database,
      fetchImpl,
      now: 10_000 + trackingIntervalMs - 1,
      config,
    });

    const trackingRequests = requests.filter((request) =>
      request.url.endsWith("/track/v1/trackingnumbers")
    );
    expect(trackingRequests).toHaveLength(1);
    expect(trackingRequests[0]?.init?.headers).toMatchObject({
      authorization: "Bearer token",
      "content-type": "application/json",
      "x-locale": "en_US",
    });
    expect(JSON.parse(String(trackingRequests[0]?.init?.body))).toEqual({
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: "541114253561" } }],
    });
    expect(listPackages(database)[0]?.tracking).toMatchObject({
      statusCode: "IT",
      status: "On the way",
      details: { service: "FedEx Ground" },
      events: [{ description: "On the way" }],
    });

    await refreshFedexTracking({
      database,
      fetchImpl,
      now: 10_000 + trackingIntervalMs,
      config,
    });
    expect(
      requests.filter((request) => request.url.endsWith("/track/v1/trackingnumbers"))
    ).toHaveLength(2);
    database.close();
  });
});
