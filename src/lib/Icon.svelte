<script lang="ts">
  export type IconName =
    | "json"
    | "base64"
    | "regex"
    | "color"
    | "uuid"
    | "hash"
    | "url"
    | "html"
    | "tools"
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
    color:
      "M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-2a2 2 0 0 1-2-2V6c0-1.66-1.34-3-3-3ZM7.5 12.5h.01M9.5 8.5h.01M15.5 14.5h.01",
    uuid: "M8 3H5a2 2 0 0 0-2 2v3m14-5h2a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m14 5h2a2 2 0 0 0 2-2v-3M8 8h8v8H8z",
    hash: "M10 3 8 21M16 3l-2 18M4 9h17M3 15h17",
    url: "M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15",
    html: "m8 9-3 3 3 3m8-6 3 3-3 3m-3-9-4 12",
    tools:
      "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18a2.12 2.12 0 0 0 3 3l6.3-6.3a4 4 0 0 0 5.4-5.4L15 11l-2-2 2.7-2.7Z",
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
