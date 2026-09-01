import { createPackage, listPackages, type PackageRecord } from "$lib/server/packages";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const allowedCarriers = new Set(["usps", "ups", "fedex", "dhl", "ontrac", "custom"]);

export const GET: RequestHandler = () => json(listPackages());

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as Partial<PackageRecord>;
  const name = body.name?.trim();
  const trackingUrl = body.trackingUrl?.trim();
  const carrier = body.carrier?.trim();

  if (!name || !trackingUrl || !carrier || !allowedCarriers.has(carrier)) {
    return json({ message: "Invalid package details." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trackingUrl);
  } catch {
    return json({ message: "Invalid tracking URL." }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return json({ message: "Invalid tracking URL." }, { status: 400 });
  }

  const item: PackageRecord = {
    id: crypto.randomUUID(),
    name,
    carrier,
    trackingNumber: body.trackingNumber?.trim() ?? "",
    trackingUrl: parsedUrl.toString(),
    delivered: false,
    addedAt: Date.now(),
  };

  return json(createPackage(item), { status: 201 });
};
