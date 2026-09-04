<script lang="ts">
  import { v1, v4, v5, v7 } from "uuid";
  import Icon from "$lib/Icon.svelte";
  import { decodeUuid } from "$lib/uuid";

  type UUIDVersion = "v1" | "v4" | "v5" | "v7";

  const versions: { id: UUIDVersion; label: string; description: string }[] = [
    { id: "v1", label: "v1", description: "Time and node" },
    { id: "v4", label: "v4", description: "Random" },
    { id: "v5", label: "v5", description: "Name and SHA-1" },
    { id: "v7", label: "v7", description: "Unix time and random" },
  ];

  let selectedVersion = $state<UUIDVersion>("v4");
  let name = $state("example.com");
  let namespaceType = $state<"dns" | "url" | "custom">("dns");
  let customNamespace = $state("");
  let generatedUuid = $state("");
  let generationError = $state("");
  let copied = $state(false);
  let decodeInput = $state("");
  const decoded = $derived(decodeUuid(decodeInput));
  const namespace = $derived(
    namespaceType === "dns" ? v5.DNS : namespaceType === "url" ? v5.URL : customNamespace
  );

  function generate() {
    generationError = "";
    try {
      generatedUuid =
        selectedVersion === "v1"
          ? v1()
          : selectedVersion === "v4"
            ? v4()
            : selectedVersion === "v5"
              ? v5(name, namespace)
              : v7();
    } catch (cause) {
      generatedUuid = "";
      generationError = cause instanceof Error ? cause.message : "Could not generate a UUID.";
    }
  }

  function selectNamespace(event: Event) {
    namespaceType = (event.currentTarget as HTMLSelectElement).value as typeof namespaceType;
  }

  async function copyGenerated() {
    if (!generatedUuid) return;
    await navigator.clipboard.writeText(generatedUuid);
    copied = true;
    window.setTimeout(() => (copied = false), 1600);
  }
</script>

<section class="uuid-tool">
  <div class="panel generator">
    <div class="version-list" role="tablist" aria-label="UUID version">
      {#each versions as version}
        <button
          class:active={selectedVersion === version.id}
          type="button"
          role="tab"
          aria-selected={selectedVersion === version.id}
          onclick={() => (selectedVersion = version.id)}
        >
          <strong>{version.label}</strong>
          <span>{version.description}</span>
        </button>
      {/each}
    </div>

    {#if selectedVersion === "v5"}
      <div class="v5-fields">
        <label class="field">
          <span>Name</span>
          <input bind:value={name} spellcheck="false" placeholder="example.com" />
        </label>
        <label class="field">
          <span>Namespace</span>
          <select value={namespaceType} onchange={selectNamespace}>
            <option value="dns">DNS namespace</option>
            <option value="url">URL namespace</option>
            <option value="custom">Custom UUID</option>
          </select>
        </label>
        {#if namespaceType === "custom"}
          <label class="field custom-field">
            <span>Custom namespace</span>
            <input bind:value={customNamespace} spellcheck="false" placeholder="Namespace UUID" />
          </label>
        {/if}
      </div>
    {:else}
      <p class="version-note">
        {#if selectedVersion === "v1"}
          Uses the current time and a randomized node identifier.
        {:else if selectedVersion === "v4"}
          Uses cryptographically secure random bytes.
        {:else}
          Uses the current Unix time in milliseconds and random bytes.
        {/if}
      </p>
    {/if}

    {#if generationError}<p class="error" role="alert">{generationError}</p>{/if}
    <div class="generate-row">
      <button class="primary" type="button" onclick={generate}>Generate {selectedVersion}</button>
      {#if generatedUuid}
        <div class="generated-output">
          <code>{generatedUuid}</code>
          <button type="button" onclick={copyGenerated} aria-label="Copy generated UUID">
            <Icon name={copied ? "check" : "copy"} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="decode-section">
    <div class="section-head">
      <div>
        <strong>Decode UUID fields</strong>
        <span>Paste a UUID to inspect its fields and timestamp.</span>
      </div>
    </div>
    <input
      class="decode-input"
      bind:value={decodeInput}
      spellcheck="false"
      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      aria-label="UUID to decode"
    />

    {#if decoded?.valid}
      <div class="decode-summary">
        <div><span>Version</span><strong>v{decoded.version}</strong></div>
        <div><span>Variant</span><strong>{decoded.variant}</strong></div>
      </div>
      <div class="fields-card panel">
        <div class="fields-head"><span>Fields</span><span>Bytes: {decoded.bytes}</span></div>
        {#each decoded.fields as field}
          <div class="field-row"><span>{field.label}</span><code>{field.value}</code></div>
        {/each}
      </div>
    {:else if decoded}
      <p class="error" role="alert">{decoded.error}</p>
    {/if}
  </div>
</section>

<style>
  .uuid-tool {
    max-width: 920px;
    display: grid;
    gap: 24px;
  }
  .panel,
  .decode-input,
  .fields-card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .generator {
    padding: 16px;
    display: grid;
    gap: 18px;
  }
  .version-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .version-list button {
    padding: 10px;
    display: grid;
    gap: 3px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #f7f6f0;
    color: var(--muted);
    text-align: left;
  }
  .version-list button:hover {
    border-color: var(--line-strong);
  }
  .version-list button.active {
    border-color: var(--green);
    background: var(--green-soft);
    color: var(--green);
  }
  .version-list strong {
    font-family: var(--mono);
    font-size: 13px;
  }
  .version-list span,
  .version-note,
  .section-head span {
    color: var(--muted);
    font-size: 12px;
  }
  .version-note {
    margin: 0;
  }
  .v5-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .field {
    display: grid;
    gap: 7px;
  }
  .field span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .field input,
  .field select {
    width: 100%;
    height: 40px;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
    font-family: var(--mono);
    font-size: 13px;
  }
  .field input:focus,
  .field select:focus,
  .decode-input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .custom-field {
    grid-column: 1 / -1;
  }
  .error {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid #ebc7be;
    border-radius: 6px;
    background: var(--red-soft);
    color: var(--red);
    font-size: 13px;
  }
  .generate-row {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .primary {
    height: 40px;
    padding: 0 16px;
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--ink);
    color: white;
    font-weight: 600;
    white-space: nowrap;
  }
  .primary:hover {
    border-color: var(--green);
    background: var(--green);
  }
  .generated-output {
    min-width: 0;
    padding: 0 10px;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #f7f6f0;
  }
  .generated-output code {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--green);
    font-family: var(--mono);
    font-size: 13px;
  }
  .generated-output button {
    padding: 5px 0 5px 6px;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: var(--green);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .generated-output button :global(svg) {
    width: 13px;
    height: 13px;
  }
  .decode-section {
    display: grid;
    gap: 12px;
  }
  .section-head {
    display: grid;
    gap: 4px;
  }
  .section-head > div {
    display: grid;
    gap: 4px;
  }
  .section-head strong {
    font-size: 14px;
  }
  .decode-input {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    outline: 0;
    font-family: var(--mono);
    font-size: 13px;
  }
  .decode-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .decode-summary > div {
    padding: 12px 14px;
    display: grid;
    gap: 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .decode-summary span,
  .fields-head,
  .field-row > span {
    color: var(--muted);
    font-size: 12px;
  }
  .decode-summary strong {
    font-family: var(--mono);
    font-size: 13px;
  }
  .fields-card {
    overflow: hidden;
  }
  .fields-head,
  .field-row {
    padding: 10px 14px;
    display: grid;
    grid-template-columns: minmax(145px, 0.8fr) minmax(0, 2fr);
    gap: 12px;
  }
  .fields-head {
    background: #f7f6f0;
    font-weight: 600;
  }
  .fields-head > span:last-child {
    overflow-wrap: anywhere;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 400;
    text-align: right;
  }
  .field-row {
    border-top: 1px solid var(--line);
  }
  .field-row code {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--green);
    font-family: var(--mono);
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .version-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .v5-fields {
      grid-template-columns: 1fr;
    }
    .custom-field {
      grid-column: auto;
    }
    .generate-row {
      align-items: stretch;
      flex-direction: column;
    }
    .generated-output {
      min-height: 40px;
    }
    .fields-head,
    .field-row {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .fields-head > span:last-child {
      text-align: left;
    }
  }
</style>
