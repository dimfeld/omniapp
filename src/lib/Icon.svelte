<script lang="ts">
  export type IconName =
    | "json"
    | "base64"
    | "regex"
    | "time"
    | "packages"
    | "filament"
    | "copy"
    | "check"
    | "trash"
    | "external"
    | "upload"
    | "close";

  let { name }: { name: IconName } = $props();

  const paths: Record<IconName, string> = {
    json: "M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2",
    base64: "M6 5h4a2 2 0 0 1 0 4H6V5Zm0 4h5a2.5 2.5 0 0 1 0 5H6V9Zm10-4v9m0-4h5l-3.5-5v9",
    regex:
      "M5 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2M8 12h8M11 9l-3 3 3 3",
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
</script>

<svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>
