import { deletePackage, markPackageDelivered } from "$lib/server/packages";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = ({ params }) => {
  if (!markPackageDelivered(params.id)) {
    return json({ message: "Package not found." }, { status: 404 });
  }
  return json({ delivered: true });
};

export const DELETE: RequestHandler = ({ params }) => {
  if (!deletePackage(params.id)) {
    return json({ message: "Package not found." }, { status: 404 });
  }
  return new Response(null, { status: 204 });
};
