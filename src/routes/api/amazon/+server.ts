import { amazonConfigured, refreshAmazonPrices } from "$lib/server/amazon-prices";
import { addWatch, listWatches, parseAmazonAsin } from "$lib/server/amazon-watches";
import { pushPublicKey } from "$lib/server/push";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  json({ watches: listWatches(), configured: amazonConfigured(), pushPublicKey: pushPublicKey() });

export const POST: RequestHandler = async ({ request }) => {
  let body: { url?: unknown; name?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: "Enter valid watch details." }, { status: 400 });
  }
  const asin = typeof body.url === "string" ? parseAmazonAsin(body.url) : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const target = Number(body.target);
  if (
    !asin ||
    !Number.isFinite(target) ||
    target <= 0 ||
    Math.round(target * 100) !== target * 100 ||
    name.length > 200
  ) {
    return json(
      { message: "Enter an Amazon.com product link or ASIN and a valid USD target." },
      { status: 400 }
    );
  }
  try {
    const watch = addWatch(asin, name || asin, Math.round(target * 100));
    await refreshAmazonPrices({ ids: [watch.id] });
    return json(
      listWatches().find((item) => item.id === watch.id),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint"))
      return json({ message: "This product is already watched." }, { status: 409 });
    throw error;
  }
};
