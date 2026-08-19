/**
 * Product data access for Zari Boutique.
 *
 * Product metadata lives in Postgres; images live in Storage and only their public URLs
 * are stored here. Listings never fetch the whole catalogue: they use keyset (cursor)
 * pagination over the stable `(created_at desc, id desc)` ordering and select only the
 * columns a card needs. Detail pages fetch the heavy columns for one row.
 */
import { supabase } from "./supabase";

export type Category = "Clothing" | "Accessories";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  image: string;
  description: string;
  stock?: number | null;
  features: string[];
  mockups: string[];
  createdAt?: string;
}

/** Everything a product card renders — deliberately excludes description/mockups. */
const LIST_COLUMNS = "id,name,price,category,image_url,created_at";
const DETAIL_BASE = "id,name,price,category,image_url,description,stock,created_at";
const DETAIL_FULL = `${DETAIL_BASE},features,mockups`;

const MISSING_COLUMN = "42703";
/** features/mockups are added by supabase/zari-project.sql; degrade instead of erroring. */
let galleryColumns = true;
export const hasGalleryColumns = () => galleryColumns;
const detailColumns = () => (galleryColumns ? DETAIL_FULL : DETAIL_BASE);

export const PRODUCT_PAGE_SIZE = 24;

export interface ProductRow {
  id: string;
  name: string;
  price: number | string;
  category: string;
  image_url: string | null;
  description?: string | null;
  stock?: number | null;
  features?: string[] | null;
  mockups?: string[] | null;
  created_at?: string;
}

export function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    price: Number(r.price),
    category: (r.category === "Accessories" ? "Accessories" : "Clothing") as Category,
    image: r.image_url ?? "",
    description: r.description ?? "",
    stock: r.stock ?? null,
    features: r.features ?? [],
    mockups: r.mockups?.length ? r.mockups : r.image_url ? [r.image_url] : [],
    createdAt: r.created_at,
  };
}

export interface ProductCursor {
  createdAt: string;
  id: string;
}

export interface ProductPage {
  items: Product[];
  cursor: ProductCursor | null;
  hasMore: boolean;
}

export interface FetchPageOptions {
  cursor?: ProductCursor | null;
  category?: Category | null;
  search?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

/** One page of listing rows, newest first, using keyset pagination. */
export async function fetchProductPage({
  cursor = null,
  category = null,
  search = null,
  limit = PRODUCT_PAGE_SIZE,
  signal,
}: FetchPageOptions = {}): Promise<ProductPage> {
  let query = supabase
    .from("products")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (category) query = query.eq("category", category);
  if (search?.trim()) query = query.ilike("name", `%${search.trim()}%`);
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as ProductRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(rowToProduct);
  const last = page[page.length - 1];
  return {
    items,
    hasMore,
    cursor: last?.created_at ? { createdAt: last.created_at, id: last.id } : null,
  };
}

/** Full row for the product detail page (single query — no N+1 over mockups). */
export async function fetchProductById(id: string, signal?: AbortSignal): Promise<Product | null> {
  const run = async () => {
    let q = supabase.from("products").select(detailColumns()).eq("id", id).maybeSingle();
    if (signal) q = q.abortSignal(signal) as typeof q;
    return q;
  };
  let { data, error } = await run();
  if (error?.code === MISSING_COLUMN && galleryColumns) {
    galleryColumns = false;
    ({ data, error } = await run());
  }
  if (error) throw error;
  return data ? rowToProduct(data as unknown as ProductRow) : null;
}

/** Detail rows for a set of ids in one round trip (cart hydration). */
export async function fetchProductsByIds(ids: readonly string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const run = async () =>
    supabase.from("products").select(detailColumns()).in("id", ids as string[]);
  let { data, error } = await run();
  if (error?.code === MISSING_COLUMN && galleryColumns) {
    galleryColumns = false;
    ({ data, error } = await run());
  }
  if (error) throw error;
  return ((data ?? []) as unknown as ProductRow[]).map(rowToProduct);
}
