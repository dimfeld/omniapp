<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import {
    formatPickerColor,
    getColorConversions,
    parseColor,
    type ColorConversion,
  } from "$lib/colors";

  let input = $state("");
  let pickerColor = $state("#000000");
  let copied = $state("");
  const parsed = $derived(parseColor(input));
  const conversions = $derived<ColorConversion[]>(parsed ? getColorConversions(parsed) : []);

  function updateInput(event: Event) {
    input = (event.currentTarget as HTMLInputElement).value;
    const color = parseColor(input);
    if (color) pickerColor = formatPickerColor(color);
  }

  function updatePicker(event: Event) {
    pickerColor = (event.currentTarget as HTMLInputElement).value;
    input = pickerColor;
  }

  async function copyValue(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    copied = key;
    window.setTimeout(() => {
      if (copied === key) copied = "";
    }, 1600);
  }
</script>

<section class="color-tool">
  <div class="panel color-input-panel">
    <div class="color-preview" style:background={pickerColor}></div>
    <div class="color-inputs">
      <label class="field">
        <span>Color value<em>CSS color syntax</em></span>
        <input
          value={input}
          oninput={updateInput}
          spellcheck="false"
          placeholder="#e85d04 or lch(60% 80 40)"
          aria-label="Color value"
        />
      </label>
      <label class="picker-field">
        <span>Picker</span>
        <input type="color" value={pickerColor} oninput={updatePicker} aria-label="Color picker" />
      </label>
    </div>
  </div>

  {#if !parsed}
    <div class="error" role="alert">
      <strong>Invalid color</strong>
      <span>Enter a CSS color such as #e85d04, rgb(232 93 4), or lch(60% 80 40).</span>
    </div>
  {:else}
    <div class="results-head">
      <div>
        <strong>Conversions</strong>
        <span>{conversions.length} color spaces</span>
      </div>
      <span>Values are converted to sRGB when needed.</span>
    </div>
    <div class="conversions">
      {#each conversions as conversion}
        <article class="conversion-card">
          <div class="card-head">
            <strong>{conversion.label}</strong>
            <button
              type="button"
              onclick={() => copyValue(conversion.css, conversion.label)}
              aria-label={`Copy ${conversion.label} value`}
            >
              <Icon name={copied === conversion.label ? "check" : "copy"} />
              <span>{copied === conversion.label ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <code class="css-value">{conversion.css}</code>
          {#if conversion.channels.length}
            <div class="channels">
              {#each conversion.channels as channel}
                <div>
                  <span>{channel.label}</span>
                  <code>{channel.value}</code>
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .color-tool {
    max-width: 920px;
    display: grid;
    gap: 20px;
  }
  .panel,
  .conversion-card,
  .error {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .color-input-panel {
    padding: 16px;
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: center;
    gap: 16px;
  }
  .color-preview {
    width: 88px;
    height: 88px;
    border: 1px solid rgb(27 36 31 / 15%);
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  }
  .color-inputs {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 12px;
  }
  .field,
  .picker-field {
    display: grid;
    gap: 7px;
  }
  .field > span,
  .picker-field > span,
  .results-head span,
  .channels span {
    color: var(--muted);
    font-size: 12px;
  }
  .field > span,
  .picker-field > span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-weight: 600;
  }
  .field em {
    color: var(--faint);
    font-style: normal;
    font-weight: 400;
  }
  .field input {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
    font-family: var(--mono);
    font-size: 14px;
  }
  .field input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .picker-field input {
    width: 52px;
    height: 44px;
    padding: 4px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    cursor: pointer;
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
  .conversions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .conversion-card {
    min-width: 0;
    padding: 14px 16px;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-head button {
    padding: 4px 0 4px 6px;
    display: flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    color: var(--green);
    font-size: 12px;
    font-weight: 600;
  }
  .card-head button :global(svg) {
    width: 13px;
    height: 13px;
  }
  .css-value {
    display: block;
    margin-top: 12px;
    overflow-wrap: anywhere;
    color: var(--green);
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
  }
  .channels {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .channels div {
    min-width: 0;
    padding-top: 8px;
    display: grid;
    gap: 3px;
    border-top: 1px solid var(--line);
  }
  .channels code {
    overflow-wrap: anywhere;
    color: var(--ink);
    font-size: 12px;
  }
  .error {
    padding: 16px;
    display: grid;
    gap: 4px;
    border-color: #ebc7be;
    background: var(--red-soft);
    color: var(--red);
  }
  .error span {
    color: var(--muted);
    font-size: 13px;
  }
  @media (max-width: 620px) {
    .color-input-panel {
      grid-template-columns: 64px minmax(0, 1fr);
    }
    .color-preview {
      width: 64px;
      height: 64px;
    }
    .conversions {
      grid-template-columns: 1fr;
    }
  }
</style>
