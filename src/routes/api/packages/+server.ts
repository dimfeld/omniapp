import { refreshFedexTracking } from "$lib/server/package-tracking";
import {
  allowedCarriers,
  createPackage,
  getPackage,
  listPackages,
  normalizeExpectedDeliveryDate,
  normalizeTrackingUrl,
  type NewPackageRecord,
  type PackageRecord,
} from "$lib/server/packages";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => json(listPackages());

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as Partial<PackageRecord>;
  const name = body.name?.trim();
  const carrier = body.carrier?.trim();
  const expectedDeliveryDate = normalizeExpectedDeliveryDate(body.expectedDeliveryDate);

  if (!name || !body.trackingUrl?.trim() || !carrier || !allowedCarriers.has(carrier)) {
    return json({ message: "Invalid package details." }, { status: 400 });
  }
  if (expectedDeliveryDate === undefined) {
    return json({ message: "Invalid expected delivery date." }, { status: 400 });
  }

  const trackingUrl = normalizeTrackingUrl(body.trackingUrl.trim());
  if (!trackingUrl) {
    return json({ message: "Invalid tracking URL." }, { status: 400 });
  }

  const item: NewPackageRecord = {
    id: crypto.randomUUID(),
    name,
    carrier,
    trackingNumber: body.trackingNumber?.trim() ?? "",
    trackingUrl,
    expectedDeliveryDate,
    delivered: false,
    addedAt: Date.now(),
  };

  createPackage(item);
  if (item.carrier === "fedex" && item.trackingNumber) {
    await refreshFedexTracking({ ids: [item.id] });
  }

  return json(getPackage(item.id), { status: 201 });
};
