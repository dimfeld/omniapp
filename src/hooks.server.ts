import { building } from "$app/environment";
import { startPackageTrackingScheduler } from "$lib/server/package-tracking";
import { startAmazonPriceScheduler } from "$lib/server/amazon-prices";
import type { Handle } from "@sveltejs/kit";

if (!building) {
  startPackageTrackingScheduler();
  startAmazonPriceScheduler();
}

export const handle: Handle = ({ event, resolve }) => resolve(event);
