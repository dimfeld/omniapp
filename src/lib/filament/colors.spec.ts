import { describe, expect, it } from "vitest";
import { colorLabel } from "./colors";

describe("colorLabel", () => {
  it("maps palette hex codes to names", () => {
    expect(colorLabel("#f97316")).toBe("Orange");
    expect(colorLabel("#F97316")).toBe("Orange");
  });
  it("returns typed text unchanged", () => {
    expect(colorLabel("Galaxy Black")).toBe("Galaxy Black");
  });
  it("returns empty for custom hex codes and blanks", () => {
    expect(colorLabel("#123456")).toBe("");
    expect(colorLabel("")).toBe("");
  });
});
