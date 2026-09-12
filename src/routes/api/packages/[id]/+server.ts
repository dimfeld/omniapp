import {
  allowedCarriers,
  deletePackage,
  normalizeExpectedDeliveryDate,
  normalizeTrackingUrl,
  updatePackage,
  type PackageUpdate,
} from "$lib/server/packages";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    name?: string;
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    delivered?: boolean;
    expectedDeliveryDate?: string | null;
  };

  const update: PackageUpdate = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return json({ message: "Invalid package name." }, { status: 400 });
    update.name = name;
  }

  if (body.carrier !== undefined) {
    const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
    if (!allowedCarriers.has(carrier))
      return json({ message: "Invalid carrier." }, { status: 400 });
    update.carrier = carrier;
  }

  if (body.trackingNumber !== undefined) {
    if (typeof body.trackingNumber !== "string") {
      return json({ message: "Invalid tracking number." }, { status: 400 });
    }
    update.trackingNumber = body.trackingNumber.trim();
  }

  if (body.trackingUrl !== undefined) {
    const trackingUrl =
      typeof body.trackingUrl === "string"
        ? normalizeTrackingUrl(body.trackingUrl.trim())
        : undefined;
    if (!trackingUrl) return json({ message: "Invalid tracking URL." }, { status: 400 });
    update.trackingUrl = trackingUrl;
  }

  if (body.delivered !== undefined) {
    if (body.delivered !== true)
      return json({ message: "Invalid delivery status." }, { status: 400 });
    update.delivered = true;
  }

  if (body.expectedDeliveryDate !== undefined) {
    const expectedDeliveryDate = normalizeExpectedDeliveryDate(body.expectedDeliveryDate);
    if (expectedDeliveryDate === undefined) {
      return json({ message: "Invalid expected delivery date." }, { status: 400 });
    }
    update.expectedDeliveryDate = expectedDeliveryDate;
  }

  if (!Object.keys(update).length) {
    return json({ message: "No package update was provided." }, { status: 400 });
  }

  const updated = updatePackage(params.id, update);
  if (!updated) return json({ message: "Package not found." }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
  if (!deletePackage(params.id)) {
    return json({ message: "Package not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
};
