import { building } from "$app/environment";
import { startPackageTrackingScheduler } from "$lib/server/package-tracking";
import type { Handle } from "@sveltejs/kit";

if (!building) startPackageTrackingScheduler();

export const handle: Handle = ({ event, resolve }) => resolve(event);
