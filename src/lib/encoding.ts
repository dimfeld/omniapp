import { decode as decodeEntities, encode as encodeEntities } from "html-entities";

export type TextTransform = (value: string) => string;

export function encodeUrl(value: string) {
  return encodeURIComponent(value);
}

export function decodeUrl(value: string) {
  return decodeURIComponent(value);
}

export const encodeHtml: TextTransform = (value) => encodeEntities(value, { mode: "specialChars" });
export const decodeHtml: TextTransform = (value) => decodeEntities(value);
