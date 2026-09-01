import {
  deletePackage,
  markPackageDelivered,
  updatePackageExpectedDeliveryDate,
} from "$lib/server/packages";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    delivered?: boolean;
    expectedDeliveryDate?: string | null;
  };

  if (body.delivered === undefined && body.expectedDeliveryDate === undefined) {
    return json({ message: "No package update was provided." }, { status: 400 });
  }

  let found = true;
  if (body.delivered !== undefined) {
    if (body.delivered !== true) {
      return json({ message: "Invalid delivery status." }, { status: 400 });
    }
    found = markPackageDelivered(params.id);
  }

  if (body.expectedDeliveryDate !== undefined) {
    if (body.expectedDeliveryDate !== null && typeof body.expectedDeliveryDate !== "string") {
      return json({ message: "Invalid expected delivery date." }, { status: 400 });
    }
    const date = body.expectedDeliveryDate?.trim() || null;
    if (date && !datePattern.test(date)) {
      return json({ message: "Invalid expected delivery date." }, { status: 400 });
    }
    found = updatePackageExpectedDeliveryDate(params.id, date) && found;
  }

  if (!found) {
    return json({ message: "Package not found." }, { status: 404 });
  }
  return json({ updated: true });
};

export const DELETE: RequestHandler = ({ params }) => {
  if (!deletePackage(params.id)) {
    return json({ message: "Package not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
};
