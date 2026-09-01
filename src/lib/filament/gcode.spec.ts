import { describe, expect, it } from "vitest";
import { parseGcodeFilament } from "./gcode";

describe("parseGcodeFilament", () => {
  it("reads multiple weight values", () => {
    expect(parseGcodeFilament("; filament used [g] = 12.34, 56.78")).toEqual([
      { label: "Filament 1", grams: 12.3, source: "weight" },
      { label: "Filament 2", grams: 56.8, source: "weight" },
    ]);
  });

  it("converts volume with slicer density metadata", () => {
    expect(parseGcodeFilament("; filament_density = 1.04\n; filament used [cm3] = 10")[0]).toEqual({
      label: "Print filament",
      grams: 10.4,
      source: "volume",
    });
  });

  it("converts length with slicer diameter and density metadata", () => {
    const result = parseGcodeFilament(
      "; filament_diameter = 1.75\n; filament_density = 1.24\n; filament used [mm] = 1000"
    );
    expect(result[0]?.grams).toBeCloseTo(3, 1);
    expect(result[0]?.source).toBe("length");
  });

  it("returns no values for unknown metadata", () => {
    expect(parseGcodeFilament("G1 X20 Y20")).toEqual([]);
  });
});
