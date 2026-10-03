import { deleteWatch, updateWatch } from "$lib/server/amazon-watches";
import { refreshAmazonPrices } from "$lib/server/amazon-prices";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async ({ params, request }) => {
  let body: { name?: unknown; target?: unknown; dismiss?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid update." }, { status: 400 });
  }
  const update: { name?: string; targetCents?: number; dismiss?: boolean } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 200)
      return json({ message: "Enter a product name." }, { status: 400 });
    update.name = body.name.trim();
  }
  if (body.target !== undefined) {
    const target = Number(body.target);
    if (!Number.isFinite(target) || target <= 0 || Math.round(target * 100) !== target * 100)
      return json({ message: "Enter a valid USD target." }, { status: 400 });
    update.targetCents = Math.round(target * 100);
  }
  if (body.dismiss !== undefined) {
    if (body.dismiss !== true) return json({ message: "Invalid alert state." }, { status: 400 });
    update.dismiss = true;
  }
  if (!Object.keys(update).length)
    return json({ message: "No update was provided." }, { status: 400 });
  const watch = updateWatch(params.id, update);
  if (!watch) return json({ message: "Watch not found." }, { status: 404 });
  if (update.targetCents !== undefined) await refreshAmazonPrices({ ids: [watch.id] });
  return json(updateWatch(params.id, {}));
};

export const DELETE: RequestHandler = ({ params }) =>
  deleteWatch(params.id)
    ? new Response(null, { status: 204 })
    : json({ message: "Watch not found." }, { status: 404 });
