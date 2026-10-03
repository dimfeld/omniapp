import { listActiveAlerts } from "$lib/server/amazon-watches";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => json(listActiveAlerts());
