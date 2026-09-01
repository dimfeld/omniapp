<script lang="ts">
  import { onMount } from "svelte";

  type Tool = "json" | "base64" | "time";
  type IconName = Tool | "copy" | "check" | "trash" | "arrow" | "sparkles" | "clock";

  const tools: { id: Tool; label: string; description: string }[] = [
    { id: "json", label: "JSON", description: "Prettify or minify" },
    { id: "base64", label: "Base64", description: "Encode or decode" },
    { id: "time", label: "Date & time", description: "Convert timestamps" },
  ];

  let activeTool = $state<Tool>("json");
  let jsonInput = $state('{\n  "hello": "world",\n  "useful": true\n}');
  let jsonOutput = $state("");
  let jsonError = $state("");
  let base64Input = $state("");
  let base64Output = $state("");
  let base64Error = $state("");
  let timeInput = $state("");
  let copied = $state("");
  let now = $state(new Date());

  const active = $derived(tools.find((tool) => tool.id === activeTool) ?? tools[0]);
  const timeResult = $derived(parseTimeInput(timeInput));

  onMount(() => {
    timeInput = String(Math.floor(Date.now() / 1000));
    const timer = window.setInterval(() => (now = new Date()), 1000);
    return () => window.clearInterval(timer);
  });

  function iconPath(name: IconName): string {
    const paths: Record<IconName, string> = {
      json: "M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2",
      base64: "M6 5h4a2 2 0 0 1 0 4H6V5Zm0 4h5a2.5 2.5 0 0 1 0 5H6V9Zm10-4v9m0-4h5l-3.5-5v9",
      time: "M12 8v5l3 2M3.05 11a9 9 0 1 0 .5-3M3 4v4h4",
      copy: "M8 8h11v11H8zM5 16H4V5h11v1",
      check: "m5 12 4 4L19 6",
      trash: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
      arrow: "M5 12h14m-5-5 5 5-5 5",
      sparkles:
        "m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-1 .8 2.2 2.2.8-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z",
      clock: "M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z",
    };
    return paths[name];
  }

  function formatJson(minified = false) {
    jsonError = "";
    try {
      const parsed = JSON.parse(jsonInput);
      jsonOutput = JSON.stringify(parsed, null, minified ? 0 : 2);
    } catch (error) {
      jsonOutput = "";
      jsonError = error instanceof Error ? error.message : "That JSON is not valid.";
    }
  }

  function encodeBase64() {
    base64Error = "";
    try {
      const bytes = new TextEncoder().encode(base64Input);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      base64Output = btoa(binary);
    } catch {
      base64Output = "";
      base64Error = "This text could not be encoded.";
    }
  }

  function decodeBase64() {
    base64Error = "";
    try {
      const normalized = base64Input.replace(/\s/g, "");
      const binary = atob(normalized);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      base64Output = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      base64Output = "";
      base64Error = "Enter valid Base64-encoded UTF-8 text.";
    }
  }

  function parseTimeInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return { valid: false as const, error: "Enter a timestamp or date." };

    const numeric = Number(trimmed);
    let date: Date;
    let unit = "date text";

    if (Number.isFinite(numeric)) {
      const asSeconds = new Date(numeric * 1000);
      const asMilliseconds = new Date(numeric);
      const secondsYear = asSeconds.getUTCFullYear();
      const millisecondsYear = asMilliseconds.getUTCFullYear();
      const millisecondsPlausible = millisecondsYear >= 1900 && millisecondsYear <= 3000;
      const shouldUseMilliseconds =
        Math.abs(numeric) >= 100_000_000_000 ||
        ((secondsYear > 3000 || secondsYear < 1900) && millisecondsPlausible);

      date = shouldUseMilliseconds ? asMilliseconds : asSeconds;
      unit = shouldUseMilliseconds ? "milliseconds" : "seconds";
    } else {
      date = new Date(trimmed);
    }

    if (Number.isNaN(date.getTime())) {
      return { valid: false as const, error: "That timestamp or date could not be read." };
    }

    return {
      valid: true as const,
      unit,
      seconds: Math.floor(date.getTime() / 1000),
      milliseconds: date.getTime(),
      utc: date.toISOString(),
      local: new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "long",
      }).format(date),
      relative: relativeTime(date),
    };
  }

  function relativeTime(date: Date) {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const ranges: [number, Intl.RelativeTimeFormatUnit][] = [
      [31_536_000, "year"],
      [2_592_000, "month"],
      [86_400, "day"],
      [3_600, "hour"],
      [60, "minute"],
      [1, "second"],
    ];
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    const [amount, unit] = ranges.find(([range]) => Math.abs(seconds) >= range) ?? ranges.at(-1)!;
    return formatter.format(Math.round(seconds / amount), unit);
  }

  async function copyText(value: string, key: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copied = key;
    window.setTimeout(() => {
      if (copied === key) copied = "";
    }, 1600);
  }

  function useCurrentTime() {
    timeInput = String(Math.floor(Date.now() / 1000));
  }
</script>

<svelte:head>
  <title>Omni — Your useful little toolbox</title>
  <meta name="description" content="A private toolbox for JSON, Base64, timestamps, and more." />
</svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Omni home">
      <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
      <span>omni</span>
    </a>
    <div class="topbar-meta">
      <span class="privacy"><span class="status-dot"></span>Runs locally</span>
      <span class="live-time"
        >{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span
      >
    </div>
  </header>

  <div class="workspace">
    <aside class="sidebar">
      <div class="sidebar-heading"><span>TOOLS</span><span>03</span></div>
      <nav class="tool-nav" aria-label="Tools">
        {#each tools as tool}
          <button class:active={activeTool === tool.id} onclick={() => (activeTool = tool.id)}>
            <span class="tool-icon"
              ><svg viewBox="0 0 24 24"><path d={iconPath(tool.id)} /></svg></span
            >
            <span class="tool-copy"
              ><strong>{tool.label}</strong><small>{tool.description}</small></span
            >
            <span class="nav-arrow">›</span>
          </button>
        {/each}
      </nav>
      <div class="sidebar-note">
        <svg viewBox="0 0 24 24"><path d={iconPath("sparkles")} /></svg>
        <div><strong>More soon</strong><span>Filament and package tracking are next.</span></div>
      </div>
    </aside>

    <main>
      <div class="mobile-tabs" aria-label="Tools">
        {#each tools as tool}
          <button class:active={activeTool === tool.id} onclick={() => (activeTool = tool.id)}>
            <svg viewBox="0 0 24 24"><path d={iconPath(tool.id)} /></svg><span>{tool.label}</span>
          </button>
        {/each}
      </div>

      <section class="page-intro">
        <div>
          <p class="eyebrow">QUICK UTILITY</p>
          <h1>{active.label}</h1>
          <p>{active.description}. Nothing leaves this device.</p>
        </div>
      </section>

      {#if activeTool === "json"}
        <section class="tool-panel">
          <div class="panel-toolbar">
            <div class="segmented-actions">
              <button class="primary" onclick={() => formatJson(false)}
                ><svg viewBox="0 0 24 24"><path d={iconPath("sparkles")} /></svg>Prettify</button
              >
              <button onclick={() => formatJson(true)}>Minify</button>
            </div>
            <button
              class="icon-button"
              onclick={() => {
                jsonInput = "";
                jsonOutput = "";
                jsonError = "";
              }}
              aria-label="Clear JSON"
            >
              <svg viewBox="0 0 24 24"><path d={iconPath("trash")} /></svg><span>Clear</span>
            </button>
          </div>
          <div class="editor-grid">
            <label class="editor-pane">
              <span class="pane-label"><span>INPUT</span><em>{jsonInput.length} chars</em></span>
              <textarea bind:value={jsonInput} spellcheck="false" placeholder="Paste JSON here…"
              ></textarea>
            </label>
            <div class="editor-pane output-pane">
              <span class="pane-label"
                ><span>OUTPUT</span><button
                  onclick={() => copyText(jsonOutput, "json")}
                  disabled={!jsonOutput}
                  ><svg viewBox="0 0 24 24"
                    ><path d={iconPath(copied === "json" ? "check" : "copy")} /></svg
                  >{copied === "json" ? "Copied" : "Copy"}</button
                ></span
              >
              {#if jsonError}
                <div class="error-message">
                  <strong>Check your JSON</strong><span>{jsonError}</span>
                </div>
              {:else if jsonOutput}<pre>{jsonOutput}</pre>
              {:else}<div class="empty-state">
                  <svg viewBox="0 0 24 24"><path d={iconPath("arrow")} /></svg><span
                    >Your formatted JSON appears here.</span
                  >
                </div>{/if}
            </div>
          </div>
        </section>
      {:else if activeTool === "base64"}
        <section class="tool-panel">
          <div class="panel-toolbar">
            <div class="segmented-actions">
              <button class="primary" onclick={encodeBase64}>Encode</button><button
                onclick={decodeBase64}>Decode</button
              >
            </div>
            <button
              class="icon-button"
              onclick={() => {
                base64Input = "";
                base64Output = "";
                base64Error = "";
              }}
              ><svg viewBox="0 0 24 24"><path d={iconPath("trash")} /></svg><span>Clear</span
              ></button
            >
          </div>
          <div class="stacked-editors">
            <label class="text-block"
              ><span class="pane-label"><span>TEXT OR BASE64</span><em>UTF-8 supported</em></span
              ><textarea
                bind:value={base64Input}
                spellcheck="false"
                placeholder="Type or paste content here…"></textarea></label
            >
            <div class="flow-arrow">
              <span><svg viewBox="0 0 24 24"><path d={iconPath("arrow")} /></svg></span>
            </div>
            <div class="text-block result-block">
              <span class="pane-label"
                ><span>RESULT</span><button
                  onclick={() => copyText(base64Output, "base64")}
                  disabled={!base64Output}
                  ><svg viewBox="0 0 24 24"
                    ><path d={iconPath(copied === "base64" ? "check" : "copy")} /></svg
                  >{copied === "base64" ? "Copied" : "Copy"}</button
                ></span
              >
              {#if base64Error}<div class="error-message">
                  <strong>Conversion failed</strong><span>{base64Error}</span>
                </div>{:else}<pre class:placeholder={!base64Output}>{base64Output ||
                    "Your converted content appears here."}</pre>{/if}
            </div>
          </div>
        </section>
      {:else}
        <section class="tool-panel time-tool">
          <div class="time-input-wrap">
            <label for="time-input">TIMESTAMP OR DATE</label>
            <div class="time-input-row">
              <input
                id="time-input"
                bind:value={timeInput}
                spellcheck="false"
                placeholder="1725120000 or 2026-08-31"
              /><button onclick={useCurrentTime}
                ><svg viewBox="0 0 24 24"><path d={iconPath("clock")} /></svg>Use now</button
              >
            </div>
            <p>
              Seconds and milliseconds are detected automatically. Standard date text also works.
            </p>
          </div>
          {#if timeResult.valid}
            <div class="detection-banner">
              <span class="status-dot"></span>Interpreted as <strong>{timeResult.unit}</strong>
            </div>
            <div class="time-results">
              <div class="wide result-card">
                <span>LOCAL TIME</span><strong>{timeResult.local}</strong><small
                  >{timeResult.relative}</small
                >
              </div>
              <div class="result-card">
                <span>UTC / ISO 8601</span><strong>{timeResult.utc}</strong><button
                  onclick={() => copyText(timeResult.utc, "utc")}
                  aria-label="Copy UTC timestamp"
                  ><svg viewBox="0 0 24 24"
                    ><path d={iconPath(copied === "utc" ? "check" : "copy")} /></svg
                  ></button
                >
              </div>
              <div class="result-card">
                <span>EPOCH SECONDS</span><strong>{timeResult.seconds}</strong><button
                  onclick={() => copyText(String(timeResult.seconds), "seconds")}
                  aria-label="Copy epoch seconds"
                  ><svg viewBox="0 0 24 24"
                    ><path d={iconPath(copied === "seconds" ? "check" : "copy")} /></svg
                  ></button
                >
              </div>
              <div class="result-card">
                <span>EPOCH MILLISECONDS</span><strong>{timeResult.milliseconds}</strong><button
                  onclick={() => copyText(String(timeResult.milliseconds), "milliseconds")}
                  aria-label="Copy epoch milliseconds"
                  ><svg viewBox="0 0 24 24"
                    ><path d={iconPath(copied === "milliseconds" ? "check" : "copy")} /></svg
                  ></button
                >
              </div>
            </div>
          {:else}<div class="error-message standalone">
              <strong>No date to show</strong><span>{timeResult.error}</span>
            </div>{/if}
        </section>
      {/if}

      <footer>
        <span>OMNI / PERSONAL TOOLBOX</span><span>Built for the small jobs that slow you down.</span
        >
      </footer>
    </main>
  </div>
</div>
