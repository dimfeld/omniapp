import { db } from "$lib/server/database";

export type FilamentRollRecord = {
  id: string;
  name: string | null;
  material: string;
  color: string;
  initialWeight: number;
  remainingWeight: number;
  lowThreshold: number;
  lowAlertDismissed: boolean;
  addedAt: number;
};

type FilamentRollRow = {
  id: string;
  name: string | null;
  material: string;
  color: string;
  initial_weight: number;
  remaining_weight: number;
  low_threshold: number;
  low_alert_dismissed: number;
  added_at: number;
};

const selectColumns = `
  id, name, material, color, initial_weight, remaining_weight,
  low_threshold, low_alert_dismissed, added_at
`;

function toRecord(row: FilamentRollRow): FilamentRollRecord {
  return {
    id: row.id,
    name: row.name,
    material: row.material,
    color: row.color,
    initialWeight: row.initial_weight,
    remainingWeight: row.remaining_weight,
    lowThreshold: row.low_threshold,
    lowAlertDismissed: row.low_alert_dismissed === 1,
    addedAt: row.added_at,
  };
}

export function listFilamentRolls() {
  return db
    .query<FilamentRollRow, []>(
      `SELECT ${selectColumns} FROM filament_rolls ORDER BY added_at DESC`
    )
    .all()
    .map(toRecord);
}

export function createFilamentRoll(item: FilamentRollRecord) {
  db.run(
    `INSERT INTO filament_rolls
      (id, name, material, color, initial_weight, remaining_weight,
       low_threshold, low_alert_dismissed, added_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name,
      item.material,
      item.color,
      item.initialWeight,
      item.remainingWeight,
      item.lowThreshold,
      item.lowAlertDismissed ? 1 : 0,
      item.addedAt,
    ]
  );
  return item;
}

export function updateFilamentRoll(
  id: string,
  update: { remainingWeight?: number; lowAlertDismissed?: boolean }
) {
  const current = db
    .query<FilamentRollRow, [string]>(`SELECT ${selectColumns} FROM filament_rolls WHERE id = ?`)
    .get(id);
  if (!current) return null;

  const remainingWeight = update.remainingWeight ?? current.remaining_weight;
  const wasLow = current.remaining_weight <= current.low_threshold;
  const isLow = remainingWeight <= current.low_threshold;
  let lowAlertDismissed = update.lowAlertDismissed ?? current.low_alert_dismissed === 1;
  if (!wasLow && isLow) lowAlertDismissed = false;

  db.run(
    `UPDATE filament_rolls
     SET remaining_weight = ?, low_alert_dismissed = ?
     WHERE id = ?`,
    [remainingWeight, lowAlertDismissed ? 1 : 0, id]
  );

  return toRecord({
    ...current,
    remaining_weight: remainingWeight,
    low_alert_dismissed: lowAlertDismissed ? 1 : 0,
  });
}

export function consumeFilamentRolls(items: { id: string; grams: number }[]) {
  db.run("BEGIN IMMEDIATE");
  try {
    const updated: FilamentRollRecord[] = [];
    for (const item of items) {
      const current = db
        .query<FilamentRollRow, [string]>(
          `SELECT ${selectColumns} FROM filament_rolls WHERE id = ?`
        )
        .get(item.id);
      if (!current) throw new Error("ROLL_NOT_FOUND");
      if (item.grams > current.remaining_weight) throw new Error("INSUFFICIENT_FILAMENT");

      const remainingWeight = current.remaining_weight - item.grams;
      const enteredLowState =
        current.remaining_weight > current.low_threshold &&
        remainingWeight <= current.low_threshold;
      const lowAlertDismissed = enteredLowState ? 0 : current.low_alert_dismissed;
      db.run(
        `UPDATE filament_rolls
         SET remaining_weight = ?, low_alert_dismissed = ?
         WHERE id = ?`,
        [remainingWeight, lowAlertDismissed, item.id]
      );
      updated.push(
        toRecord({
          ...current,
          remaining_weight: remainingWeight,
          low_alert_dismissed: lowAlertDismissed,
        })
      );
    }
    db.run("COMMIT");
    return updated;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

export function deleteFilamentRoll(id: string) {
  return db.run("DELETE FROM filament_rolls WHERE id = ?", [id]).changes > 0;
}
