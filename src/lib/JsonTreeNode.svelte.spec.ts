import { page } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import JsonTreeNode from "./JsonTreeNode.svelte";

describe("JSON tree", () => {
  it("collapses and expands nested branches independently", async () => {
    render(JsonTreeNode, {
      value: { first: { value: 1 }, second: [2] },
      syntax: "json",
    });

    const object = page.getByRole("button", { name: "Collapse object at root.first" });
    await expect.element(page.getByText('"value": 1')).toBeInTheDocument();
    await expect.element(page.getByText("2")).toBeInTheDocument();

    await object.click();
    await expect.element(page.getByText('"value": 1')).not.toBeInTheDocument();
    await expect.element(page.getByText("2")).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Expand object at root.first" }))
      .toHaveAttribute("aria-expanded", "false");

    await page.getByRole("button", { name: "Expand object at root.first" }).click();
    await expect.element(page.getByText('"value": 1')).toBeInTheDocument();

    await page.getByRole("button", { name: "Collapse array at root.second" }).click();
    await expect.element(page.getByText("2")).not.toBeInTheDocument();
    await expect.element(page.getByText('"value": 1')).toBeInTheDocument();
  });

  it("wraps a long string within the output width", () => {
    render(JsonTreeNode, {
      value: "a".repeat(200),
      syntax: "json",
    });

    const line = document.querySelector<HTMLElement>(".line");
    expect(line).not.toBeNull();
    line!.style.width = "160px";
    line!.style.lineHeight = "20px";
    expect(line!.getBoundingClientRect().height).toBeGreaterThan(20);
    expect(line!.scrollWidth).toBe(line!.clientWidth);
  });

  it("toggles a string between escaped and parsed text", async () => {
    render(JsonTreeNode, {
      value: { message: "first\n\tsecond" },
      syntax: "json",
    });

    expect(document.querySelector(".string-toggle")?.textContent).toBe('"first\\n\\tsecond"');

    await page.getByRole("button", { name: "Show parsed string at root.message" }).click();
    const parsed = document.querySelector<HTMLElement>("pre.parsed-value");
    expect(parsed?.textContent).toBe("first\n\tsecond");
    parsed?.click();
    expect(document.querySelector("pre.parsed-value")?.textContent).toBe("first\n\tsecond");

    await page.getByRole("button", { name: "Show escaped string at root.message" }).click();
    expect(document.querySelector(".string-toggle")?.textContent).toBe('"first\\n\\tsecond"');
  });

  it("renders devalue types such as Map, Set, Date, BigInt, and cycles", async () => {
    const value: Record<string, unknown> = {
      map: new Map([["a", 1n]]),
      set: new Set([undefined]),
      date: new Date(0),
    };
    value.self = value;
    render(JsonTreeNode, { value, syntax: "javascript" });

    await expect.element(page.getByText("map: Map(1) {")).toBeInTheDocument();
    await expect.element(page.getByText('"a" => 1n,')).toBeInTheDocument();
    await expect.element(page.getByText("set: Set(1) [")).toBeInTheDocument();
    await expect.element(page.getByText("undefined,")).toBeInTheDocument();
    await expect
      .element(page.getByText('date: new Date("1970-01-01T00:00:00.000Z"),'))
      .toBeInTheDocument();
    await expect.element(page.getByText("self: [Circular],")).toBeInTheDocument();

    await page.getByRole("button", { name: "Collapse map at root.map" }).click();
    await expect.element(page.getByText('"a" => 1n,')).not.toBeInTheDocument();
  });
});
