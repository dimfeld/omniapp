import { describe, expect, it } from "vitest";
import { generateRandomHex } from "./random";

describe("generateRandomHex", () => {
  it("returns a secure hexadecimal value with the requested length", () => {
    const value = generateRandomHex(33);
    expect(value).toMatch(/^[0-9a-f]{33}$/);
  });

  it("requires a positive whole-number length", () => {
    expect(() => generateRandomHex(0)).toThrow("Length must be a positive whole number.");
    expect(() => generateRandomHex(1.5)).toThrow("Length must be a positive whole number.");
  });
});
