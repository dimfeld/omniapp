export const filamentPalette = [
  { name: "Black", hex: "#1a1a1a" },
  { name: "White", hex: "#f5f5f5" },
  { name: "Gray", hex: "#8a8a8a" },
  { name: "Silver", hex: "#c0c4c8" },
  { name: "Red", hex: "#d93025" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#f5c400" },
  { name: "Green", hex: "#2e9e4f" },
  { name: "Teal", hex: "#14a3a1" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Brown", hex: "#8b5a2b" },
  { name: "Beige", hex: "#e3d5b8" },
  { name: "Natural", hex: "#ece6d6" },
];

const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string) {
  return hexPattern.test(value.trim());
}

/**
 * Returns a human-readable name for a stored color value.
 * Palette hex codes map to their palette name. Text typed by the user is returned as-is.
 * A custom hex code with no known name returns an empty string.
 */
export function colorLabel(color: string) {
  const trimmed = color.trim();
  if (!trimmed) return "";
  if (!isHexColor(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return filamentPalette.find((item) => item.hex === lower)?.name ?? "";
}
