export function generateRandomHex(length: number) {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("Length must be a positive whole number.");
  }

  const bytes = new Uint8Array(Math.ceil(length / 2));
  for (let offset = 0; offset < bytes.length; offset += 65_536) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65_536, bytes.length)));
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}
