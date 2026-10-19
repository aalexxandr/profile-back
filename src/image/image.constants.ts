/** Formats `sharp` reports for the pictures the API accepts. */
export const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
export const MAX_WIDTH = 1920;
export const WEBP_QUALITY = 80;
export const BLUR_WIDTH = 20;
export const BLUR_SIGMA = 1;
export const BLUR_QUALITY = 40;
export const BLUR_PREFIX = 'data:image/webp;base64,';
/** Guards against a small file that decodes into a huge bitmap. */
export const MAX_INPUT_PIXELS = 50_000_000;
