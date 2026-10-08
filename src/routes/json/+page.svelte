<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import JsonTreeNode from "$lib/JsonTreeNode.svelte";
  import { decodeDevalue, encodeDevalue, formatValue } from "$lib/devalue";
  import { formatJsonValue, parseJson, type OutputSyntax } from "$lib/json";

  type Mode = "json" | "devalue-decode" | "devalue-encode";

  let input = $state("");
  let output = $state("");
  let value = $state<unknown>(undefined);
  let error = $state("");
  let format = $state<"pretty" | "minified">("pretty");
  let copied = $state(false);
  let syntax = $state<OutputSyntax>("json");
  let mode = $state<Mode>("json");
  let base64Output = $state(false);
  let decodedBase64 = $state(false);

  const placeholders: Record<Mode, string> = {
    json: "Paste JSON or a JavaScript object…",
    "devalue-decode": "Paste a devalue string or Base64-encoded devalue…",
    "devalue-encode": "Type a JavaScript expression, for example new Map([['a', 1n]])…",
  };
  const helpText: Record<Mode, string> = {
    json: "Accepts comments, single quotes, unquoted keys, and trailing commas. Code expressions are not supported.",
    "devalue-decode":
      "Base64 and URL-safe Base64 input is decoded automatically. Custom types show as Type(value).",
    "devalue-encode":
      "The input is evaluated as a JavaScript expression, so values such as Date, Map, Set, and BigInt are supported.",
  };

  function run(live = false) {
    error = "";
    decodedBase64 = false;
    try {
      if (!input.trim()) {
        value = undefined;
        output = "";
      } else if (mode === "json") {
        value = parseJson(input);
        output = formatJsonValue(value, syntax, format === "minified");
      } else if (mode === "devalue-decode") {
        const result = decodeDevalue(input);
        value = result.value;
        decodedBase64 = result.base64;
        output = formatValue(value);
      } else {
        value = undefined;
        output = encodeDevalue(input, base64Output);
      }
    } catch (cause) {
      if (live) return;
      output = "";
      value = undefined;
      error = cause instanceof Error ? cause.message : "The input is not valid.";
    }
  }

  function formatJson(minified: boolean) {
    format = minified ? "minified" : "pretty";
    run();
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    copied = true;
    window.setTimeout(() => (copied = false), 1600);
  }
</script>

<section class="panel">
  <div class="toolbar">
    <div class="actions">
      <label class="syntax">
        Mode
        <select bind:value={mode} onchange={() => run()}>
          <option value="json">JSON</option>
          <option value="devalue-decode">Devalue decode</option>
          <option value="devalue-encode">Devalue encode</option>
        </select>
      </label>
      {#if mode === "json"}
        <button class="primary" onclick={() => formatJson(false)}>Prettify</button>
        <button onclick={() => formatJson(true)}>Minify</button>
        <label class="syntax">
          Output
          <select bind:value={syntax} onchange={() => run()}>
            <option value="json">JSON</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
      {:else if mode === "devalue-encode"}
        <label class="syntax">
          <input type="checkbox" bind:checked={base64Output} onchange={() => run()} />
          Base64 output
        </label>
      {/if}
    </div>
    <button
      class="ghost"
      onclick={() => {
        input = "";
        output = "";
        value = undefined;
        error = "";
      }}>Clear</button
    >
  </div>
  <div class="split">
    <label class="pane">
      <span class="pane-label">Input<em>{input.length} chars</em></span>
      <textarea
        bind:value={input}
        oninput={() => run(true)}
        spellcheck="false"
        placeholder={placeholders[mode]}></textarea>
      <p class="input-help">{helpText[mode]}</p>
    </label>
    <div class="pane output">
      <span class="pane-label"
        >Output{#if decodedBase64}<em class="note">Decoded from Base64</em>{/if}<button
          onclick={copyOutput}
          disabled={!output}
          ><Icon name={copied ? "check" : "copy"} />{copied ? "Copied" : "Copy"}</button
        ></span
      >
      {#if error}
        <p class="error">{error}</p>
      {:else if mode !== "devalue-encode" && (mode !== "json" || format === "pretty") && output}
        <div class="tree" aria-label="Formatted JSON tree">
          {#key value}
            <JsonTreeNode {value} syntax={mode === "json" ? syntax : "javascript"} />
          {/key}
        </div>
      {:else}
        <pre class:placeholder={!output}>{output || "Formatted output appears here."}</pre>
      {/if}
    </div>
  </div>
</section>

<style>
  .panel {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .toolbar {
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .syntax {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 13px;
  }
  select {
    height: 34px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    color: var(--ink);
  }
  .input-help {
    margin: 0;
    padding: 0 16px 16px;
    color: var(--muted);
    font-size: 12px;
  }
  .actions button {
    height: 34px;
    padding: 0 14px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    font-size: 13px;
    font-weight: 500;
  }
  .actions button:hover {
    border-color: var(--muted);
  }
  .actions .primary {
    border-color: var(--ink);
    background: var(--ink);
    color: white;
  }
  .ghost {
    padding: 6px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
  }
  .ghost:hover {
    background: #eeece4;
    color: var(--ink);
  }
  .split {
    min-height: 420px;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .pane {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .pane + .pane {
    border-left: 1px solid var(--line);
  }
  .pane.output {
    background: #f7f6f0;
  }
  .pane-label {
    height: 36px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }
  .pane-label em {
    color: var(--faint);
    font-style: normal;
  }
  .pane-label .note {
    margin-left: 8px;
    margin-right: auto;
  }
  .pane-label button {
    padding: 4px 0 4px 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: var(--green);
    font-size: 12px;
    font-weight: 600;
  }
  .pane-label button :global(svg) {
    width: 13px;
    height: 13px;
  }
  textarea {
    width: 100%;
    min-height: 320px;
    padding: 4px 16px 16px;
    flex: 1;
    resize: none;
    border: 0;
    outline: 0;
    background: transparent;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
  }
  pre {
    margin: 0;
    padding: 4px 16px 16px;
    flex: 1;
    overflow: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
  }
  .tree {
    padding: 4px 16px 16px;
    flex: 1;
    overflow: auto;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
  }
  pre.placeholder {
    color: var(--faint);
    font-family: inherit;
  }
  .error {
    margin: 12px 16px;
    padding: 10px 12px;
    border: 1px solid #ebc7be;
    border-radius: 6px;
    background: var(--red-soft);
    color: var(--red);
    font-size: 13px;
  }
  @media (max-width: 820px) {
    .split {
      min-height: 0;
      grid-template-columns: 1fr;
    }
    .pane + .pane {
      border-top: 1px solid var(--line);
      border-left: 0;
    }
    textarea,
    pre,
    .tree {
      min-height: 200px;
    }
  }
</style>
