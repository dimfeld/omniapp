import { describe, expect, it } from "vitest";
import { decodeHtml, decodeUrl, encodeHtml, encodeUrl } from "./encoding";

describe("text encoding", () => {
  it("encodes and decodes URL components", () => {
    expect(encodeUrl("hello world & friends")).toBe("hello%20world%20%26%20friends");
    expect(decodeUrl("hello%20world%20%26%20friends")).toBe("hello world & friends");
  });

  it("encodes and decodes HTML entities", () => {
    expect(encodeHtml("<p>Tom & Jerry</p>")).toBe("&lt;p&gt;Tom &amp; Jerry&lt;/p&gt;");
    expect(decodeHtml("&lt;p&gt;Tom &amp; Jerry&lt;/p&gt;")).toBe("<p>Tom & Jerry</p>");
  });
});
