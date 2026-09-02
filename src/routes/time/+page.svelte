<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "$lib/Icon.svelte";

  let input = $state("");
  let copied = $state("");
  let now = $state(new Date());
  const result = $derived(parseTimeInput(input, now));

  onMount(() => {
    const timer = window.setInterval(() => (now = new Date()), 1000);
    return () => window.clearInterval(timer);
  });

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
    await navigator.clipboard.writeText(value);
    copied = key;
    window.setTimeout(() => {
      if (copied === key) copied = "";
    }, 1600);
  }
</script>

<section class="time">
  <div class="time-input">
    <input
      bind:value={input}
      spellcheck="false"
      placeholder="Timestamp or date, e.g. 1725120000 or 2026-08-31"
      aria-label="Timestamp or date"
    />
    <button onclick={() => (input = String(Math.floor(Date.now() / 1000)))}>Now</button>
  </div>
  {#if result.valid}
    <p class="hint">Read as {result.unit}</p>
    <div class="time-results">
      <div class="result wide">
        <span>Local</span>
        <strong>{result.local}</strong>
        <small>{result.relative}</small>
      </div>
      <div class="result">
        <span>UTC</span>
        <strong>{result.utc}</strong>
        <button onclick={() => copyText(result.utc, "utc")} aria-label="Copy UTC">
          <Icon name={copied === "utc" ? "check" : "copy"} />
        </button>
      </div>
      <div class="result">
        <span>Seconds</span>
        <strong>{result.seconds}</strong>
        <button
          onclick={() => copyText(String(result.seconds), "seconds")}
          aria-label="Copy seconds"
        >
          <Icon name={copied === "seconds" ? "check" : "copy"} />
        </button>
      </div>
      <div class="result">
        <span>Milliseconds</span>
        <strong>{result.milliseconds}</strong>
        <button
          onclick={() => copyText(String(result.milliseconds), "milliseconds")}
          aria-label="Copy milliseconds"
        >
          <Icon name={copied === "milliseconds" ? "check" : "copy"} />
        </button>
      </div>
    </div>
  {:else}
    <p class="error">{result.error}</p>
  {/if}
</section>

<style>
  .time {
    max-width: 760px;
    display: grid;
    gap: 12px;
  }
  .time-input {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
  }
  .time-input input {
    min-width: 0;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    outline: 0;
    background: white;
    font-family: var(--mono);
    font-size: 14px;
  }
  .time-input input:focus {
    border-color: var(--green);
    box-shadow: 0 0 0 3px rgb(35 95 69 / 10%);
  }
  .time-input button {
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: white;
    font-size: 13px;
    font-weight: 500;
  }
  .time-input button:hover {
    border-color: var(--muted);
  }
  .hint {
    color: var(--faint);
    font-size: 12px;
  }
  .time-results {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .result {
    position: relative;
    min-width: 0;
    padding: 14px 16px;
    display: grid;
    gap: 4px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
  }
  .result.wide {
    grid-column: 1 / -1;
    background: var(--ink);
    color: white;
  }
  .result > span {
    color: var(--muted);
    font-size: 12px;
  }
  .result.wide > span,
  .result.wide small {
    color: #9caaa1;
  }
  .result > strong {
    padding-right: 28px;
    overflow-wrap: anywhere;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 500;
  }
  .result.wide > strong {
    font-family: inherit;
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .result small {
    font-size: 12px;
  }
  .result button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--faint);
  }
  .result button:hover {
    background: #eeece4;
    color: var(--ink);
  }
  .result button :global(svg) {
    width: 14px;
    height: 14px;
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
  @media (max-width: 820px) {
    .time-results {
      grid-template-columns: 1fr;
    }
    .result.wide {
      grid-column: auto;
    }
  }
  @media (max-width: 480px) {
    .time-input {
      grid-template-columns: 1fr;
    }
  }
</style>
