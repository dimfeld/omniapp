<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/Icon.svelte";
  import ColorField from "$lib/ColorField.svelte";
  import { colorLabel } from "$lib/filament/colors";
  import { parseGcodeFilament, type FilamentUse } from "$lib/filament/gcode";

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

  let rolls = $state<FilamentRoll[]>([]);
  let name = $state("");
  let material = $state("PLA");
  let color = $state("");
  let weight = $state("1000");
  let lowThreshold = $state("100");
  let error = $state("");
  let loading = $state(true);
  let submitting = $state(false);
  let gcodeUses = $state<FilamentUse[]>([]);
  let gcodeFilename = $state("");
  let assignments = $state<Record<number, string>>({});
  let applying = $state(false);
  let useAmounts = $state<Record<string, string>>({});
  let useErrors = $state<Record<string, string>>({});
  let recordingRollId = $state<string | null>(null);
  let usePopoverStyles = $state<Record<string, string>>({});
  const lowRolls = $derived(
    rolls.filter((roll) => roll.remainingWeight <= roll.lowThreshold && !roll.lowAlertDismissed)
  );

  onMount(() => void loadRolls());

  async function loadRolls() {
    loading = true;
    try {
      const response = await fetch("/api/filament");
      if (!response.ok) throw new Error();
      rolls = (await response.json()) as FilamentRoll[];
    } catch {
      error = "Could not load filament rolls.";
    } finally {
      loading = false;
    }
  }

  async function addRoll(event: SubmitEvent) {
    event.preventDefault();
    error = "";
    const initialWeight = Number(weight);
    const threshold = Number(lowThreshold);
    if (!material.trim() || !Number.isFinite(initialWeight) || initialWeight <= 0) {
      error = "Enter a material and a valid roll weight.";
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      error = "Enter a valid low-weight threshold.";
      return;
    }

    submitting = true;
    try {
      const response = await fetch("/api/filament", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, material, color, initialWeight, lowThreshold: threshold }),
      });
      if (!response.ok) throw new Error();
      rolls = [(await response.json()) as FilamentRoll, ...rolls];
      name = "";
      color = "";
      weight = "1000";
    } catch {
      error = "Could not save the filament roll. Try again.";
    } finally {
      submitting = false;
    }
  }

  async function updateRoll(id: string, update: Partial<FilamentRoll>) {
    error = "";
    try {
      const response = await fetch(`/api/filament/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error();
      const updated = (await response.json()) as FilamentRoll;
      rolls = rolls.map((roll) => (roll.id === id ? updated : roll));
    } catch {
      error = "Could not update the filament roll.";
      rolls = [...rolls];
    }
  }

  async function removeRoll(id: string) {
    error = "";
    try {
      const response = await fetch(`/api/filament/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      rolls = rolls.filter((roll) => roll.id !== id);
    } catch {
      error = "Could not remove the filament roll.";
    }
  }

  async function readGcode(event: Event) {
    error = "";
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    gcodeFilename = file.name;
    const parsed = parseGcodeFilament(await file.text());
    if (!parsed.length) {
      gcodeUses = [];
      assignments = {};
      error = "No filament amount was found in this G-code file.";
      return;
    }
    gcodeUses = parsed;
    assignments = Object.fromEntries(
      parsed.map((_, index) => [index, rolls[index]?.id ?? rolls[0]?.id ?? ""])
    );
  }

  async function applyGcodeUse() {
    error = "";
    const consumptions = gcodeUses.map((use, index) => ({
      id: assignments[index],
      grams: use.grams,
    }));
    if (consumptions.some((item) => !item.id)) {
      error = "Choose a roll for each filament amount.";
      return;
    }
    applying = true;
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
      rolls = rolls.map((roll) => updates.get(roll.id) ?? roll);
      gcodeUses = [];
      gcodeFilename = "";
      assignments = {};
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not subtract filament.";
    } finally {
      applying = false;
    }
  }

  function positionUsePopover(event: ToggleEvent, rollId: string) {
    if (event.newState !== "open") return;
    const trigger = document.getElementById(`record-use-${rollId}`);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    usePopoverStyles = {
      ...usePopoverStyles,
      [rollId]: `top: ${rect.bottom + 6}px; left: ${Math.min(rect.left, window.innerWidth - 236)}px;`,
    };
    useErrors = { ...useErrors, [rollId]: "" };
    requestAnimationFrame(() => document.getElementById(`use-amount-${rollId}`)?.focus());
  }

  async function recordUse(event: SubmitEvent, roll: FilamentRoll) {
    event.preventDefault();
    const grams = Number(useAmounts[roll.id]);
    if (!Number.isFinite(grams) || grams <= 0) {
      useErrors = { ...useErrors, [roll.id]: "Enter a valid used amount." };
      return;
    }
    if (grams > roll.remainingWeight) {
      useErrors = { ...useErrors, [roll.id]: "The used amount is greater than the filament left." };
      return;
    }

    recordingRollId = roll.id;
    useErrors = { ...useErrors, [roll.id]: "" };
    try {
      const response = await fetch("/api/filament", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consumptions: [{ id: roll.id, grams }] }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Could not record filament use.");
      }
      const updated = (await response.json()) as FilamentRoll[];
      const nextRoll = updated[0];
      if (nextRoll) rolls = rolls.map((item) => (item.id === nextRoll.id ? nextRoll : item));
      useAmounts = { ...useAmounts, [roll.id]: "" };
      document.getElementById(`use-popover-${roll.id}`)?.hidePopover();
    } catch (cause) {
      useErrors = {
        ...useErrors,
        [roll.id]: cause instanceof Error ? cause.message : "Could not record filament use.",
      };
    } finally {
      recordingRollId = null;
    }
  }

  function rollLabel(roll: FilamentRoll) {
    if (roll.name) return roll.name;
    const label = colorLabel(roll.color);
    return label ? `${label} ${roll.material}` : roll.material;
  }

  function formatWeight(value: number) {
    return `${Math.round(value * 10) / 10} g`;
  }
</script>

<section class="filament">
  <div class="panel gcode">
    <div class="gcode-head">
      <div>
        <strong>Subtract a print</strong>
        <span>Upload G-code from PrusaSlicer, OrcaSlicer, Bambu Studio, or Cura.</span>
      </div>
      <label class="upload">
        <Icon name="upload" />
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
              {#if use.color}<span class="gcode-color"
                  ><i style:background={use.color}></i>{use.color}</span
                >{/if}
            </div>
            <select
              value={assignments[index] ?? ""}
              aria-label={`Roll for ${use.label}`}
              onchange={(event) =>
                (assignments = { ...assignments, [index]: event.currentTarget.value })}
            >
              <option value="">Choose a roll</option>
              {#each rolls as roll}
                <option value={roll.id}
                  >{rollLabel(roll)} · {formatWeight(roll.remainingWeight)}</option
                >
              {/each}
            </select>
          </div>
        {/each}
        <button class="submit accent" onclick={applyGcodeUse} disabled={applying || !rolls.length}>
          {applying ? "Subtracting…" : "Subtract from rolls"}
        </button>
      </div>
    {/if}
  </div>

  {#if lowRolls.length}
    <div class="low" aria-label="Low filament rolls">
      {#each lowRolls as roll (roll.id)}
        <article>
          <span class="swatch" style:background={roll.color || "#d9ed9d"}></span>
          <strong>{rollLabel(roll)}</strong>
          <span>{formatWeight(roll.remainingWeight)} left</span>
          <button
            onclick={() => updateRoll(roll.id, { lowAlertDismissed: true })}
            aria-label={`Dismiss low filament alert for ${rollLabel(roll)}`}
            ><Icon name="close" /></button
          >
        </article>
      {/each}
    </div>
  {/if}

  <div class="filament-layout">
    <form class="panel form" onsubmit={addRoll}>
      <label class="field">
        <span>Name <em>optional</em></span>
        <input bind:value={name} placeholder="Printer orange" autocomplete="off" />
      </label>
      <div class="field-row">
        <label class="field">
          <span>Material</span>
          <select bind:value={material}>
            <option>PLA</option><option>PETG</option><option>ABS</option><option>ASA</option><option
              >TPU</option
            ><option>NYLON</option><option>PC</option><option>PVA</option><option>OTHER</option>
          </select>
        </label>
        <div class="field">
          <span>Color <em>optional</em></span>
          <ColorField bind:value={color} placeholder="Color" />
        </div>
      </div>
      <div class="field-row">
        <label class="field">
          <span>Weight (g)</span>
          <input bind:value={weight} type="number" min="1" step="0.1" />
        </label>
        <label class="field">
          <span>Low at (g)</span>
          <input bind:value={lowThreshold} type="number" min="0" step="1" />
        </label>
      </div>
      <button class="submit" type="submit" disabled={submitting}
        >{submitting ? "Adding…" : "Add roll"}</button
      >
    </form>

    <div class="list">
      <div class="list-summary">
        <strong>{rolls.length} {rolls.length === 1 ? "roll" : "rolls"}</strong>
        <span
          >{formatWeight(rolls.reduce((total, roll) => total + roll.remainingWeight, 0))} total</span
        >
      </div>
      {#if loading}
        <p class="empty">Loading…</p>
      {:else if rolls.length}
        <div class="roll-grid">
          {#each rolls as roll (roll.id)}
            <article class="card roll">
              <div class="card-head">
                <span class="swatch" style:background={roll.color || "#d9ed9d"}></span>
                <strong>{rollLabel(roll)}</strong>
                <span class="pill">{roll.material}</span>
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
                    if (Number.isFinite(value) && value >= 0)
                      void updateRoll(roll.id, { remainingWeight: value });
                  }}
                />
                <span>of {formatWeight(roll.initialWeight)}</span>
              </label>
              <div class="card-actions">
                <button
                  id={`record-use-${roll.id}`}
                  type="button"
                  class="record-use"
                  popovertarget={`use-popover-${roll.id}`}
                  aria-label={`Record filament use for ${rollLabel(roll)}`}
                >
                  Record use
                </button>
                <div
                  id={`use-popover-${roll.id}`}
                  class="use-popover"
                  popover="auto"
                  aria-label={`Record filament use for ${rollLabel(roll)}`}
                  style={usePopoverStyles[roll.id] ?? ""}
                  ontoggle={(event) => positionUsePopover(event, roll.id)}
                >
                  <form onsubmit={(event) => void recordUse(event, roll)}>
                    <strong>Record filament use</strong>
                    <label class="field">
                      <span>Used (g)</span>
                      <input
                        id={`use-amount-${roll.id}`}
                        type="number"
                        min="0.1"
                        max={roll.remainingWeight}
                        step="0.1"
                        value={useAmounts[roll.id] ?? ""}
                        oninput={(event) =>
                          (useAmounts = { ...useAmounts, [roll.id]: event.currentTarget.value })}
                      />
                    </label>
                    {#if useErrors[roll.id]}<p class="use-error" role="alert">
                        {useErrors[roll.id]}
                      </p>{/if}
                    <div class="use-actions">
                      <button
                        type="button"
                        class="cancel"
                        onclick={() =>
                          document.getElementById(`use-popover-${roll.id}`)?.hidePopover()}
                      >
                        Cancel
                      </button>
                      <button type="submit" class="submit" disabled={recordingRollId === roll.id}>
                        {recordingRollId === roll.id ? "Recording…" : "Record use"}
                      </button>
                    </div>
                  </form>
                </div>
                <button
                  class="remove"
                  onclick={() => removeRoll(roll.id)}
                  aria-label={`Remove ${rollLabel(roll)}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <p class="empty">No filament rolls yet.</p>
      {/if}
    </div>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .filament {
    display: grid;
    gap: 20px;
  }
  .panel,
  .card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .gcode {
    padding: 16px 20px;
  }
  .gcode-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .gcode-head > div {
    display: grid;
    gap: 2px;
  }
  .gcode-head strong,
  .gcode-use strong,
  .low strong,
  .list-summary strong,
  .card-head strong {
    font-weight: 600;
  }
  .gcode-head > div > span {
    color: var(--muted);
    font-size: 12px;
  }
  .upload {
    position: relative;
    height: 36px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--ink);
    border-radius: 6px;
    background: var(--ink);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .upload span {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .upload input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .gcode-uses {
    margin-top: 14px;
    padding-top: 14px;
    display: grid;
    gap: 8px;
    border-top: 1px solid var(--line);
  }
  .gcode-use {
    display: grid;
    grid-template-columns: minmax(120px, 0.4fr) minmax(200px, 0.6fr);
    align-items: center;
    gap: 16px;
  }
  .gcode-use > div {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
  }
  .gcode-use > div span {
    color: var(--green);
    font-family: var(--mono);
    font-size: 12px;
  }
  .gcode-color {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .gcode-color i {
    width: 10px;
    height: 10px;
    border: 1px solid var(--line-strong);
    border-radius: 50%;
  }
  .gcode-use select,
  .field input,
  .field select,
  .weight input {
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
  }
  .gcode-use select {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    font-size: 13px;
  }
  .gcode-uses .submit {
    justify-self: end;
  }
  .low {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
  }
  .low article {
    min-width: 0;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #ecdca6;
    border-radius: var(--radius);
    background: var(--amber-soft);
    color: var(--amber);
    font-size: 13px;
  }
  .low strong {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink);
  }
  .low > article > span:not(.swatch) {
    font-size: 12px;
  }
  .low button {
    width: 26px;
    height: 26px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--amber);
  }
  .low button:hover {
    background: #f1e3b3;
  }
  .low button :global(svg) {
    width: 13px;
    height: 13px;
  }
  .filament-layout {
    display: grid;
    grid-template-columns: minmax(280px, 0.7fr) minmax(360px, 1.3fr);
    gap: 20px;
    align-items: start;
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
  .field :global(.control input) {
    width: 100%;
    min-width: 0;
    height: 38px;
    padding: 0 11px;
    font-size: 13px;
  }
  .field input:focus,
  .field select:focus,
  .field :global(.control input:focus),
  .weight input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
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
  .submit.accent {
    border-color: var(--green);
    background: var(--green);
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
  .list-summary span {
    color: var(--faint);
    font-size: 12px;
  }
  .roll-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .card {
    min-width: 0;
    padding: 14px 16px;
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
  .swatch {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    display: inline-block;
    border: 1px solid rgb(0 0 0 / 12%);
    border-radius: 50%;
  }
  .remove {
    width: 28px;
    height: 28px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--faint);
  }
  .remove:hover {
    background: var(--red-soft);
    color: var(--red);
  }
  .meter {
    height: 4px;
    margin: 12px 0 10px;
    overflow: hidden;
    border-radius: 99px;
    background: #e6e5dd;
  }
  .meter span {
    height: 100%;
    display: block;
    border-radius: inherit;
    background: var(--green);
  }
  .weight {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
  }
  .weight input {
    width: 80px;
    height: 30px;
    padding: 0 8px;
    font-family: var(--mono);
    font-size: 12px;
  }
  .card-actions {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .record-use,
  .use-actions .cancel {
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    color: var(--ink);
    font-size: 12px;
    font-weight: 500;
  }
  .record-use:hover,
  .use-actions .cancel:hover {
    border-color: var(--muted);
  }
  .card-actions .remove {
    margin-left: auto;
  }
  .use-popover {
    position: fixed;
    width: min(240px, calc(100vw - 24px));
    margin: 0;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: white;
    box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  }
  .use-popover form {
    display: grid;
    gap: 12px;
  }
  .use-popover strong {
    font-size: 13px;
  }
  .use-popover .field {
    gap: 6px;
  }
  .use-popover .field input {
    height: 34px;
  }
  .use-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .use-actions .submit {
    height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }
  .use-error {
    margin: -4px 0 0;
    color: var(--red);
    font-size: 12px;
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
  .empty {
    padding: 40px 0;
    color: var(--faint);
    text-align: center;
  }
  @media (max-width: 820px) {
    .filament-layout {
      grid-template-columns: 1fr;
    }
    .form {
      order: 2;
    }
  }
  @media (max-width: 480px) {
    .field-row,
    .roll-grid,
    .gcode-use {
      grid-template-columns: 1fr;
    }
    .gcode-head {
      flex-direction: column;
      align-items: stretch;
    }
    .upload {
      justify-content: center;
    }
    .upload span {
      max-width: none;
    }
  }
</style>
