import { converter, formatCss, formatHex, formatHex8, formatHsl, formatRgb, parse } from "culori";

export type ColorValue = {
  mode: string;
  [channel: string]: number | string | undefined;
};

export type ColorChannel = {
  label: string;
  value: string;
};

export type ColorConversion = {
  label: string;
  css: string;
  channels: ColorChannel[];
};

type ChannelDefinition = {
  key: string;
  label: string;
  scale?: number;
  suffix?: string;
};

const conversionDefinitions: { mode: string; label: string; channels: ChannelDefinition[] }[] = [
  {
    mode: "hex",
    label: "HEX",
    channels: [],
  },
  {
    mode: "rgb",
    label: "RGB",
    channels: [
      { key: "r", label: "R", scale: 255 },
      { key: "g", label: "G", scale: 255 },
      { key: "b", label: "B", scale: 255 },
    ],
  },
  {
    mode: "hsl",
    label: "HSL",
    channels: [
      { key: "h", label: "H", suffix: "°" },
      { key: "s", label: "S", scale: 100, suffix: "%" },
      { key: "l", label: "L", scale: 100, suffix: "%" },
    ],
  },
  {
    mode: "hsv",
    label: "HSV",
    channels: [
      { key: "h", label: "H", suffix: "°" },
      { key: "s", label: "S", scale: 100, suffix: "%" },
      { key: "v", label: "V", scale: 100, suffix: "%" },
    ],
  },
  {
    mode: "hwb",
    label: "HWB",
    channels: [
      { key: "h", label: "H", suffix: "°" },
      { key: "w", label: "W", scale: 100, suffix: "%" },
      { key: "b", label: "B", scale: 100, suffix: "%" },
    ],
  },
  {
    mode: "lab65",
    label: "Lab (D65)",
    channels: [
      { key: "l", label: "L" },
      { key: "a", label: "a" },
      { key: "b", label: "b" },
    ],
  },
  {
    mode: "lch65",
    label: "LCH (D65)",
    channels: [
      { key: "l", label: "L" },
      { key: "c", label: "C" },
      { key: "h", label: "H", suffix: "°" },
    ],
  },
  {
    mode: "oklab",
    label: "OKLab",
    channels: [
      { key: "l", label: "L" },
      { key: "a", label: "a" },
      { key: "b", label: "b" },
    ],
  },
  {
    mode: "oklch",
    label: "OKLCH",
    channels: [
      { key: "l", label: "L" },
      { key: "c", label: "C" },
      { key: "h", label: "H", suffix: "°" },
    ],
  },
  {
    mode: "xyz65",
    label: "XYZ (D65)",
    channels: [
      { key: "x", label: "X" },
      { key: "y", label: "Y" },
      { key: "z", label: "Z" },
    ],
  },
];

export function parseColor(value: string): ColorValue | undefined {
  return parse(value) as ColorValue | undefined;
}

export function formatPickerColor(color: ColorValue) {
  return formatHex(color) || "#000000";
}

export function getColorConversions(color: ColorValue): ColorConversion[] {
  return conversionDefinitions.map((definition) => {
    const converted =
      definition.mode === "hex"
        ? color
        : ((converter(definition.mode) as (value: ColorValue) => ColorValue | undefined)(color) ??
          color);
    const alpha = typeof converted.alpha === "number" ? converted.alpha : undefined;
    const channels = definition.channels.map((channel) => ({
      label: channel.label,
      value: formatChannel(converted[channel.key], channel.scale, channel.suffix),
    }));
    if (alpha !== undefined && alpha < 1) {
      channels.push({ label: "A", value: formatChannel(alpha, 1) });
    }

    let css: string;
    if (definition.mode === "hex") {
      css = (alpha !== undefined && alpha < 1 ? formatHex8(color) : formatHex(color)) || "—";
    } else if (definition.mode === "rgb") {
      css = formatRgb(color) || "—";
    } else if (definition.mode === "hsl") {
      css = formatHsl(color) || "—";
    } else {
      css = formatCss(converted) || "—";
    }

    return { label: definition.label, css: css || "—", channels };
  });
}

function formatChannel(value: number | string | undefined, scale = 1, suffix = "") {
  if (value === undefined || value === "none") return "none";
  const numeric = Number(value) * scale;
  if (!Number.isFinite(numeric)) return "none";
  return `${formatNumber(numeric)}${suffix}`;
}

function formatNumber(value: number) {
  return String(Math.round(value * 1000) / 1000);
}
