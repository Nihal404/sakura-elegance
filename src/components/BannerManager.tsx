import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Trash2, Eye, EyeOff, GalleryHorizontalEnd } from "lucide-react";
import { toast } from "sonner";
import { supabase, PRODUCT_IMAGE_BUCKET } from "@/lib/zari/supabase";
import { compressImage } from "@/lib/zari/compress-image";
import { addBanner, fetchBanners, removeBanner, updateBanner, type Banner } from "@/lib/zari/banners";
import { galleryImageUrl } from "@/lib/zari/image-url";

/**
 * Admin control for the home page banner slider: upload custom banners, caption them,
 * reorder them, hide them, or delete them. Banners live in the `banners` table and the
 * home page falls back to the curated slides when none are active.
 */
export function BannerManager({ userId }: { userId: string }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const load = async () => {
    try {
      setBanners(await fetchBanners(false));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!chosen.length) return;
    setUploading(true);
    try {
      let order = banners.length;
      for (const original of chosen) {
        const f = await compressImage(original);
        const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
        const path = `banners/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .upload(path, f, { contentType: f.type, upsert: false, cacheControl: "31536000" });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
        await addBanner(data.publicUrl, caption, order);
        order += 1;
      }
      setCaption("");
      await load();
      toast.success(chosen.length > 1 ? "Banners added." : "Banner added.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Banner upload failed");
    } finally {
      setUploading(false);
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= banners.length) return;
    const a = banners[index];
    const b = banners[target];
    try {
      await Promise.all([
        updateBanner(a.id, { sort_order: target }),
        updateBanner(b.id, { sort_order: index }),
      ]);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
    }
  };

  const toggle = async (b: Banner) => {
    try {
      await updateBanner(b.id, { active: !b.active });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update banner");
    }
  };

  const destroy = async (b: Banner) => {
    if (!confirm("Remove this banner from the home page?")) return;
    try {
      await removeBanner(b.id);
      await load();
      toast.success("Banner removed.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not remove banner");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 bg-card rounded-3xl shadow-soft p-6 sm:p-7 border border-border/60"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between mb-5">
        <div className="flex min-w-0 items-center gap-2">
          <GalleryHorizontalEnd className="w-4 h-4 shrink-0 text-primary" />
          <h2 className="truncate font-serif text-2xl">Home banners</h2>
        </div>
        <label className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs cursor-pointer">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {uploading ? "Uploading…" : "Add banner"}
          <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={uploading} />
        </label>
      </div>

      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption for the next banner you add (optional)"
        className="input mb-5"
      />

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : banners.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No custom banners yet — the home page is showing the default slides.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {banners.map((b, i) => (
            <BannerPreviewCard
              key={b.id}
              banner={b}
              onUp={() => void move(i, -1)}
              onDown={() => void move(i, 1)}
              onToggle={() => void toggle(b)}
              onRemove={() => void destroy(b)}
              onSaved={load}
            />
          ))}
        </ul>
      )}

    </motion.section>
  );
}

export default BannerManager;
