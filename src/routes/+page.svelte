<script lang="ts">
  import { onMount } from "svelte";

  type Tool = "json" | "base64" | "time" | "packages";
  type IconName = Tool | "copy" | "check" | "trash" | "arrow" | "sparkles" | "clock" | "external";

  type Carrier = "usps" | "ups" | "fedex" | "dhl" | "ontrac";

  type Package = {
    id: string;
    name: string;
    carrier: Carrier | "custom";
    trackingNumber: string;
    trackingUrl: string;
    delivered: boolean;
    addedAt: number;
  };

  const carriers: { id: Carrier; label: string; buildUrl: (number: string) => string }[] = [
    {
      id: "usps",
      label: "USPS",
      buildUrl: (number) =>
        `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(number)}`,
    },
    {
      id: "ups",
      label: "UPS",
      buildUrl: (number) => `https://www.ups.com/track?tracknum=${encodeURIComponent(number)}`,
    },
    {
      id: "fedex",
      label: "FedEx",
      buildUrl: (number) =>
        `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number)}`,
    },
    {
      id: "dhl",
      label: "DHL",
      buildUrl: (number) =>
        `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(number)}`,
    },
    {
      id: "ontrac",
      label: "OnTrac",
      buildUrl: (number) => `https://www.ontrac.com/tracking/?number=${encodeURIComponent(number)}`,
    },
  ];

  const tools: { id: Tool; label: string; description: string }[] = [
    { id: "json", label: "JSON", description: "Prettify or minify" },
    { id: "base64", label: "Base64", description: "Encode or decode" },
    { id: "time", label: "Date & time", description: "Convert timestamps" },
    { id: "packages", label: "Packages", description: "Track your deliveries" },
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
  let packages = $state<Package[]>([]);
  let packageName = $state("");
  let trackingUrl = $state("");
  let carrier = $state<Carrier>("usps");
  let trackingNumber = $state("");
  let packageError = $state("");
  let packagesLoading = $state(true);
  let packageSubmitting = $state(false);

  const active = $derived(tools.find((tool) => tool.id === activeTool) ?? tools[0]);
  const timeResult = $derived(parseTimeInput(timeInput));

  onMount(() => {
    timeInput = String(Math.floor(Date.now() / 1000));
    void loadPackages();
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
      packages: "M21 8.5 12 13 3 8.5M12 13v9M4.5 7.75 12 4l7.5 3.75v8.5L12 20l-7.5-3.75v-8.5Z",
      external: "M14 4h6v6m0-6-9 9M18 13v7H4V6h7",
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

  async function loadPackages() {
    packagesLoading = true;
    try {
      const response = await fetch("/api/packages");
      if (!response.ok) throw new Error("Could not load packages.");
      packages = (await response.json()) as Package[];
    } catch {
      packageError = "Could not load packages from the local database.";
    } finally {
      packagesLoading = false;
    }
  }

  function normalizedUrl(value: string) {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported URL");
    return parsed.toString();
  }

  async function addPackage(event: SubmitEvent) {
    event.preventDefault();
    packageError = "";

    const name = packageName.trim();
    const number = trackingNumber.trim();
    const customUrl = trackingUrl.trim();
    if (!name) {
      packageError = "Enter a package name.";
      return;
    }
    if (!customUrl && !number) {
      packageError = "Enter a tracking URL or a carrier tracking number.";
      return;
    }

    let url: string;
    try {
      url = customUrl
        ? normalizedUrl(customUrl)
        : carriers.find((option) => option.id === carrier)!.buildUrl(number);
    } catch {
      packageError = "Enter a valid tracking URL.";
      return;
    }

    packageSubmitting = true;
    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          carrier: customUrl ? "custom" : carrier,
          trackingNumber: customUrl ? "" : number,
          trackingUrl: url,
        }),
      });
      if (!response.ok) throw new Error("Could not save package.");

      const nextPackage = (await response.json()) as Package;
      packages = [nextPackage, ...packages];
      packageName = "";
      trackingUrl = "";
      trackingNumber = "";
    } catch {
      packageError = "Could not save the package. Try again.";
    } finally {
      packageSubmitting = false;
    }
  }

  async function markDelivered(id: string) {
    packageError = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, { method: "PATCH" });
      if (!response.ok) throw new Error("Could not update package.");
      packages = packages
        .map((item) => (item.id === id ? { ...item, delivered: true } : item))
        .sort((a, b) => Number(a.delivered) - Number(b.delivered) || b.addedAt - a.addedAt);
    } catch {
      packageError = "Could not mark the package as delivered.";
    }
  }

  async function removePackage(id: string) {
    packageError = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove package.");
      packages = packages.filter((item) => item.id !== id);
    } catch {
      packageError = "Could not remove the package.";
    }
  }

  function carrierLabel(item: Package) {
    if (item.carrier === "custom") return "Tracking link";
    return carriers.find((option) => option.id === item.carrier)?.label ?? item.carrier;
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
      <div class="sidebar-heading"><span>TOOLS</span><span>04</span></div>
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
        <div><strong>More soon</strong><span>Filament tools are next.</span></div>
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
      {:else if activeTool === "time"}
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
      {:else}
        <section class="packages-layout">
          <form class="tool-panel package-form" onsubmit={addPackage}>
            <div class="package-form-heading">
              <div>
                <span>ADD A DELIVERY</span>
                <strong>What is on the way?</strong>
              </div>
              <svg viewBox="0 0 24 24"><path d={iconPath("packages")} /></svg>
            </div>

            <label class="package-field">
              <span>PACKAGE NAME</span>
              <input bind:value={packageName} placeholder="Coffee beans" autocomplete="off" />
            </label>

            <label class="package-field">
              <span>TRACKING URL</span>
              <input
                bind:value={trackingUrl}
                type="text"
                inputmode="url"
                placeholder="https://…"
                autocomplete="url"
              />
            </label>

            <div class="form-divider"><span>OR USE A CARRIER</span></div>

            <div class="carrier-row">
              <label class="package-field carrier-field">
                <span>CARRIER</span>
                <select bind:value={carrier}>
                  {#each carriers as option}
                    <option value={option.id}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label class="package-field number-field">
                <span>TRACKING NUMBER</span>
                <input bind:value={trackingNumber} placeholder="Enter number" autocomplete="off" />
              </label>
            </div>

            {#if packageError}
              <p class="package-error" role="alert">{packageError}</p>
            {/if}

            <button class="add-package-button" type="submit" disabled={packageSubmitting}>
              <span>{packageSubmitting ? "Adding…" : "Add package"}</span><svg viewBox="0 0 24 24"
                ><path d={iconPath("arrow")} /></svg
              >
            </button>
            <p class="storage-note">
              <span class="status-dot"></span>Saved in your local Omni database
            </p>
          </form>

          <div class="package-list-wrap">
            <div class="package-list-heading">
              <div>
                <span>YOUR PACKAGES</span>
                <strong>{packages.filter((item) => !item.delivered).length} on the way</strong>
              </div>
              <span>{packages.length} total</span>
            </div>

            {#if packagesLoading}
              <div class="package-empty">
                <span><svg viewBox="0 0 24 24"><path d={iconPath("clock")} /></svg></span>
                <strong>Loading packages…</strong>
              </div>
            {:else if packages.length}
              <div class="package-list">
                {#each packages as item (item.id)}
                  <article class:delivered={item.delivered} class="package-card">
                    <div class="package-card-icon">
                      <svg viewBox="0 0 24 24"
                        ><path d={iconPath(item.delivered ? "check" : "packages")} /></svg
                      >
                    </div>
                    <div class="package-card-copy">
                      <div class="package-name-row">
                        <strong>{item.name}</strong>
                        <span class:complete={item.delivered}
                          >{item.delivered ? "Delivered" : "In transit"}</span
                        >
                      </div>
                      <p>
                        {carrierLabel(item)}
                        {#if item.trackingNumber}<span>·</span><code>{item.trackingNumber}</code
                          >{/if}
                      </p>
                      <div class="package-actions">
                        <a href={item.trackingUrl} target="_blank" rel="noreferrer">
                          Track package<svg viewBox="0 0 24 24"
                            ><path d={iconPath("external")} /></svg
                          >
                        </a>
                        {#if !item.delivered}
                          <button onclick={() => markDelivered(item.id)}>
                            <svg viewBox="0 0 24 24"><path d={iconPath("check")} /></svg>Mark
                            delivered
                          </button>
                        {/if}
                        <button
                          class="remove-package"
                          onclick={() => removePackage(item.id)}
                          aria-label={`Remove ${item.name}`}
                        >
                          <svg viewBox="0 0 24 24"><path d={iconPath("trash")} /></svg>
                        </button>
                      </div>
                    </div>
                  </article>
                {/each}
              </div>
            {:else}
              <div class="package-empty">
                <span><svg viewBox="0 0 24 24"><path d={iconPath("packages")} /></svg></span>
                <strong>No packages yet</strong>
                <p>Add a tracking link or carrier number to keep every delivery in one place.</p>
              </div>
            {/if}
          </div>
        </section>
      {/if}

      <footer>
        <span>OMNI / PERSONAL TOOLBOX</span><span>Built for the small jobs that slow you down.</span
        >
      </footer>
    </main>
  </div>
</div>
