import { saveSubscription } from "$lib/server/amazon-watches";
import { pushPublicKey } from "$lib/server/push";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  if (!pushPublicKey() || !process.env.WEB_PUSH_PRIVATE_KEY || !process.env.WEB_PUSH_SUBJECT) {
    return json({ message: "Push notifications are not configured." }, { status: 503 });
  }
  let subscription: PushSubscriptionJSON & { endpoint?: string };
  try {
    subscription = await request.json();
  } catch {
    return json({ message: "Invalid subscription." }, { status: 400 });
  }
  let host = "";
  try {
    const endpoint = new URL(subscription.endpoint ?? "");
    if (endpoint.protocol === "https:") host = endpoint.hostname;
  } catch {
    /* Invalid endpoint. */
  }
  const allowedHost =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host === "web.push.apple.com" ||
    host.endsWith(".push.apple.com") ||
    host.endsWith(".notify.windows.com");
  if (!allowedHost || !subscription.keys?.p256dh || !subscription.keys.auth) {
    return json({ message: "Invalid subscription." }, { status: 400 });
  }
  saveSubscription(subscription as PushSubscriptionJSON & { endpoint: string });
  return new Response(null, { status: 204 });
};
