import { describe, expect, it } from "vitest";
import { decodeUuid } from "./uuid";

describe("decodeUuid", () => {
  it("decodes standard fields and the UUID version", () => {
    const result = decodeUuid("550e8400-e29b-41d4-a716-446655440000");

    expect(result).toMatchObject({
      valid: true,
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      version: 4,
      variant: "RFC 9562",
      bytes: "55 0e 84 00 e2 9b 41 d4 a7 16 44 66 55 44 00 00",
    });
    if (result?.valid) {
      expect(result.fields.slice(0, 6)).toEqual([
        { label: "Time low", value: "550e8400" },
        { label: "Time mid", value: "e29b" },
        { label: "Time high + version", value: "41d4" },
        { label: "Clock sequence high + variant", value: "a7" },
        { label: "Clock sequence low", value: "16" },
        { label: "Node", value: "446655440000" },
      ]);
    }
  });

  it("decodes timestamps from version 1 and version 7 UUIDs", () => {
    const v1Result = decodeUuid("f81d4fae-7dec-11d0-a765-00a0c91e6bf6");
    const v7Result = decodeUuid("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");

    expect(v1Result?.valid && v1Result.fields.at(-2)?.label).toBe("Timestamp");
    expect(v7Result?.valid && v7Result.fields.at(-2)?.label).toBe("Timestamp");
  });

  it("reports invalid UUID input", () => {
    expect(decodeUuid("not-a-uuid")).toEqual({
      valid: false,
      error: "Enter a valid UUID in the form xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
    });
  });
});
