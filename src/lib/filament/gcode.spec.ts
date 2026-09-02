import { describe, expect, it } from "vitest";
import { parseGcodeFilament } from "./gcode";

describe("parseGcodeFilament", () => {
  it("reads multiple weight values", () => {
    expect(parseGcodeFilament("; filament used [g] = 12.34, 56.78")).toEqual([
      { label: "Filament 1", grams: 12.3, source: "weight", type: null, color: null },
      { label: "Filament 2", grams: 56.8, source: "weight", type: null, color: null },
    ]);
  });

  it("reads per-filament type and color metadata", () => {
    expect(
      parseGcodeFilament(
        "; filament_type = PLA; PETG\n; filament_colour = #FF0000; #00FF00\n; filament used [g] = 12, 24"
      )
    ).toEqual([
      { label: "Filament 1", grams: 12, source: "weight", type: "PLA", color: "#FF0000" },
      { label: "Filament 2", grams: 24, source: "weight", type: "PETG", color: "#00FF00" },
    ]);
  });

  it("reuses one metadata value for multiple filaments", () => {
    expect(
      parseGcodeFilament(
        "; filament_type = PLA\n; filament_colour = #FF0000\n; filament used [g] = 12, 24"
      )
    ).toEqual([
      { label: "Filament 1", grams: 12, source: "weight", type: "PLA", color: "#FF0000" },
      { label: "Filament 2", grams: 24, source: "weight", type: "PLA", color: "#FF0000" },
    ]);
  });

  it("converts volume with slicer density metadata", () => {
    expect(parseGcodeFilament("; filament_density = 1.04\n; filament used [cm3] = 10")[0]).toEqual({
      label: "Print filament",
      grams: 10.4,
      source: "volume",
      type: null,
      color: null,
    });
  });

  it("converts length with slicer diameter and density metadata", () => {
    const result = parseGcodeFilament(
      "; filament_diameter = 1.75\n; filament_density = 1.24\n; filament used [mm] = 1000"
    );
    expect(result[0]?.grams).toBeCloseTo(3, 1);
    expect(result[0]?.source).toBe("length");
    expect(result[0]?.type).toBe(null);
    expect(result[0]?.color).toBe(null);
  });

  it("returns no values for unknown metadata", () => {
    expect(parseGcodeFilament("G1 X20 Y20")).toEqual([]);
  });
});
