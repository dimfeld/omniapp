import webpush from "web-push";
import {
  deleteSubscription,
  listSubscriptions,
  type AmazonWatch,
} from "$lib/server/amazon-watches";

export function pushPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY ?? null;
}

export async function sendPriceAlert(watch: AmazonWatch) {
  const publicKey = pushPublicKey();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({
    title: `${watch.name} is below target`,
    body: `$${(watch.priceCents! / 100).toFixed(2)} on Amazon`,
    url: "/amazon",
    tag: `amazon-${watch.id}`,
  });
  await Promise.all(
    listSubscriptions().map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription as webpush.PushSubscription, payload);
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "statusCode" in error &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          deleteSubscription(endpoint);
        }
      }
    })
  );
}
