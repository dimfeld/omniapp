<script lang="ts">
  import Icon from "$lib/Icon.svelte";

  let input = $state("");
  let output = $state("");
  let error = $state("");
  let mode = $state<"encode" | "decode">("encode");
  let copied = $state(false);

  function encode(live = false) {
    mode = "encode";
    error = "";
    try {
      const bytes = new TextEncoder().encode(input);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      output = btoa(binary);
    } catch {
      if (live) return;
      output = "";
      error = "This text could not be encoded.";
    }
  }

  function decode(live = false) {
    mode = "decode";
    error = "";
    try {
      const binary = atob(input.replace(/\s/g, ""));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      output = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      if (live) return;
      output = "";
      error = "Enter valid Base64-encoded UTF-8 text.";
    }
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
      <button class="primary" onclick={() => encode()}>Encode</button>
      <button onclick={() => decode()}>Decode</button>
    </div>
    <button
      class="ghost"
      onclick={() => {
        input = "";
        output = "";
        error = "";
      }}>Clear</button
    >
  </div>
  <div class="split">
    <label class="pane">
      <span class="pane-label">Input<em>Text or Base64</em></span>
      <textarea
        bind:value={input}
        oninput={() => (mode === "encode" ? encode(true) : decode(true))}
        spellcheck="false"
        placeholder="Type or paste…"></textarea>
    </label>
    <div class="pane output">
      <span class="pane-label"
        >Output<button onclick={copyOutput} disabled={!output}
          ><Icon name={copied ? "check" : "copy"} />{copied ? "Copied" : "Copy"}</button
        ></span
      >
      {#if error}
        <p class="error">{error}</p>
      {:else}
        <pre class:placeholder={!output}>{output || "Result appears here."}</pre>
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
    pre {
      min-height: 200px;
    }
  }
</style>
