export type FilamentUse = {
  label: string;
  grams: number;
  source: "weight" | "volume" | "length";
};

function numbers(value: string) {
  return value
    .split(/[,;]/)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part) && part > 0);
}

function metadataValues(text: string, key: string, fallback: number) {
  const match = text.match(new RegExp(`^;\\s*${key}\\s*=\\s*(.+)$`, "im"));
  return match ? numbers(match[1]) : [fallback];
}

function valueForIndex(values: number[], index: number) {
  return values[index] ?? values[0];
}

function asUses(
  values: number[],
  source: FilamentUse["source"],
  toGrams = (value: number) => value
) {
  return values.map((value, index) => ({
    label: values.length > 1 ? `Filament ${index + 1}` : "Print filament",
    grams: Math.round(toGrams(value) * 10) / 10,
    source,
  }));
}

export function parseGcodeFilament(text: string): FilamentUse[] {
  const weightMatch = text.match(/^;\s*(?:total\s+)?filament used \[g\]\s*=\s*(.+)$/im);
  if (weightMatch) return asUses(numbers(weightMatch[1]), "weight");

  const volumeMatch = text.match(/^;\s*(?:total\s+)?filament used \[cm3\]\s*=\s*(.+)$/im);
  if (volumeMatch) {
    const densities = metadataValues(text, "filament_density", 1.24);
    return numbers(volumeMatch[1]).map((value, index, values) => ({
      label: values.length > 1 ? `Filament ${index + 1}` : "Print filament",
      grams: Math.round(value * valueForIndex(densities, index) * 10) / 10,
      source: "volume",
    }));
  }

  const lengthMatch = text.match(/^;\s*(?:total\s+)?filament used \[mm\]\s*=\s*(.+)$/im);
  if (lengthMatch) {
    const diameters = metadataValues(text, "filament_diameter", 1.75);
    const densities = metadataValues(text, "filament_density", 1.24);
    return numbers(lengthMatch[1]).map((length, index, values) => {
      const radius = valueForIndex(diameters, index) / 2;
      const cubicCentimetres = (Math.PI * radius * radius * length) / 1000;
      return {
        label: values.length > 1 ? `Filament ${index + 1}` : "Print filament",
        grams: Math.round(cubicCentimetres * valueForIndex(densities, index) * 10) / 10,
        source: "length",
      };
    });
  }

  const curaMatch = text.match(/^;\s*filament used:\s*([\d.]+)\s*m\s*$/im);
  if (curaMatch) {
    const metres = Number.parseFloat(curaMatch[1]);
    const radius = 1.75 / 2;
    const grams = (Math.PI * radius * radius * metres * 1000 * 1.24) / 1000;
    return asUses([grams], "length");
  }

  return [];
}
