export type Carrier = "usps" | "ups" | "fedex" | "dhl" | "ontrac";

export type InferredTracking = {
  carrier: Carrier | "custom";
  trackingNumber: string;
};

const carrierDomains: { carrier: Carrier; domain: string }[] = [
  { carrier: "usps", domain: "usps.com" },
  { carrier: "ups", domain: "ups.com" },
  { carrier: "fedex", domain: "fedex.com" },
  { carrier: "dhl", domain: "dhl.com" },
  { carrier: "ontrac", domain: "ontrac.com" },
];

const trackingParameterNames = [
  "trackingnumber",
  "tracking-id",
  "trackingid",
  "tracknum",
  "tracknumbers",
  "trknbr",
  "tlabels",
  "number",
];

function carrierForHost(hostname: string): Carrier | undefined {
  return carrierDomains.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`))
    ?.carrier;
}

function trackingNumberFromPath(url: URL, carrier: Carrier | undefined): string {
  if (carrier !== "usps") return "";

  return url.pathname.match(/^\/tracking\/(\d{22})\/?$/)?.[1] ?? "";
}

export function inferTrackingDetails(value: string): InferredTracking {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { carrier: "custom", trackingNumber: "" };
  }

  const carrier = carrierForHost(url.hostname.toLowerCase());
  const trackingNumber =
    [...url.searchParams.entries()]
      .find(([name, parameterValue]) => {
        return trackingParameterNames.includes(name.toLowerCase()) && parameterValue.trim();
      })?.[1]
      .trim() ?? trackingNumberFromPath(url, carrier);

  return { carrier: carrier ?? "custom", trackingNumber };
}
