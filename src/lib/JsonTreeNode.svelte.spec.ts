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

    const string = document.querySelector("pre.string-line");
    expect(string?.textContent).toBe('"message": "first\\n\\tsecond"');

    await page.getByRole("button", { name: "Show parsed string at root.message" }).click();
    expect(string?.textContent).toBe('"message": first\n\tsecond');
    await expect
      .element(page.getByRole("button", { name: "Show escaped string at root.message" }))
      .toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Show escaped string at root.message" }).click();
    expect(string?.textContent).toBe('"message": "first\\n\\tsecond"');
  });
});
