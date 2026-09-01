import {
  consumeFilamentRolls,
  createFilamentRoll,
  listFilamentRolls,
  type FilamentRollRecord,
} from "$lib/server/filament";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export const GET: RequestHandler = () => json(listFilamentRolls());

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as Partial<FilamentRollRecord>;
  const material = body.material?.trim().toUpperCase();
  if (!material || !positiveNumber(body.initialWeight)) {
    return json({ message: "Enter a material and a valid roll weight." }, { status: 400 });
  }

  const lowThreshold = body.lowThreshold ?? 100;
  if (typeof lowThreshold !== "number" || !Number.isFinite(lowThreshold) || lowThreshold < 0) {
    return json({ message: "Enter a valid low-weight threshold." }, { status: 400 });
  }

  const item: FilamentRollRecord = {
    id: crypto.randomUUID(),
    name: body.name?.trim() || null,
    material,
    color: body.color?.trim() || "",
    initialWeight: body.initialWeight!,
    remainingWeight: body.initialWeight!,
    lowThreshold,
    lowAlertDismissed: false,
    addedAt: Date.now(),
  };
  return json(createFilamentRoll(item), { status: 201 });
};

export const PATCH: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { consumptions?: { id?: string; grams?: number }[] };
  if (!Array.isArray(body.consumptions) || body.consumptions.length === 0) {
    return json({ message: "No filament use was provided." }, { status: 400 });
  }
  if (
    body.consumptions.some(
      (item) => !item.id || typeof item.grams !== "number" || !positiveNumber(item.grams)
    )
  ) {
    return json({ message: "Invalid filament use." }, { status: 400 });
  }

  try {
    return json(
      consumeFilamentRolls(body.consumptions.map((item) => ({ id: item.id!, grams: item.grams! })))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ROLL_NOT_FOUND") {
      return json({ message: "A selected roll was not found." }, { status: 404 });
    }
    if (message === "INSUFFICIENT_FILAMENT") {
      return json({ message: "A selected roll does not have enough filament." }, { status: 409 });
    }
    throw error;
  }
};
