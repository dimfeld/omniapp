<script lang="ts">
  import { base } from "$app/paths";
  import "./layout.css";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={`${base}/favicon.svg`} />
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <link rel="apple-touch-icon" href={`${base}/apple-touch-icon.png`} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Omni" />
</svelte:head>
{@render children()}
