import type { PackageTrackingDetails, PackageTrackingLocation } from "$lib/packages/types";
import type { TrackingUpdate } from "$lib/server/packages";

type JsonObject = Record<string, unknown>;

export type FedexConfig = {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
};

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type CachedToken = {
  key: string;
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function location(value: unknown): PackageTrackingLocation | null {
  const item = object(value);
  const result = {
    city: string(item.city),
    stateOrProvinceCode: string(item.stateOrProvinceCode),
    postalCode: string(item.postalCode),
    countryCode: string(item.countryCode),
  };
  return Object.values(result).some(Boolean) ? result : null;
}

function nestedLocation(value: unknown): PackageTrackingLocation | null {
  const item = object(value);
  return (
    location(item.address) ??
    location(object(item.locationContactAndAddress).address) ??
    location(item)
  );
}

function firstDateAndTime(trackResult: JsonObject, types: string[]) {
  for (const type of types) {
    const match = array(trackResult.dateAndTimes)
      .map(object)
      .find((item) => string(item.type) === type);
    const value = string(match?.dateTime);
    if (value) return value;
  }
  return null;
}

function errorMessage(value: unknown, fallback: string) {
  const item = object(value);
  const errors = array(item.errors).map(object);
  const notifications = array(item.notifications).map(object);
  return (
    string(item.message) ||
    string(errors[0]?.message) ||
    string(notifications[0]?.message) ||
    fallback
  );
}

async function responseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return {};
  }
}

async function accessToken(
  config: FedexConfig,
  fetchImpl: FetchFunction,
  now: number
): Promise<string> {
  const cacheKey = `${config.apiBaseUrl}\n${config.clientId}`;
  if (cachedToken?.key === cacheKey && cachedToken.expiresAt > now) return cachedToken.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetchImpl(`${config.apiBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(data, `FedEx authorization failed (${response.status}).`));

  const token = string(object(data).access_token);
  const expiresIn = Number(object(data).expires_in);
  if (!token) throw new Error("FedEx authorization did not return an access token.");

  cachedToken = {
    key: cacheKey,
    token,
    expiresAt: now + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 0),
  };
  return token;
}

function normalizeTrackResult(trackResultValue: unknown): TrackingUpdate {
  const trackResult = object(trackResultValue);
  const latestStatus = object(trackResult.latestStatusDetail);
  const window = object(object(trackResult.estimatedDeliveryTimeWindow).window);
  const scanEvents = array(trackResult.scanEvents).map(object);
  const events = scanEvents.map((scanEvent) => {
    const eventLocation = location(scanEvent.scanLocation);
    const occurredAt = string(scanEvent.date);
    const code = string(scanEvent.eventType);
    const description =
      string(scanEvent.eventDescription) || string(scanEvent.exceptionDescription) || code;
    const locationKey = eventLocation ? Object.values(eventLocation).join("|") : "";
    return {
      id: [occurredAt, code, description, locationKey].join("\u001f"),
      occurredAt,
      code,
      description,
      location: eventLocation,
      details: scanEvent,
    };
  });
  events.sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
    return b.occurredAt.localeCompare(a.occurredAt);
  });

  const statusCode = string(latestStatus.code) || string(latestStatus.derivedCode);
  const status =
    string(latestStatus.statusByLocale) || string(latestStatus.description) || statusCode;
  const description =
    string(latestStatus.description) === status ? "" : string(latestStatus.description);
  const estimatedDate = firstDateAndTime(trackResult, ["ESTIMATED_DELIVERY", "COMMITMENT"]);
  const deliveryDetails = object(trackResult.deliveryDetails);
  const packageDetails = object(trackResult.packageDetails);
  const serviceDetail = object(trackResult.serviceDetail);
  const details: PackageTrackingDetails = {
    service: string(serviceDetail.description) || string(serviceDetail.type),
    packageType:
      string(packageDetails.packagingDescription) || string(packageDetails.packagingType),
    origin:
      nestedLocation(trackResult.originLocation) ?? nestedLocation(trackResult.shipperInformation),
    destination:
      nestedLocation(trackResult.destinationLocation) ??
      nestedLocation(trackResult.recipientInformation) ??
      nestedLocation(deliveryDetails.actualDeliveryAddress),
    signedBy: string(deliveryDetails.receivedByName) || string(deliveryDetails.signedByName),
  };
  const complete =
    statusCode === "DL" ||
    string(latestStatus.derivedCode) === "DL" ||
    status.toLowerCase() === "delivered";

  return {
    statusCode,
    status,
    description,
    estimatedDeliveryStart: string(window.begins) || estimatedDate,
    estimatedDeliveryEnd: string(window.ends) || estimatedDate,
    lastUpdatedAt: events[0]?.occurredAt ?? firstDateAndTime(trackResult, ["ACTUAL_DELIVERY"]),
    complete,
    details,
    events,
    response: trackResult,
  };
}

export async function getFedexTracking(
  trackingNumbers: string[],
  config: FedexConfig,
  options: { fetchImpl?: FetchFunction; now?: number } = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now();
  const token = await accessToken(config, fetchImpl, now);
  const response = await fetchImpl(`${config.apiBaseUrl}/track/v1/trackingnumbers`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-locale": "en_US",
    },
    body: JSON.stringify({
      includeDetailedScans: true,
      trackingInfo: trackingNumbers.map((trackingNumber) => ({
        trackingNumberInfo: { trackingNumber },
      })),
    }),
  });
  const data = await responseJson(response);
  if (!response.ok)
    throw new Error(errorMessage(data, `FedEx tracking failed (${response.status}).`));

  const results = new Map<string, TrackingUpdate>();
  const completeResults = array(object(object(data).output).completeTrackResults).map(object);
  for (const [completeIndex, completeResult] of completeResults.entries()) {
    const fallbackNumber = string(completeResult.trackingNumber) || trackingNumbers[completeIndex];
    for (const trackResult of array(completeResult.trackResults)) {
      const item = object(trackResult);
      const trackingNumber =
        string(object(item.trackingNumberInfo).trackingNumber) || fallbackNumber;
      if (trackingNumber && !results.has(trackingNumber)) {
        results.set(trackingNumber, normalizeTrackResult(item));
      }
    }
  }

  return results;
}

export function resetFedexTokenCache() {
  cachedToken = null;
}
