export interface ProcessedImage {
  /** Optimized picture, a genuine WebP. */
  image: Buffer;
  /** Blurred placeholder as a `data:image/webp;base64,...` URI. */
  blur: string;
}
