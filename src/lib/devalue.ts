import { parse, stringify } from "devalue";
import { formatJsonKey } from "$lib/json";

/** A value with a custom devalue type that has no reviver here. */
export class CustomValue {
  constructor(
    readonly type: string,
    readonly value: unknown
  ) {}
}

export type DecodeResult = {
  value: unknown;
  /** True when the input was Base64 text that held the devalue string. */
  base64: boolean;
};

const MAX_CUSTOM_TYPES = 50;

/** Parse a devalue string. Unknown custom types are kept as `CustomValue`. */
export function parseDevalue(serialized: string): unknown {
  const revivers: Record<string, (value: unknown) => unknown> = {};
  for (let attempt = 0; attempt <= MAX_CUSTOM_TYPES; attempt += 1) {
    try {
      return parse(serialized, revivers);
    } catch (cause) {
      const type = cause instanceof Error && /^Unknown type (.+)$/.exec(cause.message)?.[1];
      if (!type || type in revivers) throw cause;
      revivers[type] = (value) => new CustomValue(type, value);
    }
  }
  throw new Error("The input has too many custom types.");
}

function isJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Decode standard or URL-safe Base64 to UTF-8 text. Returns undefined if it is not Base64. */
export function decodeBase64Text(text: string): string | undefined {
  const compact = text.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!compact || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return undefined;
  const padded = compact.replace(/=+$/, "").padEnd(Math.ceil(compact.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export function decodeDevalue(input: string): DecodeResult {
  let text = input.trim();
  let base64 = false;

  if (!isJson(text)) {
    const decoded = decodeBase64Text(text);
    if (decoded === undefined) throw new Error("Enter a devalue string or Base64-encoded devalue.");
    text = decoded.trim();
    base64 = true;
  }

  // Accept a devalue string that was itself JSON-quoted, as often seen in logs.
  const raw: unknown = JSON.parse(text);
  if (typeof raw === "string") text = raw;

  return { value: parseDevalue(text), base64 };
}

/** Evaluate a JavaScript expression, so that values such as `new Map()` and `1n` are available. */
export function evaluateExpression(source: string): unknown {
  return new Function(`"use strict"; return (\n${source}\n);`)();
}

export function encodeBase64Text(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeDevalue(source: string, base64 = false): string {
  const serialized = stringify(evaluateExpression(source));
  return base64 ? encodeBase64Text(serialized) : serialized;
}

function formatNumber(value: number) {
  return Object.is(value, -0) ? "-0" : String(value);
}

function formatList(open: string, items: string[], close: string, depth: number) {
  if (!items.length) return open + close;
  const indent = "  ".repeat(depth + 1);
  return `${open}\n${items.map((item) => `${indent}${item},`).join("\n")}\n${"  ".repeat(depth)}${close}`;
}

/** Format a decoded value as readable JavaScript source. */
export function formatValue(value: unknown, depth = 0, ancestors: object[] = []): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return formatNumber(value);
    case "bigint":
      return `${value}n`;
    case "undefined":
      return "undefined";
    case "boolean":
      return String(value);
    case "symbol":
    case "function":
      return String(value);
  }
  if (value === null) return "null";

  const object = value as object;
  if (ancestors.includes(object)) return "[Circular]";
  const nested = [...ancestors, object];
  const format = (item: unknown) => formatValue(item, depth + 1, nested);

  if (object instanceof CustomValue)
    return `${object.type}(${formatValue(object.value, depth, nested)})`;
  if (object instanceof Date) {
    return Number.isNaN(object.getTime())
      ? "new Date(NaN)"
      : `new Date(${JSON.stringify(object.toISOString())})`;
  }
  if (object instanceof RegExp) return String(object);
  if (object instanceof URL) return `new URL(${JSON.stringify(object.href)})`;
  if (object instanceof URLSearchParams) {
    return `new URLSearchParams(${JSON.stringify(object.toString())})`;
  }
  if (object instanceof Map) {
    const entries = [...object].map(([key, item]) => `[${format(key)}, ${format(item)}]`);
    return `new Map(${formatList("[", entries, "]", depth)})`;
  }
  if (object instanceof Set) {
    return `new Set(${formatList("[", [...object].map(format), "]", depth)})`;
  }
  if (object instanceof ArrayBuffer) {
    return `new Uint8Array([${new Uint8Array(object).join(", ")}]).buffer`;
  }
  if (ArrayBuffer.isView(object)) {
    const items = object instanceof DataView ? new Uint8Array(object.buffer) : object;
    const name = object.constructor.name;
    const values = Array.from(items as unknown as ArrayLike<number | bigint>, (item) =>
      typeof item === "bigint" ? `${item}n` : formatNumber(item)
    );
    return object instanceof DataView
      ? `new DataView(new Uint8Array([${values.join(", ")}]).buffer)`
      : `new ${name}([${values.join(", ")}])`;
  }
  if (Array.isArray(object)) {
    const items = Array.from({ length: object.length }, (_, index) =>
      index in object ? format(object[index]) : "<empty>"
    );
    return formatList("[", items, "]", depth);
  }

  const tag = Object.prototype.toString.call(object).slice(8, -1);
  if (tag.startsWith("Temporal.")) return `${tag}.from(${JSON.stringify(String(object))})`;

  const entries = Object.entries(object).map(
    ([key, item]) => `${formatJsonKey(key, "javascript")}: ${format(item)}`
  );
  const body = formatList("{", entries, "}", depth);
  return Object.getPrototypeOf(object) === null
    ? `Object.assign(Object.create(null), ${body})`
    : body;
}
