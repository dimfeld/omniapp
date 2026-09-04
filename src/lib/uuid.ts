import { parse, validate, version as uuidVersion } from "uuid";

export type UUIDField = {
  label: string;
  value: string;
};

export type UUIDDecodeResult =
  | {
      valid: true;
      uuid: string;
      version: number;
      variant: string;
      bytes: string;
      fields: UUIDField[];
    }
  | { valid: false; error: string };

const UUID_EPOCH_100NS = 0x01b21dd213814000n;

export function decodeUuid(input: string): UUIDDecodeResult | null {
  const value = input.trim();
  if (!value) return null;
  if (!validate(value)) {
    return {
      valid: false,
      error: "Enter a valid UUID in the form xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.",
    };
  }

  const normalized = value.toLowerCase();
  const bytes = new Uint8Array(parse(normalized));
  const uuidVersionNumber = uuidVersion(normalized);
  const fields: UUIDField[] = [
    { label: "Time low", value: normalized.slice(0, 8) },
    { label: "Time mid", value: normalized.slice(9, 13) },
    { label: "Time high + version", value: normalized.slice(14, 18) },
    { label: "Clock sequence high + variant", value: normalized.slice(19, 21) },
    { label: "Clock sequence low", value: normalized.slice(21, 23) },
    { label: "Node", value: normalized.slice(24) },
  ];

  if (uuidVersionNumber === 1) {
    const timestamp =
      (BigInt(parseInt(normalized.slice(14, 18), 16) & 0x0fff) << 48n) |
      (BigInt(parseInt(normalized.slice(9, 13), 16)) << 32n) |
      BigInt(parseInt(normalized.slice(0, 8), 16));
    const unixMilliseconds = Number((timestamp - UUID_EPOCH_100NS) / 10_000n);
    fields.push({ label: "Timestamp", value: formatDate(unixMilliseconds) });
    fields.push({ label: "Timestamp (100 ns)", value: timestamp.toString() });
  } else if (uuidVersionNumber === 7) {
    const timestamp = bytesToBigInt(bytes.slice(0, 6));
    fields.push({ label: "Timestamp", value: formatDate(Number(timestamp)) });
    fields.push({ label: "Timestamp (ms)", value: timestamp.toString() });
  }

  return {
    valid: true,
    uuid: normalized,
    version: uuidVersionNumber,
    variant: getVariant(bytes[8] ?? 0),
    bytes: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" "),
    fields,
  };
}

function bytesToBigInt(bytes: Uint8Array) {
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

function getVariant(byte: number) {
  if ((byte & 0x80) === 0) return "NCS compatibility";
  if ((byte & 0xc0) === 0x80) return "RFC 9562";
  if ((byte & 0xe0) === 0xc0) return "Microsoft compatibility";
  return "Reserved";
}

function formatDate(milliseconds: number) {
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? "Outside JavaScript Date range" : date.toISOString();
}
