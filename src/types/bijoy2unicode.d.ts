declare module "bijoy2unicode" {
  export function convertBijoyToUnicode(src: string): string;
  export function looksLikeBijoy(src: string): boolean;
  export function hasBengaliUnicode(src: string): boolean;
  export function describeCodepoint(char: string): string;
  export function isSuspiciousLeftover(char: string): boolean;
  export function scanUnmapped(src: string): any[];
  export function shouldConvertAsBijoy(src: string): boolean;
}
