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

const ASPECTS = [
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
] as const;

/**
 * Live preview panel for a single banner: lets the admin see exactly how the banner
 * will letterbox at different aspect ratios and fits, and preview a caption edit
 * before saving it.
 */
function BannerPreviewCard({
  banner,
  onUp,
  onDown,
  onToggle,
  onRemove,
  onSaved,
}: {
  banner: Banner;
  onUp: () => void;
  onDown: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [caption, setCaption] = useState(banner.caption ?? "");
  const [aspect, setAspect] = useState<number>(4 / 3);
  const [fit, setFit] = useState<"contain" | "cover">("contain");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCaption(banner.caption ?? "");
  }, [banner.caption]);

  const dirty = caption.trim() !== (banner.caption ?? "");
  const src = galleryImageUrl(banner.image, 900);

  const save = async () => {
    setSaving(true);
    try {
      await updateBanner(banner.id, { caption: caption.trim() || null });
      await onSaved();
      toast.success("Caption saved.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save caption");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-2xl border border-border/60 overflow-hidden bg-background/60">
      {/* LIVE PREVIEW — mirrors the home page slider framing */}
      <div className="p-3 pb-0">
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-background"
          style={{ aspectRatio: String(aspect) }}
        >
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
          <img
            src={src}
            alt={caption || "Banner preview"}
            loading="lazy"
            className={`relative w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/45 to-transparent pointer-events-none" />
          {caption && (
            <div className="absolute bottom-6 right-3 left-3 text-right text-xs sm:text-sm text-white/95 font-medium drop-shadow">
              {caption}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground mr-1">Preview:</span>
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setAspect(a.value)}
              className={`px-2.5 py-1 rounded-full ${
                aspect === a.value ? "bg-primary text-primary-foreground" : "bg-blush text-primary"
              }`}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFit(fit === "contain" ? "cover" : "contain")}
            className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground ml-auto"
          >
            {fit === "contain" ? "Letterbox" : "Fill (crops)"}
          </button>
        </div>

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption"
          className="input text-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUp} className="px-2.5 py-1 rounded-full bg-blush text-primary text-[11px]">
            ↑ Up
          </button>
          <button type="button" onClick={onDown} className="px-2.5 py-1 rounded-full bg-blush text-primary text-[11px]">
            ↓ Down
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-[11px]"
          >
            {banner.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {banner.active ? "Visible" : "Hidden"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[11px]"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {dirty ? "Save caption" : "Saved"}
          </button>
        </div>
      </div>
    </li>
  );
}
