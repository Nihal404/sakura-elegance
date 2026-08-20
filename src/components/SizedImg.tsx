import { memo, type ImgHTMLAttributes } from "react";
import { useSizedSrc } from "@/hooks/useSizedImage";
import type { VariantRequest } from "@/lib/zari/image-url";

/**
 * A plain <img> whose source is the right-sized variant of a stored product image.
 *
 * Used by the secondary surfaces (cart lines, compare thumbs) that need the small file but
 * not the full <ProductImage> pipeline. Keeps their existing markup and classes intact.
 */
export const SizedImg = memo(function SizedImg({
  raw,
  spec,
  ...rest
}: { raw: string | undefined | null; spec: VariantRequest } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
>) {
  const src = useSizedSrc(raw, spec);
  return <img src={src} {...rest} />;
});
