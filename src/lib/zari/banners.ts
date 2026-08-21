import { supabase } from "./supabase";

/** A home-page banner slide managed from the admin panel. */
export interface Banner {
  id: string;
  image: string;
  caption: string | null;
  sortOrder: number;
  active: boolean;
}

export async function fetchBanners(activeOnly = true): Promise<Banner[]> {
  let query = supabase
    .from("banners")
    .select("id, image, caption, sort_order, active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    image: r.image,
    caption: r.caption,
    sortOrder: r.sort_order,
    active: r.active,
  }));
}

export async function addBanner(image: string, caption: string, sortOrder: number) {
  const { error } = await supabase
    .from("banners")
    .insert({ image, caption: caption.trim() || null, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateBanner(
  id: string,
  patch: { caption?: string | null; sort_order?: number; active?: boolean },
) {
  const { error } = await supabase.from("banners").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeBanner(id: string) {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) throw error;
}
