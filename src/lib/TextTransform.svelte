<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { decodeHtml, decodeUrl, encodeHtml, encodeUrl } from "$lib/encoding";

  type TransformKind = "url" | "html";

  let { kind }: { kind: TransformKind } = $props();
  let input = $state("");
  let output = $state("");
  let error = $state("");
  let operation = $state<"encode" | "decode">("encode");
  let copied = $state(false);

  const config = $derived(
    kind === "url"
      ? {
          title: "URL component",
          hint: "Encode or decode one URL component.",
          encode: encodeUrl,
          decode: decodeUrl,
        }
      : {
          title: "HTML entities",
          hint: "Encode special characters such as <, >, and &.",
          encode: encodeHtml,
          decode: decodeHtml,
        }
  );

  function transform(live = false) {
    error = "";
    try {
      output = config[operation](input);
    } catch {
      output = "";
      if (!live) error = "The input could not be decoded.";
    }
  }

  function selectOperation(next: "encode" | "decode") {
    operation = next;
    transform();
  }

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    copied = true;
    window.setTimeout(() => (copied = false), 1600);
  }

  function clear() {
    input = "";
    output = "";
    error = "";
  }
</script>

<section class="transform-tool">
  <div class="panel toolbar">
    <div class="actions">
      <button
        class:primary={operation === "encode"}
        type="button"
        onclick={() => selectOperation("encode")}>Encode</button
      >
      <button
        class:primary={operation === "decode"}
        type="button"
        onclick={() => selectOperation("decode")}>Decode</button
      >
    </div>
    <span class="hint">{config.hint}</span>
    <button class="ghost" type="button" onclick={clear}>Clear</button>
  </div>

  <div class="panel split">
    <label class="pane">
      <span class="pane-label">Input<em>{input.length} chars</em></span>
      <textarea
        bind:value={input}
        oninput={() => transform(true)}
        spellcheck="false"
        placeholder={`Type or paste ${config.title.toLowerCase()}…`}></textarea>
    </label>
    <div class="pane output">
      <span class="pane-label">
        Output
        <button type="button" onclick={copyOutput} disabled={!output}>
          <Icon name={copied ? "check" : "copy"} />{copied ? "Copied" : "Copy"}
        </button>
      </span>
      {#if error}
        <p class="error" role="alert">{error}</p>
      {:else}
        <pre class:placeholder={!output}>{output || "Result appears here."}</pre>
      {/if}
    </div>
  </div>
</section>

<style>
  .transform-tool {
    max-width: 920px;
    display: grid;
    gap: 12px;
  }
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
    gap: 14px;
  }
  .actions {
    display: flex;
    gap: 6px;
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
  .actions button.primary {
    border-color: var(--ink);
    background: var(--ink);
    color: white;
  }
  .hint {
    flex: 1;
    color: var(--faint);
    font-size: 12px;
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
    min-height: 36px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }
  .pane-label em {
    margin-left: auto;
    color: var(--faint);
    font-style: normal;
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
  @media (max-width: 700px) {
    .toolbar {
      align-items: stretch;
      flex-wrap: wrap;
    }
    .hint {
      width: 100%;
      flex-basis: 100%;
      order: 3;
    }
    .split {
      min-height: 0;
      grid-template-columns: 1fr;
    }
    .pane + .pane {
      border-top: 1px solid var(--line);
      border-left: 0;
    }
    textarea,
    pre {
      min-height: 200px;
    }
  }
</style>
