<script lang="ts">
  import JsonTreeNode from "$lib/JsonTreeNode.svelte";
  import { formatJsonKey, formatJsonPrimitive, type OutputSyntax } from "$lib/json";

  let {
    value,
    syntax,
    depth = 0,
    name,
    label = "root",
    last = true,
  }: {
    value: unknown;
    syntax: OutputSyntax;
    depth?: number;
    name?: string;
    label?: string;
    last?: boolean;
  } = $props();

  let expanded = $state(true);
  let stringExpanded = $state(false);
  const container = $derived(value !== null && typeof value === "object");
  const array = $derived(Array.isArray(value));
  const entries = $derived(container ? Object.entries(value as object) : []);
  const prefix = $derived(name === undefined ? "" : `${formatJsonKey(name, syntax)}: `);
  const comma = $derived(depth > 0 && (syntax === "javascript" || !last) ? "," : "");
</script>

{#if container}
  <div class="line" style:--depth={depth}>
    <button
      class="toggle"
      aria-label={`${expanded ? "Collapse" : "Expand"} ${array ? "array" : "object"} at ${label}`}
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}>{expanded ? "▾" : "▸"}</button
    >{prefix}{array ? "[" : "{"}{expanded ? "" : "…"}{expanded ? "" : array ? "]" : "}"}{expanded
      ? ""
      : comma}
  </div>
  {#if expanded}
    {#each entries as [key, item], index (key)}
      <JsonTreeNode
        value={item}
        {syntax}
        depth={depth + 1}
        name={array ? undefined : key}
        label={array ? `${label}[${index}]` : `${label}.${key}`}
        last={index === entries.length - 1}
      />
    {/each}
    <div class="line" style:--depth={depth}>{array ? "]" : "}"}{comma}</div>
  {/if}
{:else if typeof value === "string"}
  <pre class="line string-line" style:--depth={depth}>{prefix}<button
      class="string-toggle"
      aria-label={`${stringExpanded ? "Show escaped" : "Show parsed"} string at ${label}`}
      aria-pressed={stringExpanded}
      onclick={() => (stringExpanded = !stringExpanded)}
      >{stringExpanded ? value : formatJsonPrimitive(value, syntax)}</button
    >{comma}</pre>
{:else}
  <div class="line" style:--depth={depth}>{prefix}{formatJsonPrimitive(value, syntax)}{comma}</div>
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
  .string-line {
    margin: 0;
    font: inherit;
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
