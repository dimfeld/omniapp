<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/Icon.svelte";
  import { inferTrackingDetails, type Carrier } from "$lib/packages/tracking";
  import type { PackageRecord, PackageTrackingLocation } from "$lib/packages/types";

  type Package = Omit<PackageRecord, "carrier"> & {
    carrier: Carrier | "custom";
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

  let editDialog = $state<HTMLDialogElement | null>(null);
  let editing = $state<Package | null>(null);
  let editName = $state("");
  let editCarrier = $state<Carrier | "custom">("usps");
  let editTrackingNumber = $state("");
  let editTrackingUrl = $state("");
  let editError = $state("");
  let savingEdit = $state(false);

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

  function openEdit(item: Package) {
    editing = item;
    editName = item.name;
    editCarrier = item.carrier;
    editTrackingNumber = item.trackingNumber;
    editTrackingUrl = item.trackingUrl;
    editError = "";
    editDialog?.showModal();
  }

  async function saveEdit(event: SubmitEvent) {
    event.preventDefault();
    const item = editing;
    if (!item) return;

    const name = editName.trim();
    const number = editTrackingNumber.trim();
    const enteredUrl = editTrackingUrl.trim();
    const carrierOption = carriers.find((option) => option.id === editCarrier);
    if (!name) return void (editError = "Enter a package name.");
    if (!enteredUrl && !(carrierOption && number)) {
      editError = "Enter a tracking URL or a carrier tracking number.";
      return;
    }

    let url: string;
    try {
      url = enteredUrl ? normalizedUrl(enteredUrl) : carrierOption!.buildUrl(number);
    } catch {
      editError = "Enter a valid tracking URL.";
      return;
    }

    editError = "";
    savingEdit = true;
    try {
      const response = await fetch(`/api/packages/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          carrier: editCarrier,
          trackingNumber: number,
          trackingUrl: url,
        }),
      });
      if (!response.ok) throw new Error();
      const updated = (await response.json()) as Package;
      packages = sortPackages(packages.map((entry) => (entry.id === item.id ? updated : entry)));
      editDialog?.close();
    } catch {
      editError = "Could not save the package. Try again.";
    } finally {
      savingEdit = false;
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

  function trackingStatus(item: Package) {
    if (item.delivered) return "Delivered";
    if (item.tracking?.status) return item.tracking.status;
    if (item.tracking?.error) return "Tracking unavailable";
    return item.carrier === "fedex" ? "Tracking pending" : "In transit";
  }

  function formatTimestamp(value: string | null | undefined) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function formatCheckedAt(value: number) {
    return formatTimestamp(new Date(value).toISOString());
  }

  function formatLocation(location: PackageTrackingLocation | null) {
    if (!location) return "";
    const cityRegion = [location.city, location.stateOrProvinceCode].filter(Boolean).join(", ");
    return [cityRegion, location.postalCode, location.countryCode].filter(Boolean).join(" ");
  }

  function formatDeliveryWindow(start: string | null, end: string | null) {
    if (!start && !end) return "";
    if (start === end || !end) return formatTimestamp(start);
    if (!start) return formatTimestamp(end);
    return `${formatTimestamp(start)} – ${formatTimestamp(end)}`;
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
      <strong
        >{packages.filter((item) => !item.delivered && !item.tracking?.complete).length} on the way</strong
      >
      <span>{packages.length} total</span>
    </div>
    {#if loading}
      <p class="empty">Loading…</p>
    {:else if packages.length}
      {#each packages as item (item.id)}
        <article class="card" class:done={item.delivered || item.tracking?.complete}>
          <div class="card-head">
            <strong>{item.name}</strong>
            <span
              class="pill"
              class:complete={item.delivered || item.tracking?.complete}
              class:warning={item.tracking?.error}>{trackingStatus(item)}</span
            >
          </div>
          <p class="meta">
            {carrierLabel(item)}{#if item.trackingNumber}<span>·</span><code
                >{item.trackingNumber}</code
              >{/if}
          </p>
          {#if item.tracking?.events[0]}
            <p class="latest-event">
              <span>{item.tracking.events[0].description}</span>
              {#if formatLocation(item.tracking.events[0].location)}
                <span>·</span><span>{formatLocation(item.tracking.events[0].location)}</span>
              {/if}
              {#if item.tracking.events[0].occurredAt}
                <span>·</span><time datetime={item.tracking.events[0].occurredAt}
                  >{formatTimestamp(item.tracking.events[0].occurredAt)}</time
                >
              {/if}
            </p>
          {:else if item.tracking?.description}
            <p class="latest-event">{item.tracking.description}</p>
          {/if}
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
            {#if item.carrier === "fedex"}
              <button popovertarget={`tracking-${item.id}`}>Details</button>
            {/if}
            {#if !item.delivered}<button onclick={() => markDelivered(item.id)}>Delivered</button
              >{/if}
            <div class="icon-actions">
              <button
                class="icon-button"
                onclick={() => openEdit(item)}
                aria-label={`Edit ${item.name}`}
              >
                <Icon name="pencil" />
              </button>
              <button
                class="icon-button remove"
                onclick={() => removePackage(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        </article>
        {#if item.carrier === "fedex"}
          <div id={`tracking-${item.id}`} class="tracking-popover" popover="auto">
            <header class="tracking-header">
              <div>
                <span>{carrierLabel(item)} tracking</span>
                <strong>{item.name}</strong>
              </div>
              <button
                class="popover-close"
                popovertarget={`tracking-${item.id}`}
                popovertargetaction="hide"
                aria-label="Close tracking details"
              >
                <Icon name="close" />
              </button>
            </header>

            <section class="tracking-current">
              <span
                class="pill"
                class:complete={item.tracking?.complete}
                class:warning={item.tracking?.error}>{trackingStatus(item)}</span
              >
              {#if item.tracking?.description}<p>{item.tracking.description}</p>{/if}
              {#if item.tracking?.error}<p class="tracking-error">{item.tracking.error}</p>{/if}
            </section>

            {#if item.tracking}
              <dl class="tracking-summary">
                {#if formatDeliveryWindow(item.tracking.estimatedDeliveryStart, item.tracking.estimatedDeliveryEnd)}
                  <div>
                    <dt>FedEx estimate</dt>
                    <dd>
                      {formatDeliveryWindow(
                        item.tracking.estimatedDeliveryStart,
                        item.tracking.estimatedDeliveryEnd
                      )}
                    </dd>
                  </div>
                {/if}
                {#if item.tracking.details.service}
                  <div>
                    <dt>Service</dt>
                    <dd>{item.tracking.details.service}</dd>
                  </div>
                {/if}
                {#if item.tracking.details.packageType}
                  <div>
                    <dt>Package</dt>
                    <dd>{item.tracking.details.packageType}</dd>
                  </div>
                {/if}
                {#if item.tracking.details.signedBy}
                  <div>
                    <dt>Received by</dt>
                    <dd>{item.tracking.details.signedBy}</dd>
                  </div>
                {/if}
                <div>
                  <dt>Last checked</dt>
                  <dd>{formatCheckedAt(item.tracking.lastCheckedAt)}</dd>
                </div>
              </dl>

              {#if item.tracking.details.origin || item.tracking.details.destination}
                <div class="tracking-route">
                  <div>
                    <span>From</span>
                    <strong
                      >{formatLocation(item.tracking.details.origin) || "Not available"}</strong
                    >
                  </div>
                  <span aria-hidden="true">→</span>
                  <div>
                    <span>To</span>
                    <strong
                      >{formatLocation(item.tracking.details.destination) ||
                        "Not available"}</strong
                    >
                  </div>
                </div>
              {/if}

              <div class="tracking-history">
                <h2>Tracking history</h2>
                {#if item.tracking.events.length}
                  <ol>
                    {#each item.tracking.events as trackingEvent}
                      <li>
                        <span class="timeline-dot"></span>
                        <div>
                          <strong>{trackingEvent.description}</strong>
                          {#if formatLocation(trackingEvent.location)}
                            <span>{formatLocation(trackingEvent.location)}</span>
                          {/if}
                          {#if trackingEvent.occurredAt}
                            <time datetime={trackingEvent.occurredAt}
                              >{formatTimestamp(trackingEvent.occurredAt)}</time
                            >
                          {/if}
                        </div>
                      </li>
                    {/each}
                  </ol>
                {:else}
                  <p class="no-history">FedEx has not reported a scan yet.</p>
                {/if}
              </div>
            {:else}
              <p class="no-history">Tracking details will appear after the first FedEx check.</p>
            {/if}
          </div>
        {/if}
      {/each}
    {:else}
      <p class="empty">No packages yet.</p>
    {/if}
  </div>
</section>

<dialog class="edit-dialog" bind:this={editDialog} onclose={() => (editing = null)}>
  {#if editing}
    <form class="edit-form" onsubmit={saveEdit}>
      <div class="edit-head">
        <strong>Edit package</strong>
        <button
          type="button"
          class="icon-button"
          onclick={() => editDialog?.close()}
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>
      <label class="field">
        <span>Name</span>
        <input bind:value={editName} autocomplete="off" />
      </label>
      <div class="field-row carrier-row">
        <label class="field">
          <span>Carrier</span>
          <select bind:value={editCarrier}>
            {#each carriers as option}<option value={option.id}>{option.label}</option>{/each}
            <option value="custom">Tracking link</option>
          </select>
        </label>
        <label class="field">
          <span>Tracking number</span>
          <input bind:value={editTrackingNumber} autocomplete="off" />
        </label>
      </div>
      <label class="field">
        <span>Tracking URL <em>clear to rebuild from the carrier</em></span>
        <input bind:value={editTrackingUrl} type="text" inputmode="url" autocomplete="url" />
      </label>
      {#if editError}<p class="error" role="alert">{editError}</p>{/if}
      <div class="edit-actions">
        <button type="button" class="cancel" onclick={() => editDialog?.close()}>Cancel</button>
        <button class="submit" type="submit" disabled={savingEdit}>
          {savingEdit ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  {/if}
</dialog>

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
  .pill.warning {
    background: var(--amber-soft);
    color: var(--amber);
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
  .latest-event {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    color: var(--muted);
    font-size: 12px;
  }
  .card-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .card-actions a,
  .card-actions > button:not(.icon-button) {
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
  .card-actions > button:not(.icon-button):hover {
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
  .icon-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .icon-button {
    width: 28px;
    height: 28px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--faint);
  }
  .icon-button:hover {
    border-color: transparent;
    background: var(--line);
    color: var(--ink);
  }
  .icon-button.remove:hover {
    background: var(--red-soft);
    color: var(--red);
  }
  .edit-dialog {
    width: min(420px, calc(100vw - 32px));
    /* Tailwind's preflight resets the margin that centers a modal dialog. */
    margin: auto;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
  }
  .edit-dialog::backdrop {
    background: rgb(27 36 31 / 35%);
  }
  .edit-form {
    padding: 18px 20px 20px;
    display: grid;
    gap: 14px;
  }
  .edit-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .edit-head strong {
    font-size: 15px;
    font-weight: 600;
  }
  .edit-actions {
    margin-top: 2px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .edit-actions .cancel {
    height: 38px;
    padding: 0 16px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    font-size: 13px;
    font-weight: 500;
  }
  .edit-actions .cancel:hover {
    border-color: var(--muted);
  }
  .empty {
    padding: 40px 0;
    color: var(--faint);
    text-align: center;
  }
  .tracking-popover {
    width: min(560px, calc(100vw - 24px));
    max-height: calc(100vh - 32px);
    margin: auto;
    padding: 0;
    overflow: auto;
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 20px 60px rgb(27 36 31 / 22%);
  }
  .tracking-popover::backdrop {
    background: rgb(27 36 31 / 18%);
  }
  .tracking-header {
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--line);
  }
  .tracking-header > div {
    min-width: 0;
    flex: 1;
    display: grid;
  }
  .tracking-header span,
  .tracking-route span {
    color: var(--faint);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .tracking-header strong {
    overflow: hidden;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .popover-close {
    width: 32px;
    height: 32px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
  }
  .popover-close:hover {
    background: #ebe9e1;
    color: var(--ink);
  }
  .tracking-current {
    padding: 18px 20px 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tracking-current p {
    color: var(--muted);
    font-size: 13px;
  }
  .tracking-current .tracking-error {
    width: 100%;
    color: var(--red);
  }
  .tracking-summary {
    margin: 16px 20px 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  .tracking-summary div {
    min-width: 0;
    padding: 10px 12px;
  }
  .tracking-summary div:nth-child(even) {
    border-left: 1px solid var(--line);
  }
  .tracking-summary div:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }
  .tracking-summary dt {
    color: var(--faint);
    font-size: 11px;
  }
  .tracking-summary dd {
    margin: 2px 0 0;
    overflow-wrap: anywhere;
    font-size: 12px;
    font-weight: 500;
  }
  .tracking-route {
    margin: 16px 20px 0;
    padding: 12px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    border-radius: 7px;
    background: var(--green-soft);
  }
  .tracking-route > span {
    color: var(--green);
    font-size: 16px;
  }
  .tracking-route div {
    display: grid;
  }
  .tracking-route div:last-child {
    text-align: right;
  }
  .tracking-route strong {
    font-size: 12px;
    font-weight: 600;
  }
  .tracking-history {
    padding: 18px 20px 20px;
  }
  .tracking-history h2 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .tracking-history ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tracking-history li {
    min-height: 54px;
    position: relative;
    display: grid;
    grid-template-columns: 12px 1fr;
    gap: 10px;
  }
  .tracking-history li:not(:last-child)::before {
    width: 1px;
    position: absolute;
    top: 12px;
    bottom: 0;
    left: 5px;
    content: "";
    background: var(--line-strong);
  }
  .timeline-dot {
    width: 9px;
    height: 9px;
    margin-top: 4px;
    position: relative;
    z-index: 1;
    border: 2px solid var(--paper);
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 0 1px var(--green);
  }
  .tracking-history li div {
    padding-bottom: 14px;
    display: grid;
  }
  .tracking-history li strong {
    font-size: 12px;
    font-weight: 600;
  }
  .tracking-history li span,
  .tracking-history li time,
  .no-history {
    color: var(--muted);
    font-size: 12px;
  }
  .no-history {
    padding: 20px;
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
    .tracking-summary {
      grid-template-columns: 1fr;
    }
    .tracking-summary div:nth-child(even) {
      border-left: 0;
    }
    .tracking-summary div:nth-child(n + 2) {
      border-top: 1px solid var(--line);
    }
  }
</style>
