<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/Icon.svelte";
  import { inferTrackingDetails, type Carrier } from "$lib/packages/tracking";

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

  let packages = $state<Package[]>([]);
  let packageName = $state("");
  let trackingUrl = $state("");
  let carrier = $state<Carrier>("usps");
  let trackingNumber = $state("");
  let expectedDeliveryDate = $state("");
  let error = $state("");
  let loading = $state(true);
  let submitting = $state(false);

  onMount(() => void loadPackages());

  async function loadPackages() {
    loading = true;
    try {
      const response = await fetch("/api/packages");
      if (!response.ok) throw new Error();
      packages = sortPackages((await response.json()) as Package[]);
    } catch {
      error = "Could not load packages.";
    } finally {
      loading = false;
    }
  }

  function normalizedUrl(value: string) {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
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
    error = "";
    const name = packageName.trim();
    const number = trackingNumber.trim();
    const customUrl = trackingUrl.trim();
    if (!name) return void (error = "Enter a package name.");
    if (!customUrl && !number) {
      error = "Enter a tracking URL or a carrier tracking number.";
      return;
    }

    let url: string;
    try {
      url = customUrl
        ? normalizedUrl(customUrl)
        : carriers.find((option) => option.id === carrier)!.buildUrl(number);
    } catch {
      error = "Enter a valid tracking URL.";
      return;
    }

    const inferred = customUrl ? inferTrackingDetails(url) : { carrier, trackingNumber: number };
    submitting = true;
    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          carrier: inferred.carrier,
          trackingNumber: inferred.trackingNumber,
          trackingUrl: url,
          expectedDeliveryDate: expectedDeliveryDate || null,
        }),
      });
      if (!response.ok) throw new Error();
      packages = sortPackages([(await response.json()) as Package, ...packages]);
      packageName = "";
      trackingUrl = "";
      trackingNumber = "";
      expectedDeliveryDate = "";
    } catch {
      error = "Could not save the package. Try again.";
    } finally {
      submitting = false;
    }
  }

  async function markDelivered(id: string) {
    error = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delivered: true }),
      });
      if (!response.ok) throw new Error();
      packages = packages.filter((item) => item.id !== id);
    } catch {
      error = "Could not mark the package as delivered.";
    }
  }

  async function updateExpectedDeliveryDate(id: string, value: string) {
    error = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedDeliveryDate: value || null }),
      });
      if (!response.ok) throw new Error();
      packages = sortPackages(
        packages.map((item) =>
          item.id === id ? { ...item, expectedDeliveryDate: value || null } : item
        )
      );
    } catch {
      error = "Could not update the expected delivery date.";
      packages = [...packages];
    }
  }

  async function removePackage(id: string) {
    error = "";
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      packages = packages.filter((item) => item.id !== id);
    } catch {
      error = "Could not remove the package.";
    }
  }

  function carrierLabel(item: Package) {
    if (item.carrier === "custom") return "Tracking link";
    return carriers.find((option) => option.id === item.carrier)?.label ?? item.carrier;
  }
</script>

<section class="packages-layout">
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
          {#each carriers as option}<option value={option.id}>{option.label}</option>{/each}
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
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="submit" type="submit" disabled={submitting}>
      {submitting ? "Adding…" : "Add package"}
    </button>
  </form>

  <div class="list">
    <div class="list-summary">
      <strong>{packages.filter((item) => !item.delivered).length} on the way</strong>
      <span>{packages.length} total</span>
    </div>
    {#if loading}
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
                onchange={(event) => updateExpectedDeliveryDate(item.id, event.currentTarget.value)}
              />
            </label>
            <a href={item.trackingUrl} target="_blank" rel="noopener"
              >Track<Icon name="external" /></a
            >
            {#if !item.delivered}<button onclick={() => markDelivered(item.id)}>Delivered</button
              >{/if}
            <button
              class="remove"
              onclick={() => removePackage(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              <Icon name="trash" />
            </button>
          </div>
        </article>
      {/each}
    {:else}
      <p class="empty">No packages yet.</p>
    {/if}
  </div>
</section>

<style>
  .packages-layout {
    display: grid;
    grid-template-columns: minmax(280px, 0.7fr) minmax(360px, 1.3fr);
    gap: 20px;
    align-items: start;
  }
  .panel,
  .card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .form {
    padding: 20px;
    display: grid;
    gap: 14px;
  }
  .field {
    display: grid;
    gap: 6px;
  }
  .field > span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }
  .field em {
    margin-left: 4px;
    color: var(--faint);
    font-style: normal;
    font-weight: 400;
  }
  .field input,
  .field select,
  .inline-date input {
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
  }
  .field input,
  .field select {
    width: 100%;
    min-width: 0;
    height: 38px;
    padding: 0 11px;
    font-size: 13px;
  }
  .field input:focus,
  .field select:focus,
  .inline-date input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .carrier-row {
    grid-template-columns: minmax(90px, 0.4fr) 0.6fr;
  }
  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--faint);
    font-size: 12px;
  }
  .divider::before,
  .divider::after {
    height: 1px;
    flex: 1;
    content: "";
    background: var(--line);
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
  .submit {
    height: 38px;
    padding: 0 16px;
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--ink);
    color: white;
    font-size: 13px;
    font-weight: 600;
  }
  .submit:hover:not(:disabled) {
    background: #2b3a31;
  }
  .list {
    min-width: 0;
    display: grid;
    gap: 8px;
  }
  .list-summary {
    padding: 4px 2px 10px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
  }
  .list-summary strong,
  .card-head strong {
    font-weight: 600;
  }
  .list-summary span {
    color: var(--faint);
    font-size: 12px;
  }
  .card {
    min-width: 0;
    padding: 14px 16px;
  }
  .card.done {
    background: transparent;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-head strong {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill {
    padding: 2px 8px;
    border-radius: 99px;
    background: var(--green-soft);
    color: var(--green);
    font-size: 11px;
    font-weight: 600;
  }
  .pill.complete {
    background: #e6e5dd;
    color: var(--muted);
  }
  .meta {
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
  }
  .meta code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mono);
  }
  .card-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .card-actions a,
  .card-actions button {
    height: 30px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    color: var(--ink);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
  }
  .card-actions a:hover,
  .card-actions button:hover {
    border-color: var(--muted);
  }
  .card-actions :global(svg) {
    width: 13px;
    height: 13px;
  }
  .inline-date {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 12px;
  }
  .inline-date input {
    height: 30px;
    padding: 0 6px;
    font-size: 12px;
  }
  .card-actions .remove {
    width: 28px;
    height: 28px;
    margin-left: auto;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--faint);
  }
  .card-actions .remove:hover {
    border-color: transparent;
    background: var(--red-soft);
    color: var(--red);
  }
  .empty {
    padding: 40px 0;
    color: var(--faint);
    text-align: center;
  }
  @media (max-width: 820px) {
    .packages-layout {
      grid-template-columns: 1fr;
    }
    .form {
      order: 2;
    }
  }
  @media (max-width: 480px) {
    .field-row,
    .carrier-row {
      grid-template-columns: 1fr;
    }
  }
</style>
