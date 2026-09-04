<script lang="ts">
  import { testRegex, type RegexFlag } from "$lib/regex";

  const flagOptions: { flag: RegexFlag; label: string }[] = [
    { flag: "d", label: "Indices" },
    { flag: "g", label: "Global" },
    { flag: "i", label: "Ignore case" },
    { flag: "m", label: "Multiline" },
    { flag: "s", label: "Dotall" },
    { flag: "u", label: "Unicode" },
    { flag: "v", label: "Unicode sets" },
    { flag: "y", label: "Sticky" },
  ];

  let pattern = $state("");
  let text = $state("");
  let enabledFlags = $state<Record<RegexFlag, boolean>>({
    d: false,
    g: true,
    i: false,
    m: false,
    s: false,
    u: false,
    v: false,
    y: false,
  });
  const flags = $derived(
    flagOptions
      .filter(({ flag }) => enabledFlags[flag])
      .map(({ flag }) => flag)
      .join("")
  );
  const result = $derived(pattern ? testRegex(pattern, text, flags) : null);

  function toggleFlag(flag: RegexFlag, checked: boolean) {
    enabledFlags[flag] = checked;
    if (!checked) return;
    if (flag === "u") enabledFlags.v = false;
    if (flag === "v") enabledFlags.u = false;
  }

  function clear() {
    pattern = "";
    text = "";
  }
</script>

<section class="regex-tool">
  <div class="panel editor-panel">
    <div class="editor">
      <label class="field">
        <span class="field-label">Regular expression<em>JavaScript syntax</em></span>
        <div class="regex-input">
          <span>/</span>
          <input
            bind:value={pattern}
            spellcheck="false"
            placeholder="e.g. (?&lt;word&gt;\\w+)"
            aria-label="Regular expression"
          />
          <span>/</span>
          <code>{flags}</code>
        </div>
      </label>
      <label class="field text-field">
        <span class="field-label">Match text<em>{text.length} chars</em></span>
        <textarea bind:value={text} spellcheck="false" placeholder="Type or paste text to test…"
        ></textarea>
      </label>
    </div>

    <div class="flags">
      <div class="flags-head">
        <span class="field-label">Flags</span>
        <button class="ghost" type="button" onclick={clear}>Clear</button>
      </div>
      <div class="flag-list">
        {#each flagOptions as option}
          <label class="flag">
            <input
              type="checkbox"
              checked={enabledFlags[option.flag]}
              onchange={(event) =>
                toggleFlag(option.flag, (event.currentTarget as HTMLInputElement).checked)}
            />
            <code>{option.flag}</code>
            <span>{option.label}</span>
          </label>
        {/each}
      </div>
      <p class="flag-note">
        Use <code>g</code> to show every match. <code>u</code> and <code>v</code> cannot be used together.
      </p>
    </div>
  </div>

  <div class="results-head">
    <div>
      <strong>Results</strong>
      {#if result?.valid}
        <span>{result.matches.length} {result.matches.length === 1 ? "match" : "matches"}</span>
      {/if}
    </div>
    <code>/{pattern}/{flags}</code>
  </div>

  {#if !result}
    <div class="empty">
      <strong>Ready to test</strong>
      <span>Enter a regular expression and some match text.</span>
    </div>
  {:else if !result.valid}
    <div class="error" role="alert">
      <strong>Invalid regular expression</strong>
      <span>{result.error}</span>
    </div>
  {:else if result.matches.length === 0}
    <div class="empty">
      <strong>No match</strong>
      <span>The expression did not match the test text.</span>
    </div>
  {:else}
    <div class="matches">
      {#each result.matches as match, matchIndex}
        <article class="match-card">
          <div class="match-head">
            <strong>Match {matchIndex + 1}</strong>
            <span
              >Index {match.index} · {match.full.length}
              {match.full.length === 1 ? "char" : "chars"}</span
            >
          </div>
          <div class="full-match">
            <span>Full match</span>
            <code class:empty-value={!match.full}>{match.full || "Empty match"}</code>
          </div>
          <div class="groups">
            <div class="groups-head">
              <span>Capture groups</span>
              <span>{match.groups.length} {match.groups.length === 1 ? "group" : "groups"}</span>
            </div>
            {#if match.groups.length === 0}
              <p class="no-groups">No capture groups in this expression.</p>
            {:else}
              {#each match.groups as group}
                <div class="group-row">
                  <code>${group.index}</code>
                  <code class:empty-value={group.value === null}>{group.value ?? "undefined"}</code>
                </div>
              {/each}
            {/if}
            {#if match.namedGroups.length}
              <div class="named-groups">
                <span>Named groups</span>
                {#each match.namedGroups as group}
                  <div class="group-row">
                    <code>{group.name}</code>
                    <code class:empty-value={group.value === null}
                      >{group.value ?? "undefined"}</code
                    >
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .regex-tool {
    max-width: 920px;
    display: grid;
    gap: 20px;
  }
  .panel,
  .match-card,
  .empty,
  .error {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .editor-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.6fr);
  }
  .editor {
    min-width: 0;
    padding: 16px;
    display: grid;
    gap: 16px;
  }
  .field {
    min-width: 0;
    display: grid;
    gap: 7px;
  }
  .field-label,
  .groups-head,
  .full-match > span,
  .named-groups > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }
  .field-label em {
    color: var(--faint);
    font-style: normal;
    font-weight: 400;
  }
  .regex-input {
    min-width: 0;
    height: 44px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 14px;
  }
  .regex-input:focus-within {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .regex-input input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    font-family: inherit;
  }
  .regex-input code {
    color: var(--green);
    font-weight: 600;
  }
  textarea {
    width: 100%;
    min-height: 128px;
    padding: 12px;
    resize: vertical;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.6;
  }
  textarea:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .flags {
    min-width: 0;
    padding: 16px;
    border-left: 1px solid var(--line);
    background: #f7f6f0;
  }
  .flags-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .flag-list {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 10px;
  }
  .flag {
    min-width: 0;
    padding: 7px 6px;
    display: grid;
    grid-template-columns: 16px 18px minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    border-radius: 5px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .flag:hover {
    background: #eeece4;
    color: var(--ink);
  }
  .flag input {
    width: 14px;
    height: 14px;
    accent-color: var(--green);
  }
  .flag code {
    color: var(--ink);
    font-weight: 700;
  }
  .flag-note {
    margin-top: 16px;
    color: var(--faint);
    font-size: 11px;
    line-height: 1.5;
  }
  .flag-note code {
    color: var(--muted);
  }
  .ghost {
    padding: 5px 7px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
  }
  .ghost:hover {
    background: #eeece4;
    color: var(--ink);
  }
  .results-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .results-head > div {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .results-head strong {
    font-size: 14px;
  }
  .results-head span {
    color: var(--muted);
    font-size: 12px;
  }
  .results-head > code {
    max-width: 55%;
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .matches {
    display: grid;
    gap: 10px;
  }
  .match-card {
    overflow: hidden;
  }
  .match-head,
  .full-match,
  .groups {
    padding: 12px 16px;
  }
  .match-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--line);
  }
  .match-head > span {
    color: var(--faint);
    font-size: 12px;
  }
  .full-match {
    display: grid;
    gap: 7px;
    background: #f7f6f0;
  }
  .full-match code {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    color: var(--green);
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
  }
  code.empty-value {
    color: var(--faint);
    font-style: italic;
    font-weight: 400;
  }
  .groups {
    display: grid;
    gap: 8px;
  }
  .groups-head {
    padding-bottom: 4px;
  }
  .groups-head > span:last-child {
    color: var(--faint);
    font-weight: 400;
  }
  .group-row {
    min-width: 0;
    padding: 8px 10px;
    display: grid;
    grid-template-columns: minmax(48px, 0.3fr) minmax(0, 1fr);
    gap: 10px;
    border-radius: 5px;
    background: #f7f6f0;
    font-family: var(--mono);
    font-size: 12px;
  }
  .group-row code:first-child {
    color: var(--muted);
  }
  .group-row code:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .no-groups {
    color: var(--faint);
    font-size: 13px;
  }
  .named-groups {
    margin-top: 8px;
    padding-top: 12px;
    display: grid;
    gap: 8px;
    border-top: 1px solid var(--line);
  }
  .error,
  .empty {
    padding: 16px;
    display: grid;
    gap: 4px;
  }
  .error {
    border-color: #ebc7be;
    background: var(--red-soft);
    color: var(--red);
  }
  .error span,
  .empty span {
    color: var(--muted);
    font-size: 13px;
  }
  .empty {
    background: #f7f6f0;
  }
  @media (max-width: 700px) {
    .editor-panel {
      grid-template-columns: 1fr;
    }
    .flags {
      border-top: 1px solid var(--line);
      border-left: 0;
    }
    .results-head {
      align-items: flex-start;
      flex-direction: column;
      gap: 4px;
    }
    .results-head > code {
      max-width: 100%;
    }
  }
</style>
