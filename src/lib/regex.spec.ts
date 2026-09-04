import { describe, expect, it } from "vitest";
import { testRegex } from "./regex";

describe("testRegex", () => {
  it("returns the full match and all capture groups", () => {
    expect(testRegex(String.raw`(\w+), (?<last>\w+)`, "Ada, Lovelace", "")).toEqual({
      valid: true,
      matches: [
        {
          full: "Ada, Lovelace",
          index: 0,
          groups: [
            { index: 1, value: "Ada" },
            { index: 2, value: "Lovelace" },
          ],
          namedGroups: [{ name: "last", value: "Lovelace" }],
        },
      ],
    });
  });

  it("returns every match when the global flag is enabled", () => {
    const result = testRegex(String.raw`(\w+)`, "one two", "g");

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.matches.map((match) => [match.full, match.index])).toEqual([
        ["one", 0],
        ["two", 4],
      ]);
    }
  });

  it("keeps unmatched optional groups visible", () => {
    const result = testRegex(String.raw`(a)?b`, "b", "");

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.matches[0]?.groups).toEqual([{ index: 1, value: null }]);
  });

  it("handles empty global matches without looping forever", () => {
    const result = testRegex(String.raw`a*`, "bb", "g");

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.matches.map((match) => match.index)).toEqual([0, 1, 2]);
  });

  it("returns regular expression errors", () => {
    expect(testRegex("[", "text", "")).toMatchObject({ valid: false, matches: [] });
  });
});
