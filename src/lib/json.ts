import JSON5 from "json5";

export type OutputSyntax = "json" | "javascript";

const identifier = /^[$_\p{ID_Start}](?:[$\p{ID_Continue}]|\u200c|\u200d)*$/u;

export function formatJsonKey(key: string, syntax: OutputSyntax): string {
  return syntax === "javascript" && identifier.test(key) ? key : JSON.stringify(key);
}

export function formatJsonPrimitive(value: unknown, syntax: OutputSyntax): string {
  return syntax === "javascript" ? JSON5.stringify(value, { quote: '"' }) : JSON.stringify(value);
}

function stringifyJavaScript(value: unknown, minified: boolean, depth = 0): string {
  if (value === null || typeof value !== "object") {
    return formatJsonPrimitive(value, "javascript");
  }

  const array = Array.isArray(value);
  const open = array ? "[" : "{";
  const close = array ? "]" : "}";
  const entries = Object.entries(value).map(([key, item]) => {
    const content = stringifyJavaScript(item, minified, depth + 1);
    if (array) return content;
    const name = formatJsonKey(key, "javascript");
    return `${name}:${minified ? "" : " "}${content}`;
  });

  if (!entries.length) return open + close;
  if (minified) return `${open}${entries.join(",")},${close}`;
  const indent = "  ".repeat(depth + 1);
  return `${open}\n${entries.map((entry) => `${indent}${entry},`).join("\n")}\n${"  ".repeat(depth)}${close}`;
}

export function parseJson(input: string): unknown {
  return JSON5.parse(input);
}

export function formatJsonValue(value: unknown, syntax: OutputSyntax, minified = false): string {
  return syntax === "javascript"
    ? stringifyJavaScript(value, minified)
    : JSON.stringify(value, null, minified ? 0 : 2);
}

export function formatJson(input: string, syntax: OutputSyntax, minified = false): string {
  return formatJsonValue(parseJson(input), syntax, minified);
}
