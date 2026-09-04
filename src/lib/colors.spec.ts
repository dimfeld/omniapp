import { describe, expect, it } from "vitest";
import { getColorConversions, parseColor } from "./colors";

describe("color conversions", () => {
  it("parses CSS colors and returns common color spaces", () => {
    const color = parseColor("#ff0000");
    expect(color?.mode).toBe("rgb");

    const conversions = getColorConversions(color!);
    expect(conversions.map(({ label }) => label)).toEqual([
      "HEX",
      "RGB",
      "HSL",
      "HSV",
      "HWB",
      "Lab (D65)",
      "LCH (D65)",
      "OKLab",
      "OKLCH",
      "XYZ (D65)",
    ]);
    expect(conversions.find(({ label }) => label === "HSL")).toMatchObject({
      css: "hsl(0, 100%, 50%)",
      channels: [
        { label: "H", value: "0°" },
        { label: "S", value: "100%" },
        { label: "L", value: "50%" },
      ],
    });
  });

  it("rejects invalid color text", () => {
    expect(parseColor("not a color")).toBeUndefined();
  });
});
