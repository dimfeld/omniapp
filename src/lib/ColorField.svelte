<script lang="ts">
  import { filamentPalette } from "$lib/filament/colors";
  let { value = $bindable(""), placeholder = "" }: { value: string; placeholder?: string } =
    $props();

  const palette = filamentPalette;

  let trigger = $state<HTMLButtonElement>();
  let popover = $state<HTMLDivElement>();
  let colorInput = $state<HTMLInputElement>();
  let popoverStyle = $state("");

  const swatch = $derived(value.trim() || "#d9ed9d");
  const customHex = $derived(/^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "#808080");

  function pick(hex: string) {
    value = hex;
    popover?.hidePopover();
  }

  function onToggle(event: ToggleEvent) {
    if (event.newState !== "open" || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    popoverStyle = `top: ${rect.bottom + 6}px; left: ${rect.left}px;`;
  }
</script>

<div class="color-field">
  <div class="control">
    <button
      type="button"
      class="swatch-button"
      aria-label="Choose color"
      popovertarget="color-palette"
      bind:this={trigger}
    >
      <span class="swatch" style:background={swatch}></span>
    </button>
    <input bind:value {placeholder} autocomplete="off" />
  </div>
  <div
    id="color-palette"
    class="popover"
    popover="auto"
    aria-label="Color palette"
    style={popoverStyle}
    bind:this={popover}
    ontoggle={onToggle}
  >
    <div class="grid">
      {#each palette as item (item.hex)}
        <button
          type="button"
          class="option"
          class:selected={value.toLowerCase() === item.hex}
          title={item.name}
          aria-label={item.name}
          onclick={() => pick(item.hex)}
        >
          <span class="swatch" style:background={item.hex}></span>
        </button>
      {/each}
    </div>
    <button type="button" class="custom" onclick={() => colorInput?.click()}>
      <span class="swatch" style:background={customHex}></span>
      Custom color…
    </button>
    <input
      bind:this={colorInput}
      class="native"
      type="color"
      value={customHex}
      oninput={(event) => (value = event.currentTarget.value)}
      onchange={() => popover?.hidePopover()}
    />
  </div>
</div>

<style>
  .control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .control input {
    flex: 1;
  }
  .swatch-button {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line, #d9d7cd);
    border-radius: 6px;
    background: white;
  }
  .swatch-button:hover {
    border-color: var(--green, #235f45);
  }
  .swatch {
    width: 18px;
    height: 18px;
    display: inline-block;
    border: 1px solid rgb(0 0 0 / 15%);
    border-radius: 50%;
  }
  .popover {
    position: fixed;
    margin: 0;
    min-width: 220px;
    padding: 10px;
    gap: 10px;
    border: 1px solid var(--line, #d9d7cd);
    border-radius: 8px;
    background: white;
    box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  }
  .popover:popover-open {
    display: grid;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }
  .option {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
  }
  .option:hover {
    background: #f1f0ea;
  }
  .option.selected {
    border-color: var(--green, #235f45);
  }
  .custom {
    height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid var(--line, #d9d7cd);
    border-radius: 6px;
    background: white;
    font-size: 12px;
    font-weight: 500;
  }
  .custom:hover {
    border-color: var(--green, #235f45);
  }
  .native {
    position: absolute;
    bottom: 10px;
    left: 10px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
</style>
