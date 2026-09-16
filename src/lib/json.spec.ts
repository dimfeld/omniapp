import { describe, expect, it } from "vitest";
import { formatJson } from "./json";

describe("JSON formatting", () => {
  it("accepts JavaScript object syntax and outputs valid JSON", () => {
    const input = "{ // comment\n name: 'example', values: [0xff, .5,], }";
    expect(formatJson(input, "json")).toBe(
      '{\n  "name": "example",\n  "values": [\n    255,\n    0.5\n  ]\n}'
    );
    expect(formatJson(input, "json", true)).toBe('{"name":"example","values":[255,0.5]}');
  });

  it("formats nested JavaScript output with trailing commas", () => {
    expect(formatJson('{"items":[{"ok":true}],"empty":{}}', "javascript")).toBe(
      "{\n  items: [\n    {\n      ok: true,\n    },\n  ],\n  empty: {},\n}"
    );
    expect(formatJson('{"items":[1,2],"empty":[]}', "javascript", true)).toBe(
      "{items:[1,2,],empty:[],}"
    );
  });

  it("quotes only keys that cannot be JavaScript identifiers", () => {
    const input = '{"normal":1,"$key":2,"café":3,"default":4,"a-b":5,"1key":6,"":7}';
    expect(formatJson(input, "javascript", true)).toBe(
      '{normal:1,$key:2,café:3,default:4,"a-b":5,"1key":6,"":7,}'
    );
  });

  it("preserves strings, primitives, and JavaScript number literals", () => {
    expect(formatJson("{text: 'a\\nb', value: NaN, other: Infinity}", "javascript", true)).toBe(
      '{text:"a\\nb",value:NaN,other:Infinity,}'
    );
    expect(formatJson("null", "javascript")).toBe("null");
    expect(formatJson('"hello"', "json")).toBe('"hello"');
  });

  it("rejects invalid input and code expressions", () => {
    expect(() => formatJson("{broken:", "json")).toThrow();
    expect(() => formatJson("{value: (() => 1)()}", "javascript")).toThrow();
  });
});
