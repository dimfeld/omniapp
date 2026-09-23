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
});
