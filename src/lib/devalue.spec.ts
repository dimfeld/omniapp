import { stringify } from "devalue";
import { describe, expect, it } from "vitest";
import {
  CustomValue,
  decodeDevalue,
  encodeBase64Text,
  encodeDevalue,
  formatValue,
  parseDevalue,
} from "./devalue";

describe("devalue", () => {
  it("encodes JavaScript expressions", () => {
    expect(encodeDevalue("{ a: 1n, d: new Date(0), s: new Set([1]) }")).toBe(
      stringify({ a: 1n, d: new Date(0), s: new Set([1]) })
    );
  });

  it("encodes to Base64", () => {
    expect(encodeDevalue("[1, 2]", true)).toBe(encodeBase64Text(stringify([1, 2])));
  });

  it("decodes plain devalue strings", () => {
    const result = decodeDevalue(stringify({ map: new Map([["a", 1]]) }));
    expect(result.base64).toBe(false);
    expect(result.value).toEqual({ map: new Map([["a", 1]]) });
  });

  it("decodes Base64 input automatically", () => {
    const serialized = stringify({ text: "héllo", n: 5 });
    const result = decodeDevalue(encodeBase64Text(serialized));
    expect(result.base64).toBe(true);
    expect(result.value).toEqual({ text: "héllo", n: 5 });
  });

  it("decodes URL-safe Base64 without padding", () => {
    const serialized = stringify({ q: "???>>>" });
    const urlSafe = encodeBase64Text(serialized)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(decodeDevalue(urlSafe).value).toEqual({ q: "???>>>" });
  });

  it("decodes JSON-quoted devalue strings", () => {
    expect(decodeDevalue(JSON.stringify(stringify([1]))).value).toEqual([1]);
  });

  it("rejects input that is neither devalue nor Base64", () => {
    expect(() => decodeDevalue("not valid!")).toThrow();
  });

  it("keeps unknown custom types", () => {
    const serialized = stringify(
      { v: { x: 1 } },
      { Vector: (v) => typeof v === "object" && v !== null && "x" in v && [v.x] }
    );
    const value = parseDevalue(serialized) as { v: CustomValue };
    expect(value.v).toBeInstanceOf(CustomValue);
    expect(value.v.type).toBe("Vector");
  });

  it("formats special values as JavaScript", () => {
    const value: Record<string, unknown> = {
      big: 10n,
      date: new Date(0),
      map: new Map([["k", undefined]]),
      neg: -0,
      "a-b": NaN,
    };
    value.self = value;
    expect(formatValue(value)).toBe(`{
  big: 10n,
  date: new Date("1970-01-01T00:00:00.000Z"),
  map: new Map([
    ["k", undefined],
  ]),
  neg: -0,
  "a-b": NaN,
  self: [Circular],
}`);
  });
});
