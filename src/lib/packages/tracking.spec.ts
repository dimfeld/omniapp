import { describe, expect, it } from "vitest";
import { inferTrackingDetails } from "./tracking";

describe("inferTrackingDetails", () => {
  it.each([
    [
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223856928491",
      { carrier: "usps", trackingNumber: "9400111899223856928491" },
    ],
    [
      "https://www.ups.com/track?tracknum=1Z999AA10123456784",
      { carrier: "ups", trackingNumber: "1Z999AA10123456784" },
    ],
    [
      "https://www.fedex.com/fedextrack/?trknbr=541114253561",
      { carrier: "fedex", trackingNumber: "541114253561" },
    ],
    [
      "https://www.fedex.com/apps/fedextrack/?tracknumbers=541114253561",
      { carrier: "fedex", trackingNumber: "541114253561" },
    ],
    [
      "https://www.dhl.com/global-en/home/tracking.html?tracking-id=JD014600006281234567",
      { carrier: "dhl", trackingNumber: "JD014600006281234567" },
    ],
    [
      "https://www.ontrac.com/tracking/?number=C1234567890",
      { carrier: "ontrac", trackingNumber: "C1234567890" },
    ],
  ])("infers %s", (url, expected) => {
    expect(inferTrackingDetails(url)).toEqual(expected);
  });

  it("keeps unknown links custom", () => {
    expect(inferTrackingDetails("https://example.com/track?id=abc123")).toEqual({
      carrier: "custom",
      trackingNumber: "",
    });
  });

  it("can infer a carrier without a tracking number", () => {
    expect(inferTrackingDetails("https://www.fedex.com/en-us/tracking.html")).toEqual({
      carrier: "fedex",
      trackingNumber: "",
    });
  });
});
