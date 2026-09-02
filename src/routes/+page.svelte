<script lang="ts">
  import { onMount } from "svelte";
  import { parseGcodeFilament, type FilamentUse } from "$lib/filament/gcode";
  import { inferTrackingDetails, type Carrier as TrackingCarrier } from "$lib/packages/tracking";

  type Tool = "json" | "base64" | "time" | "packages" | "filament";
  type IconName = Tool | "copy" | "check" | "trash" | "external" | "upload" | "close";

  type Carrier = TrackingCarrier;

  type Package = {
    id: string;
    name: string;
    carrier: Carrier | "custom";
    trackingNumber: string;
    trackingUrl: string;
    expectedDeliveryDate: string | null;
    delivered: boolean;
    addedAt: number;
  };

  type FilamentRoll = {
    id: string;
    name: string | null;
    material: string;
    color: string;
    initialWeight: number;
    remainingWeight: number;
    lowThreshold: number;
    lowAlertDismissed: boolean;
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
    { id: "filament", label: "Filament", description: "Manage printer rolls" },
  ];

  let activeTool = $state<Tool>("json");
  let jsonInput = $state("");
  let jsonOutput = $state("");
  let jsonError = $state("");
  let jsonFormat = $state<"pretty" | "minified">("pretty");
  let base64Input = $state("");
  let base64Output = $state("");
  let base64Error = $state("");
  let base64Mode = $state<"encode" | "decode">("encode");
  let timeInput = $state("");
  let copied = $state("");
  let now = $state(new Date());
  let packages = $state<Package[]>([]);
  let packageName = $state("");
  let trackingUrl = $state("");
  let carrier = $state<Carrier>("usps");
  let trackingNumber = $state("");
  let expectedDeliveryDate = $state("");
  let packageError = $state("");
  let packagesLoading = $state(true);
  let packageSubmitting = $state(false);
  let updatingPackageId = $state("");
  let filamentRolls = $state<FilamentRoll[]>([]);
  let filamentName = $state("");
  let filamentMaterial = $state("PLA");
  let filamentColor = $state("");
  let filamentWeight = $state("1000");
  let filamentLowThreshold = $state("100");
  let filamentError = $state("");
  let filamentLoading = $state(true);
  let filamentSubmitting = $state(false);
  let gcodeUses = $state<FilamentUse[]>([]);
  let gcodeFilename = $state("");
  let filamentAssignments = $state<Record<number, string>>({});
  let applyingFilament = $state(false);

  const active = $derived(tools.find((tool) => tool.id === activeTool) ?? tools[0]);
  const timeResult = $derived(parseTimeInput(timeInput, now));
  const lowFilamentRolls = $derived(
    filamentRolls.filter(
      (roll) => roll.remainingWeight <= roll.lowThreshold && !roll.lowAlertDismissed
    )
  );

  function selectToolByShortcut(event: KeyboardEvent) {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    const toolIndex = Number(event.key) - 1;
    if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= tools.length) return;

    event.preventDefault();
    activeTool = tools[toolIndex].id;
  }

  onMount(() => {
    void loadPackages();
    void loadFilamentRolls();
    window.addEventListener("keydown", selectToolByShortcut);
    const timer = window.setInterval(() => (now = new Date()), 1000);
    return () => {
      window.removeEventListener("keydown", selectToolByShortcut);
      window.clearInterval(timer);
    };
  });

  function iconPath(name: IconName): string {
    const paths: Record<IconName, string> = {
      json: "M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2",
      base64: "M6 5h4a2 2 0 0 1 0 4H6V5Zm0 4h5a2.5 2.5 0 0 1 0 5H6V9Zm10-4v9m0-4h5l-3.5-5v9",
      time: "M12 8v5l3 2M3.05 11a9 9 0 1 0 .5-3M3 4v4h4",
      copy: "M8 8h11v11H8zM5 16H4V5h11v1",
      check: "m5 12 4 4L19 6",
      trash: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
      packages: "M21 8.5 12 13 3 8.5M12 13v9M4.5 7.75 12 4l7.5 3.75v8.5L12 20l-7.5-3.75v-8.5Z",
      external: "M14 4h6v6m0-6-9 9M18 13v7H4V6h7",
      filament:
        "M8 5.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5.5 2.5H21v6m0 0-2-2m2 2 2-2",
      upload: "M12 16V4m0 0L7 9m5-5 5 5M5 15v5h14v-5",
      close: "M6 6l12 12M18 6 6 18",
    };
    return paths[name];
  }

  function formatJson(minified = jsonFormat === "minified", live = false) {
    jsonFormat = minified ? "minified" : "pretty";
    jsonError = "";
    try {
      const parsed = JSON.parse(jsonInput);
      jsonOutput = JSON.stringify(parsed, null, minified ? 0 : 2);
    } catch (error) {
      if (live) return;
      jsonOutput = "";
      jsonError = error instanceof Error ? error.message : "That JSON is not valid.";
    }
  }

  function encodeBase64(live = false) {
    base64Mode = "encode";
    base64Error = "";
    try {
      const bytes = new TextEncoder().encode(base64Input);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      base64Output = btoa(binary);
    } catch {
      if (live) return;
      base64Output = "";
      base64Error = "This text could not be encoded.";
    }
  }

  function decodeBase64(live = false) {
    base64Mode = "decode";
    base64Error = "";
    try {
      const normalized = base64Input.replace(/\s/g, "");
      const binary = atob(normalized);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      base64Output = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      if (live) return;
      base64Output = "";
      base64Error = "Enter valid Base64-encoded UTF-8 text.";
    }
  }

  function parseTimeInput(value: string, currentDate: Date) {
    const trimmed = value.trim();
    let date: Date;
    let unit = "date text";

    if (!trimmed) {
      date = currentDate;
      unit = "current time";
    } else if (Number.isFinite(Number(trimmed))) {
      const numeric = Number(trimmed);
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
      packages = sortPackages((await response.json()) as Package[]);
    } catch {
      packageError = "Could not load packages.";
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

  function sortPackages(items: Package[]) {
    return [...items].sort((a, b) => {
      if (!a.expectedDeliveryDate && !b.expectedDeliveryDate) return b.addedAt - a.addedAt;
      if (!a.expectedDeliveryDate) return -1;
      if (!b.expectedDeliveryDate) return 1;
      return a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate) || b.addedAt - a.addedAt;
    });
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

    const inferredTracking = customUrl
      ? inferTrackingDetails(url)
      : { carrier, trackingNumber: number };

    packageSubmitting = true;
    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          carrier: inferredTracking.carrier,
          trackingNumber: inferredTracking.trackingNumber,
          trackingUrl: url,
          expectedDeliveryDate: expectedDeliveryDate || null,
        }),
      });
      if (!response.ok) throw new Error("Could not save package.");

      const nextPackage = (await response.json()) as Package;
      packages = sortPackages([nextPackage, ...packages]);
      packageName = "";
      trackingUrl = "";
      trackingNumber = "";
      expectedDeliveryDate = "";
    } catch {
      packageError = "Could not save the package. Try again.";
    } finally {
      packageSubmitting = false;
    }
  }

  async function markDelivered(id: string) {
    packageError = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delivered: true }),
      });
      if (!response.ok) throw new Error("Could not update package.");
      packages = sortPackages(
        packages.map((item) => (item.id === id ? { ...item, delivered: true } : item))
      );
    } catch {
      packageError = "Could not mark the package as delivered.";
    }
  }

  async function updateExpectedDeliveryDate(id: string, value: string) {
    packageError = "";
    updatingPackageId = id;
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedDeliveryDate: value || null }),
      });
      if (!response.ok) throw new Error("Could not update expected delivery date.");
      packages = sortPackages(
        packages.map((item) =>
          item.id === id ? { ...item, expectedDeliveryDate: value || null } : item
        )
      );
    } catch {
      packageError = "Could not update the expected delivery date.";
      packages = [...packages];
    } finally {
      updatingPackageId = "";
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

  async function loadFilamentRolls() {
    filamentLoading = true;
    try {
      const response = await fetch("/api/filament");
      if (!response.ok) throw new Error("Could not load filament rolls.");
      filamentRolls = (await response.json()) as FilamentRoll[];
    } catch {
      filamentError = "Could not load filament rolls.";
    } finally {
      filamentLoading = false;
    }
  }

  async function addFilamentRoll(event: SubmitEvent) {
    event.preventDefault();
    filamentError = "";
    const initialWeight = Number(filamentWeight);
    const lowThreshold = Number(filamentLowThreshold);
    if (!filamentMaterial.trim() || !Number.isFinite(initialWeight) || initialWeight <= 0) {
      filamentError = "Enter a material and a valid roll weight.";
      return;
    }
    if (!Number.isFinite(lowThreshold) || lowThreshold < 0) {
      filamentError = "Enter a valid low-weight threshold.";
      return;
    }

    filamentSubmitting = true;
    try {
      const response = await fetch("/api/filament", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: filamentName,
          material: filamentMaterial,
          color: filamentColor,
          initialWeight,
          lowThreshold,
        }),
      });
      if (!response.ok) throw new Error("Could not save filament roll.");
      filamentRolls = [(await response.json()) as FilamentRoll, ...filamentRolls];
      filamentName = "";
      filamentColor = "";
      filamentWeight = "1000";
    } catch {
      filamentError = "Could not save the filament roll. Try again.";
    } finally {
      filamentSubmitting = false;
    }
  }

  async function updateFilamentRoll(id: string, update: Partial<FilamentRoll>) {
    filamentError = "";
    try {
      const response = await fetch(`/api/filament/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error("Could not update filament roll.");
      const updated = (await response.json()) as FilamentRoll;
      filamentRolls = filamentRolls.map((roll) => (roll.id === id ? updated : roll));
    } catch {
      filamentError = "Could not update the filament roll.";
      filamentRolls = [...filamentRolls];
    }
  }

  async function removeFilamentRoll(id: string) {
    filamentError = "";
    try {
      const response = await fetch(`/api/filament/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove filament roll.");
      filamentRolls = filamentRolls.filter((roll) => roll.id !== id);
    } catch {
      filamentError = "Could not remove the filament roll.";
    }
  }

  async function readGcode(event: Event) {
    filamentError = "";
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    gcodeFilename = file.name;
    const parsed = parseGcodeFilament(await file.text());
    if (!parsed.length) {
      gcodeUses = [];
      filamentAssignments = {};
      filamentError = "No filament amount was found in this G-code file.";
      return;
    }
    gcodeUses = parsed;
    filamentAssignments = Object.fromEntries(
      parsed.map((_, index) => [index, filamentRolls[index]?.id ?? filamentRolls[0]?.id ?? ""])
    );
  }

  function assignFilament(index: number, rollId: string) {
    filamentAssignments = { ...filamentAssignments, [index]: rollId };
  }

  async function applyGcodeUse() {
    filamentError = "";
    const consumptions = gcodeUses.map((use, index) => ({
      id: filamentAssignments[index],
      grams: use.grams,
    }));
    if (consumptions.some((item) => !item.id)) {
      filamentError = "Choose a roll for each filament amount.";
      return;
    }
    applyingFilament = true;
    try {
      const response = await fetch("/api/filament", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consumptions }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Could not subtract filament.");
      }
      const updated = (await response.json()) as FilamentRoll[];
      const updates = new Map(updated.map((roll) => [roll.id, roll]));
      filamentRolls = filamentRolls.map((roll) => updates.get(roll.id) ?? roll);
      gcodeUses = [];
      gcodeFilename = "";
      filamentAssignments = {};
    } catch (error) {
      filamentError = error instanceof Error ? error.message : "Could not subtract filament.";
    } finally {
      applyingFilament = false;
    }
  }

  function rollLabel(roll: FilamentRoll) {
    return roll.name || `${roll.color ? `${roll.color} ` : ""}${roll.material}`;
  }

  function formatWeight(value: number) {
    return `${Math.round(value * 10) / 10} g`;
  }
</script>

<svelte:head>
  <title>Omni</title>
</svelte:head>

<div class="app">
  <nav class="rail" aria-label="Tools">
    <a class="brand" href="/">omni</a>
    <div class="rail-tools">
      {#each tools as tool, index}
        <button
          class:active={activeTool === tool.id}
          onclick={() => (activeTool = tool.id)}
          title={`${tool.label} (Ctrl+${index + 1})`}
        >
          <svg viewBox="0 0 24 24"><path d={iconPath(tool.id)} /></svg>
          <span>{tool.label}</span>
        </button>
      {/each}
    </div>
  </nav>

  <main>
    <h1>{active.label}</h1>

    {#if activeTool === "json"}
      <section class="panel">
        <div class="toolbar">
          <div class="actions">
            <button class="primary" onclick={() => formatJson(false)}>Prettify</button>
            <button onclick={() => formatJson(true)}>Minify</button>
          </div>
          <button
            class="ghost"
            onclick={() => {
              jsonInput = "";
              jsonOutput = "";
              jsonError = "";
            }}>Clear</button
          >
        </div>
        <div class="split">
          <label class="pane">
            <span class="pane-label">Input<em>{jsonInput.length} chars</em></span>
            <textarea
              bind:value={jsonInput}
              oninput={() => formatJson(jsonFormat === "minified", true)}
              spellcheck="false"
              placeholder="Paste JSON…"></textarea>
          </label>
          <div class="pane output">
            <span class="pane-label"
              >Output<button onclick={() => copyText(jsonOutput, "json")} disabled={!jsonOutput}
                ><svg viewBox="0 0 24 24"
                  ><path d={iconPath(copied === "json" ? "check" : "copy")} /></svg
                >{copied === "json" ? "Copied" : "Copy"}</button
              ></span
            >
            {#if jsonError}
              <p class="error">{jsonError}</p>
            {:else}
              <pre class:placeholder={!jsonOutput}>{jsonOutput ||
                  "Formatted JSON appears here."}</pre>
            {/if}
          </div>
        </div>
      </section>
    {:else if activeTool === "base64"}
      <section class="panel">
        <div class="toolbar">
          <div class="actions">
            <button class="primary" onclick={() => encodeBase64()}>Encode</button>
            <button onclick={() => decodeBase64()}>Decode</button>
          </div>
          <button
            class="ghost"
            onclick={() => {
              base64Input = "";
              base64Output = "";
              base64Error = "";
            }}>Clear</button
          >
        </div>
        <div class="split">
          <label class="pane">
            <span class="pane-label">Input<em>Text or Base64</em></span>
            <textarea
              bind:value={base64Input}
              oninput={() => (base64Mode === "encode" ? encodeBase64(true) : decodeBase64(true))}
              spellcheck="false"
              placeholder="Type or paste…"></textarea>
          </label>
          <div class="pane output">
            <span class="pane-label"
              >Output<button
                onclick={() => copyText(base64Output, "base64")}
                disabled={!base64Output}
                ><svg viewBox="0 0 24 24"
                  ><path d={iconPath(copied === "base64" ? "check" : "copy")} /></svg
                >{copied === "base64" ? "Copied" : "Copy"}</button
              ></span
            >
            {#if base64Error}
              <p class="error">{base64Error}</p>
            {:else}
              <pre class:placeholder={!base64Output}>{base64Output || "Result appears here."}</pre>
            {/if}
          </div>
        </div>
      </section>
    {:else if activeTool === "time"}
      <section class="time">
        <div class="time-input">
          <input
            bind:value={timeInput}
            spellcheck="false"
            placeholder="Timestamp or date, e.g. 1725120000 or 2026-08-31"
            aria-label="Timestamp or date"
          />
          <button onclick={useCurrentTime}>Now</button>
        </div>
        {#if timeResult.valid}
          <p class="hint">Read as {timeResult.unit}</p>
          <div class="time-results">
            <div class="result wide">
              <span>Local</span>
              <strong>{timeResult.local}</strong>
              <small>{timeResult.relative}</small>
            </div>
            <div class="result">
              <span>UTC</span>
              <strong>{timeResult.utc}</strong>
              <button onclick={() => copyText(timeResult.utc, "utc")} aria-label="Copy UTC"
                ><svg viewBox="0 0 24 24"
                  ><path d={iconPath(copied === "utc" ? "check" : "copy")} /></svg
                ></button
              >
            </div>
            <div class="result">
              <span>Seconds</span>
              <strong>{timeResult.seconds}</strong>
              <button
                onclick={() => copyText(String(timeResult.seconds), "seconds")}
                aria-label="Copy seconds"
                ><svg viewBox="0 0 24 24"
                  ><path d={iconPath(copied === "seconds" ? "check" : "copy")} /></svg
                ></button
              >
            </div>
            <div class="result">
              <span>Milliseconds</span>
              <strong>{timeResult.milliseconds}</strong>
              <button
                onclick={() => copyText(String(timeResult.milliseconds), "milliseconds")}
                aria-label="Copy milliseconds"
                ><svg viewBox="0 0 24 24"
                  ><path d={iconPath(copied === "milliseconds" ? "check" : "copy")} /></svg
                ></button
              >
            </div>
          </div>
        {:else}
          <p class="error standalone">{timeResult.error}</p>
        {/if}
      </section>
    {:else if activeTool === "packages"}
      <section class="two-col packages-layout">
        <form class="panel form" onsubmit={addPackage}>
          <label class="field">
            <span>Name</span>
            <input bind:value={packageName} placeholder="Coffee beans" autocomplete="off" />
          </label>
          <label class="field">
            <span>Tracking URL</span>
            <input
              bind:value={trackingUrl}
              type="text"
              inputmode="url"
              placeholder="https://…"
              autocomplete="url"
            />
          </label>
          <div class="divider"><span>or</span></div>
          <div class="field-row carrier-row">
            <label class="field">
              <span>Carrier</span>
              <select bind:value={carrier}>
                {#each carriers as option}
                  <option value={option.id}>{option.label}</option>
                {/each}
              </select>
            </label>
            <label class="field">
              <span>Tracking number</span>
              <input bind:value={trackingNumber} autocomplete="off" />
            </label>
          </div>
          <label class="field">
            <span>Expected delivery <em>optional</em></span>
            <input bind:value={expectedDeliveryDate} type="date" />
          </label>
          {#if packageError}<p class="error standalone" role="alert">{packageError}</p>{/if}
          <button class="submit" type="submit" disabled={packageSubmitting}>
            {packageSubmitting ? "Adding…" : "Add package"}
          </button>
        </form>

        <div class="list">
          <div class="list-summary">
            <strong>{packages.filter((item) => !item.delivered).length} on the way</strong>
            <span>{packages.length} total</span>
          </div>

          {#if packagesLoading}
            <p class="empty">Loading…</p>
          {:else if packages.length}
            {#each packages as item (item.id)}
              <article class="card" class:done={item.delivered}>
                <div class="card-head">
                  <strong>{item.name}</strong>
                  <span class="pill" class:complete={item.delivered}
                    >{item.delivered ? "Delivered" : "In transit"}</span
                  >
                </div>
                <p class="meta">
                  {carrierLabel(item)}{#if item.trackingNumber}<span>·</span><code
                      >{item.trackingNumber}</code
                    >{/if}
                </p>
                <div class="card-actions">
                  <label class="inline-date">
                    <span>Expected</span>
                    <input
                      type="date"
                      value={item.expectedDeliveryDate ?? ""}
                      aria-label={`Expected delivery date for ${item.name}`}
                      disabled={updatingPackageId === item.id}
                      onchange={(event) =>
                        updateExpectedDeliveryDate(item.id, event.currentTarget.value)}
                    />
                  </label>
                  <a href={item.trackingUrl} target="_blank" rel="noopener"
                    >Track<svg viewBox="0 0 24 24"><path d={iconPath("external")} /></svg></a
                  >
                  {#if !item.delivered}
                    <button onclick={() => markDelivered(item.id)}>Delivered</button>
                  {/if}
                  <button
                    class="remove"
                    onclick={() => removePackage(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <svg viewBox="0 0 24 24"><path d={iconPath("trash")} /></svg>
                  </button>
                </div>
              </article>
            {/each}
          {:else}
            <p class="empty">No packages yet.</p>
          {/if}
        </div>
      </section>
    {:else}
      <section class="filament">
        <div class="panel gcode">
          <div class="gcode-head">
            <div>
              <strong>Subtract a print</strong>
              <span>Upload G-code from PrusaSlicer, OrcaSlicer, Bambu Studio, or Cura.</span>
            </div>
            <label class="upload">
              <svg viewBox="0 0 24 24"><path d={iconPath("upload")} /></svg>
              <span>{gcodeFilename || "Choose G-code"}</span>
              <input type="file" accept=".gcode,.gco,.gc" onchange={readGcode} />
            </label>
          </div>
          {#if gcodeUses.length}
            <div class="gcode-uses">
              {#each gcodeUses as use, index}
                <div class="gcode-use">
                  <div>
                    <strong>{use.label}</strong>
                    <span>{formatWeight(use.grams)}{use.source === "weight" ? "" : " est."}</span>
                    {#if use.type}<span>{use.type}</span>{/if}
                    {#if use.color}
                      <span class="gcode-color"
                        ><i style:background={use.color}></i>{use.color}</span
                      >
                    {/if}
                  </div>
                  <select
                    value={filamentAssignments[index] ?? ""}
                    aria-label={`Roll for ${use.label}`}
                    onchange={(event) => assignFilament(index, event.currentTarget.value)}
                  >
                    <option value="">Choose a roll</option>
                    {#each filamentRolls as roll}
                      <option value={roll.id}
                        >{rollLabel(roll)} · {formatWeight(roll.remainingWeight)}</option
                      >
                    {/each}
                  </select>
                </div>
              {/each}
              <button
                class="submit accent"
                onclick={applyGcodeUse}
                disabled={applyingFilament || !filamentRolls.length}
                >{applyingFilament ? "Subtracting…" : "Subtract from rolls"}</button
              >
            </div>
          {/if}
        </div>

        {#if lowFilamentRolls.length}
          <div class="low" aria-label="Low filament rolls">
            {#each lowFilamentRolls as roll (roll.id)}
              <article>
                <span class="swatch" style:background={roll.color || "#d9ed9d"}></span>
                <strong>{rollLabel(roll)}</strong>
                <span>{formatWeight(roll.remainingWeight)} left</span>
                <button
                  onclick={() => updateFilamentRoll(roll.id, { lowAlertDismissed: true })}
                  aria-label={`Dismiss low filament alert for ${rollLabel(roll)}`}
                >
                  <svg viewBox="0 0 24 24"><path d={iconPath("close")} /></svg>
                </button>
              </article>
            {/each}
          </div>
        {/if}

        <div class="two-col filament-layout">
          <form class="panel form" onsubmit={addFilamentRoll}>
            <label class="field">
              <span>Name <em>optional</em></span>
              <input bind:value={filamentName} placeholder="Printer orange" autocomplete="off" />
            </label>
            <div class="field-row">
              <label class="field">
                <span>Material</span>
                <select bind:value={filamentMaterial}>
                  <option>PLA</option><option>PETG</option><option>ABS</option><option>ASA</option
                  ><option>TPU</option><option>NYLON</option><option>PC</option><option>PVA</option
                  ><option>OTHER</option>
                </select>
              </label>
              <label class="field">
                <span>Color <em>optional</em></span>
                <input bind:value={filamentColor} placeholder="Orange or #f97316" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>Weight (g)</span>
                <input bind:value={filamentWeight} type="number" min="1" step="0.1" />
              </label>
              <label class="field">
                <span>Low at (g)</span>
                <input bind:value={filamentLowThreshold} type="number" min="0" step="1" />
              </label>
            </div>
            <button class="submit" type="submit" disabled={filamentSubmitting}>
              {filamentSubmitting ? "Adding…" : "Add roll"}
            </button>
          </form>

          <div class="list">
            <div class="list-summary">
              <strong>{filamentRolls.length} {filamentRolls.length === 1 ? "roll" : "rolls"}</strong
              >
              <span
                >{formatWeight(
                  filamentRolls.reduce((total, roll) => total + roll.remainingWeight, 0)
                )} total</span
              >
            </div>

            {#if filamentLoading}
              <p class="empty">Loading…</p>
            {:else if filamentRolls.length}
              <div class="roll-grid">
                {#each filamentRolls as roll (roll.id)}
                  <article class="card roll">
                    <div class="card-head">
                      <span class="swatch" style:background={roll.color || "#d9ed9d"}></span>
                      <strong>{rollLabel(roll)}</strong>
                      <span class="pill">{roll.material}</span>
                      <button
                        class="remove"
                        onclick={() => removeFilamentRoll(roll.id)}
                        aria-label={`Remove ${rollLabel(roll)}`}
                        ><svg viewBox="0 0 24 24"><path d={iconPath("trash")} /></svg></button
                      >
                    </div>
                    <div class="meter">
                      <span
                        style:width={`${Math.min(100, (roll.remainingWeight / roll.initialWeight) * 100)}%`}
                      ></span>
                    </div>
                    <label class="weight">
                      <input
                        type="number"
                        min="0"
                        max={roll.initialWeight}
                        step="0.1"
                        value={roll.remainingWeight}
                        aria-label={`Remaining weight for ${rollLabel(roll)}`}
                        onchange={(event) => {
                          const value = Number(event.currentTarget.value);
                          if (Number.isFinite(value) && value >= 0) {
                            void updateFilamentRoll(roll.id, { remainingWeight: value });
                          }
                        }}
                      />
                      <span>of {formatWeight(roll.initialWeight)}</span>
                    </label>
                  </article>
                {/each}
              </div>
            {:else}
              <p class="empty">No filament rolls yet.</p>
            {/if}
          </div>
        </div>

        {#if filamentError}<p class="error standalone" role="alert">{filamentError}</p>{/if}
      </section>
    {/if}
  </main>
</div>
