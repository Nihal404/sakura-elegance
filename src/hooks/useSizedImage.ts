import { useEffect, useState } from "react";
import {
  cachedVariantUrl,
  isStorageSource,
  signedVariantUrl,
  type VariantRequest,
} from "@/lib/zari/image-url";

/**
 * Resolves a stored product image value to a right-sized, currently-valid URL.
 *
 * Private-bucket objects only ever serve their multi-MB original from a plain
 * `/object/sign/...` URL, so every non-<ProductImage> call site (cart lines, compare
 * thumbs, gallery strip) needs the signed *render* variant too. Until it resolves we
 * return the best synchronous guess: a previously signed variant, else the stored URL.
 */
export function useSizedSrc(raw: string | undefined | null, spec: VariantRequest): string {
  const fallback = raw ?? "";
  const [src, setSrc] = useState(
    () => (raw && cachedVariantUrl(raw, spec)) || fallback,
  );

  useEffect(() => {
    if (!raw || !isStorageSource(raw)) {
      setSrc(fallback);
      return;
    }
    let alive = true;
    const cached = cachedVariantUrl(raw, spec);
    if (cached) setSrc(cached);
    signedVariantUrl(raw, spec)
      .then((next) => {
        if (alive && next) setSrc(next);
      })
      .catch((error) => console.warn("[zari:image] variant resolve failed", { raw, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, spec.width, spec.quality]);

  return src;
}

/** Array flavour of {@link useSizedSrc} for galleries and thumbnail strips. */
export function useSizedSrcList(raws: readonly string[], spec: VariantRequest): string[] {
  const key = raws.join("|");
  const [list, setList] = useState<string[]>(() =>
    raws.map((r) => cachedVariantUrl(r, spec) || r),
  );

  useEffect(() => {
    let alive = true;
    setList(raws.map((r) => cachedVariantUrl(r, spec) || r));
    void Promise.all(
      raws.map((r) =>
        isStorageSource(r)
          ? signedVariantUrl(r, spec).catch((error) => {
              console.warn("[zari:image] variant resolve failed", { raw: r, error });
              return r;
            })
          : Promise.resolve(r),
      ),
    ).then((next) => {
      if (alive) setList(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, spec.width, spec.quality]);

  return list;
}
