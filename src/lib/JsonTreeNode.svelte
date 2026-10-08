<script lang="ts">
  import JsonTreeNode from "$lib/JsonTreeNode.svelte";
  import { CustomValue, formatValue } from "$lib/devalue";
  import { formatJsonKey, formatJsonPrimitive, type OutputSyntax } from "$lib/json";

  type Child = { key: string; prefix?: string; value: unknown; label: string };
  type Container = { open: string; close: string; noun: string; children: Child[] };

  let {
    value,
    syntax,
    depth = 0,
    name,
    prefix: customPrefix,
    label = "root",
    last = true,
    ancestors = [],
  }: {
    value: unknown;
    syntax: OutputSyntax;
    depth?: number;
    name?: string;
    /** Text shown before the value instead of the formatted `name`. */
    prefix?: string;
    label?: string;
    last?: boolean;
    /** Objects that contain this value, used to detect cycles. */
    ancestors?: object[];
  } = $props();

  let expanded = $state(true);
  let stringExpanded = $state(false);

  function describe(): Container | undefined {
    if (value === null || typeof value !== "object" || ancestors.includes(value)) return undefined;
    if (Array.isArray(value)) {
      const children = Object.entries(value).map(([key, item]) => ({
        key,
        value: item,
        label: `${label}[${key}]`,
      }));
      return { open: "[", close: "]", noun: "array", children };
    }
    if (value instanceof Map) {
      const children = [...value].map(([key, item], index) => ({
        key: String(index),
        prefix: `${formatValue(key)} => `,
        value: item,
        label: `${label}.get(${formatValue(key)})`,
      }));
      return { open: `Map(${value.size}) {`, close: "}", noun: "map", children };
    }
    if (value instanceof Set) {
      const children = [...value].map((item, index) => ({
        key: String(index),
        value: item,
        label: `${label}[${index}]`,
      }));
      return { open: `Set(${value.size}) [`, close: "]", noun: "set", children };
    }
    if (value instanceof CustomValue) {
      if (value.value === null || typeof value.value !== "object") return undefined;
      const children = [{ key: "value", value: value.value, label: `${label}.value` }];
      return { open: `${value.type}(`, close: ")", noun: value.type, children };
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const children = Object.entries(value).map(([key, item]) => ({
      key,
      prefix: `${formatJsonKey(key, syntax)}: `,
      value: item,
      label: `${label}.${key}`,
    }));
    return { open: "{", close: "}", noun: "object", children };
  }

  function formatLeaf() {
    if (value !== null && typeof value === "object" && ancestors.includes(value)) {
      return "[Circular]";
    }
    if (value === null || typeof value === "boolean") return formatJsonPrimitive(value, syntax);
    if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) {
      return formatJsonPrimitive(value, syntax);
    }
    return formatValue(value);
  }

  const container = $derived(describe());
  const childAncestors = $derived(container ? [...ancestors, value as object] : ancestors);
  const prefix = $derived(
    customPrefix ?? (name === undefined ? "" : `${formatJsonKey(name, syntax)}: `)
  );
  const comma = $derived(depth > 0 && (syntax === "javascript" || !last) ? "," : "");
</script>

{#if container}
  <div class="line" style:--depth={depth}>
    <button
      class="toggle"
      aria-label={`${expanded ? "Collapse" : "Expand"} ${container.noun} at ${label}`}
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}>{expanded ? "▾" : "▸"}</button
    >{prefix}{container.open}{expanded ? "" : "…"}{expanded ? "" : container.close}{expanded
      ? ""
      : comma}
  </div>
  {#if expanded}
    {#each container.children as child, index (child.key)}
      <JsonTreeNode
        value={child.value}
        {syntax}
        depth={depth + 1}
        prefix={child.prefix ?? ""}
        label={child.label}
        last={index === container.children.length - 1}
        ancestors={childAncestors}
      />
    {/each}
    <div class="line" style:--depth={depth}>{container.close}{comma}</div>
  {/if}
{:else if typeof value === "string"}
  {#if stringExpanded}
    <div>
      <div class="line parsed-heading" style:--depth={depth}>
        {prefix}<button
          class="show-escaped"
          aria-label={`Show escaped string at ${label}`}
          onclick={() => (stringExpanded = false)}>Escaped</button
        >
      </div>
      <pre class="line parsed-value" style:--depth={depth + 1}>{value}</pre>
      {#if comma}<div class="line" style:--depth={depth}>{comma}</div>{/if}
    </div>
  {:else}
    <div class="line" style:--depth={depth}>
      {prefix}<button
        class="string-toggle"
        aria-label={`Show parsed string at ${label}`}
        onclick={() => (stringExpanded = true)}>{formatJsonPrimitive(value, syntax)}</button
      >{comma}
    </div>
  {/if}
{:else}
  <div class="line" style:--depth={depth}>{prefix}{formatLeaf()}{comma}</div>
{/if}

<style>
  .line {
    position: relative;
    min-height: 1.6em;
    padding-left: calc(var(--depth) * 2ch + 18px);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .toggle {
    position: absolute;
    left: calc(var(--depth) * 2ch);
    width: 18px;
    height: 1.6em;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }
  .toggle:hover {
    color: var(--ink);
  }
  .toggle:focus-visible {
    outline: 2px solid var(--green);
    outline-offset: -2px;
  }
  .parsed-value {
    margin: 0;
    font: inherit;
  }
  .parsed-heading {
    padding-right: 7ch;
  }
  .show-escaped {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0 4px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--paper);
    color: var(--muted);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .show-escaped:hover {
    color: var(--ink);
  }
  .string-toggle {
    display: inline;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    cursor: pointer;
  }
  .string-toggle:hover {
    text-decoration: underline;
  }
  .string-toggle:focus-visible {
    outline: 2px solid var(--green);
  }
</style>
