declare module "culori" {
  type Color = {
    mode: string;
    [channel: string]: number | string | undefined;
  };

  export function converter(mode: string): (color: Color) => Color | undefined;
  export function formatCss(color: Color): string | undefined;
  export function formatHex(color: Color): string | undefined;
  export function formatHex8(color: Color): string | undefined;
  export function formatHsl(color: Color): string | undefined;
  export function formatRgb(color: Color): string | undefined;
  export function parse(value: string): Color | undefined;
}
