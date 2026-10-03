<script lang="ts">
  import { onMount } from "svelte";
  import { base } from "$app/paths";

  type Watch = {
    id: string;
    asin: string;
    name: string;
    targetCents: number;
    priceCents: number | null;
    checkedAt: number | null;
    error: string | null;
    alertActive: boolean;
  };
  let watches = $state<Watch[]>([]);
  let configured = $state(false);
  let pushPublicKey = $state<string | null>(null);
  let notificationState = $state("Check notification access");
  let url = $state("");
  let name = $state("");
  let target = $state("");
  let error = $state("");
  let busy = $state(false);
  let loading = $state(true);

  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const date = (value: number) => new Date(value).toLocaleString();

  onMount(() => {
    void load();
    if ("Notification" in window) notificationState = "Enable notifications";
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  });

  async function load() {
    try {
      const response = await fetch(`${base}/api/amazon`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        watches: Watch[];
        configured: boolean;
        pushPublicKey: string | null;
      };
      watches = data.watches;
      configured = data.configured;
      pushPublicKey = data.pushPublicKey;
      error = "";
    } catch {
      error = "Could not load price watches.";
    } finally {
      loading = false;
    }
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = "";
    try {
      const response = await fetch(`${base}/api/amazon`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, name, target: Number(target) }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Could not add the watch.");
      url = "";
      name = "";
      target = "";
      await load();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not add the watch.";
    } finally {
      busy = false;
    }
  }

  async function change(id: string, update: object) {
    error = "";
    try {
      const response = await fetch(`${base}/api/amazon/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error(((await response.json()) as { message: string }).message);
      await load();
      window.dispatchEvent(new Event("amazon-alerts-changed"));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not update the watch.";
    }
  }

  async function remove(id: string) {
    error = "";
    try {
      const response = await fetch(`${base}/api/amazon/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      await load();
      window.dispatchEvent(new Event("amazon-alerts-changed"));
    } catch {
      error = "Could not remove the watch.";
    }
  }

  function publicKeyBytes(value: string) {
    const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  }

  async function enableNotifications() {
    if (
      !pushPublicKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      error = "Push notifications are not available in this browser or on this server.";
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        error = "Allow notifications in the browser to receive price alerts.";
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKeyBytes(pushPublicKey),
        }));
      const response = await fetch(`${base}/api/amazon/subscription`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error();
      notificationState = "Notifications enabled";
      error = "";
    } catch {
      error = "Could not enable push notifications.";
    }
  }
</script>

<section class="watch-layout">
  <div class="panel setup">
    <h2>Add a product</h2>
    <p>
      Watch a product on Amazon.com. Prices are checked every 2 hours. An alert starts when the
      price is below your target.
    </p>
    <form onsubmit={add}>
      <label
        >Amazon product URL or ASIN<input
          bind:value={url}
          required
          placeholder="https://www.amazon.com/dp/…"
          autocomplete="off"
        /></label
      >
      <label
        >Name <span>(optional)</span><input
          bind:value={name}
          placeholder="Use the Amazon product name"
          autocomplete="off"
        /></label
      >
      <label
        >Target price in USD<input
          bind:value={target}
          type="number"
          min="0.01"
          step="0.01"
          required
          placeholder="0.00"
        /></label
      >
      <button type="submit" disabled={busy}>{busy ? "Adding…" : "Add watch"}</button>
    </form>
    {#if !configured}<p class="notice">
        Price checks need Amazon Creators API credentials on the server.
      </p>{/if}
    {#if pushPublicKey}
      <button
        class="secondary"
        type="button"
        onclick={enableNotifications}
        disabled={notificationState === "Notifications enabled"}>{notificationState}</button
      >
    {:else}
      <p class="notice">
        Push notifications need server setup. Price alerts still appear in the app.
      </p>
    {/if}
  </div>
  <div class="list">
    <h2>Watched products <span>{watches.length}</span></h2>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if loading}<p class="empty">Loading watches…</p>
    {:else if !watches.length}<p class="empty">No products are watched yet.</p>
    {:else}
      {#each watches as watch (watch.id)}
        <article class="panel card">
          <div class="card-head">
            <h3>{watch.name}</h3>
            {#if watch.alertActive}<span class="badge">Below target</span>{/if}
          </div>
          <a
            href={`https://www.amazon.com/dp/${watch.asin}`}
            target="_blank"
            rel="noopener noreferrer">View on Amazon ↗</a
          >
          <dl>
            <div>
              <dt>Current price</dt>
              <dd>{watch.priceCents === null ? "—" : money(watch.priceCents)}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{money(watch.targetCents)}</dd>
            </div>
          </dl>
          {#if watch.checkedAt}<p class="meta">Checked {date(watch.checkedAt)}</p>{/if}
          {#if watch.error}<p class="watch-error">{watch.error}</p>{/if}
          <div class="actions">
            <button
              type="button"
              onclick={() => {
                const value = prompt(
                  "New target price in USD",
                  (watch.targetCents / 100).toFixed(2)
                );
                if (value !== null) void change(watch.id, { target: Number(value) });
              }}>Change target</button
            >
            {#if watch.alertActive}<button
                type="button"
                onclick={() => change(watch.id, { dismiss: true })}>Dismiss alert</button
              >{/if}
            <button type="button" onclick={() => remove(watch.id)}>Remove</button>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>

<style>
  .watch-layout {
    display: grid;
    grid-template-columns: minmax(280px, 0.7fr) minmax(320px, 1.3fr);
    gap: 20px;
    align-items: start;
  }
  .panel {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .setup {
    padding: 20px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .setup > p {
    color: var(--muted);
    font-size: 13px;
  }
  form {
    margin-top: 18px;
    display: grid;
    gap: 14px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  label span {
    color: var(--faint);
    font-weight: 400;
  }
  input {
    height: 38px;
    min-width: 0;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    font-size: 13px;
  }
  button {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    font-size: 12px;
  }
  form button {
    height: 38px;
    border-color: var(--ink);
    background: var(--ink);
    color: white;
    font-weight: 600;
  }
  .secondary {
    margin-top: 14px;
  }
  .notice {
    margin-top: 14px;
    padding: 10px;
    border-radius: 6px;
    background: var(--amber-soft);
    color: var(--amber) !important;
  }
  .list {
    display: grid;
    gap: 8px;
  }
  .list > h2 {
    padding: 4px 2px 10px;
    border-bottom: 1px solid var(--line);
  }
  .list > h2 span {
    float: right;
    color: var(--faint);
    font-size: 12px;
  }
  .card {
    padding: 16px;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 14px;
  }
  .badge {
    padding: 3px 8px;
    border-radius: 99px;
    background: var(--green-soft);
    color: var(--green);
    font-size: 11px;
    white-space: nowrap;
  }
  .card > a {
    color: var(--green);
    font-size: 12px;
  }
  dl {
    margin: 14px 0 0;
    display: flex;
    gap: 28px;
  }
  dt,
  .meta {
    color: var(--faint);
    font-size: 11px;
  }
  dd {
    margin: 2px 0 0;
    font-size: 16px;
    font-weight: 600;
  }
  .meta {
    margin-top: 8px;
  }
  .watch-error,
  .error {
    padding: 10px;
    border-radius: 6px;
    background: var(--red-soft);
    color: var(--red);
    font-size: 12px;
  }
  .watch-error {
    margin-top: 8px;
  }
  .actions {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .empty {
    padding: 40px 0;
    color: var(--faint);
    text-align: center;
  }
  @media (max-width: 820px) {
    .watch-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
