<script lang="ts">
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import Icon, { type IconName } from "$lib/Icon.svelte";
  import "./layout.css";

  let { children } = $props();

  const tools: { id: IconName; label: string; path: string }[] = [
    { id: "json", label: "JSON", path: "/json" },
    { id: "base64", label: "Base64", path: "/base64" },
    { id: "time", label: "Date & time", path: "/time" },
    { id: "packages", label: "Packages", path: "/packages" },
    { id: "filament", label: "Filament", path: "/filament" },
  ];

  const activeTool = $derived(
    tools.find((tool) => page.url.pathname === `${base}${tool.path}`) ?? tools[0]
  );

  function selectToolByShortcut(event: KeyboardEvent) {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const tool = tools[Number(event.key) - 1];
    if (!tool) return;
    event.preventDefault();
    document.getElementById(`tool-${tool.id}`)?.click();
  }
</script>

<svelte:window onkeydown={selectToolByShortcut} />

<svelte:head>
  <link rel="icon" href={`${base}/favicon.svg`} />
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <link rel="apple-touch-icon" href={`${base}/apple-touch-icon.png`} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Omni" />
  <title>{activeTool.label} · Omni</title>
</svelte:head>

<div class="app">
  <nav class="rail" aria-label="Tools">
    <a class="brand" href={`${base}/json`}>omni</a>
    <div class="rail-tools">
      {#each tools as tool, index}
        <a
          id={`tool-${tool.id}`}
          class:active={activeTool.id === tool.id}
          href={`${base}${tool.path}`}
          aria-current={activeTool.id === tool.id ? "page" : undefined}
          title={`${tool.label} (Ctrl+${index + 1})`}
        >
          <Icon name={tool.id} />
          <span>{tool.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <main>
    <h1>{activeTool.label}</h1>
    {@render children()}
  </main>
</div>
