import { deleteFilamentRoll, updateFilamentRoll } from "$lib/server/filament";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = (await request.json()) as {
    remainingWeight?: number;
    lowAlertDismissed?: boolean;
  };
  if (body.remainingWeight === undefined && body.lowAlertDismissed === undefined) {
    return json({ message: "No roll update was provided." }, { status: 400 });
  }
  if (
    body.remainingWeight !== undefined &&
    (typeof body.remainingWeight !== "number" ||
      !Number.isFinite(body.remainingWeight) ||
      body.remainingWeight < 0)
  ) {
    return json({ message: "Enter a valid remaining weight." }, { status: 400 });
  }
  if (body.lowAlertDismissed !== undefined && typeof body.lowAlertDismissed !== "boolean") {
    return json({ message: "Invalid alert state." }, { status: 400 });
  }

  const updated = updateFilamentRoll(params.id, body);
  if (!updated) return json({ message: "Roll not found." }, { status: 404 });
  return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
  if (!deleteFilamentRoll(params.id)) {
    return json({ message: "Roll not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
};
