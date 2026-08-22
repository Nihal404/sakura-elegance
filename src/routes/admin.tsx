import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Trash2, Package, Plus, ShieldAlert, Loader2, Pencil, Check, X, ImagePlus, Images, Sparkles, Flower2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useStore, type Category, type Product } from "@/lib/store";
import { supabase, PRODUCT_IMAGE_BUCKET } from "@/lib/zari/supabase";
import { describeProductImage } from "@/lib/zari/describe-product";
import { compressImage } from "@/lib/zari/compress-image";
import { BannerManager } from "@/components/BannerManager";


const MAX_MOCKUPS = 6;

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Zari Boutique" },
      { name: "description", content: "Manage inventory for Zari Boutique." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, authLoading, products, addProduct, removeProduct, updateProduct } = useStore();

  const [activeSection, setActiveSection] = useState<"poster" | "add" | "inventory" | null>("inventory");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [editMockups, setEditMockups] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Category>("Clothing");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);



  const parseFeatures = (raw: string) =>
    raw
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 8);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "Admin") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="inline-flex w-14 h-14 rounded-full bg-blush items-center justify-center mb-5">
          <ShieldAlert className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-serif text-3xl">Admins only</h1>
        <p className="mt-3 text-muted-foreground">
          You need to be signed in as an admin to view this page.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex px-6 py-3 rounded-full bg-primary text-primary-foreground shadow-soft"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const uploadFile = async (original: File): Promise<string> => {
    // Downscale/re-encode before upload so stored objects stay small and every CDN
    // variant is derived from a lean source.
    const f = await compressImage(original);
    const ext = (f.type.split("/")[1] || f.name.split(".").pop() || "jpg").replace("jpeg", "jpg");
    const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      // Immutable filenames + a 1-year cache header: the CDN and browsers reuse these
      // objects instead of re-fetching them for every shopper.
      .upload(path, f, { contentType: f.type, upsert: false, cacheControl: "31536000" });
    if (upErr) throw upErr;
    // product-images is a public bucket, so the URL never expires.
    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (!chosen.length) return;
    const combined = [...files, ...chosen].slice(0, MAX_MOCKUPS);
    if (files.length + chosen.length > MAX_MOCKUPS) {
      toast.error(`You can add up to ${MAX_MOCKUPS} images.`);
    }
    setFiles(combined);
    const dataUrls = await Promise.all(combined.map(readAsDataUrl));
    setPreviews(dataUrls);
    e.target.value = "";
    if (dataUrls[0]) void generateCopy(dataUrls[0]);
  };

  const generateCopy = async (imageDataUrl: string) => {
    setAiBusy(true);
    try {
      const result = await describeProductImage({
        imageDataUrl,
        name: name.trim() || undefined,
        category,
      });
      setDescription(result.description);
      if (result.features.length > 0) setFeatures(result.features.join("\n"));
      toast.success("AI wrote the description from your image.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not generate a description.");
    } finally {
      setAiBusy(false);
    }
  };


  const removePreview = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (!name || !priceNum || files.length === 0) {
      toast.error("Please fill all fields and add at least one image.");
      return;
    }
    setSubmitting(true);
    try {
      const urls = await Promise.all(files.map(uploadFile));
      await addProduct({
        name,
        price: priceNum,
        category,
        image: urls[0],
        description: description.trim(),
        features: parseFeatures(features),
        mockups: urls,
      });
      toast.success("Product added to the boutique.");
      setName("");
      setPrice("");
      setDescription("");
      setFeatures("");
      setFiles([]);
      setPreviews([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add product";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (id: string) => {
    try {
      await removeProduct(id);
      toast.success("Product removed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove";
      toast.error(msg);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice(String(p.price));
    setEditDescription(p.description);
    setEditFeatures(p.features.join("\n"));
    setEditMockups(p.mockups.length > 0 ? p.mockups : [p.image]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
    setEditDescription("");
    setEditFeatures("");
    setEditMockups([]);
  };

  const onEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!chosen.length) return;
    const room = MAX_MOCKUPS - editMockups.length;
    if (room <= 0) {
      toast.error(`Up to ${MAX_MOCKUPS} images.`);
      return;
    }
    const toUpload = chosen.slice(0, room);
    if (chosen.length > room) toast.error(`Only ${room} more allowed.`);
    setEditUploading(true);
    try {
      const urls = await Promise.all(toUpload.map(uploadFile));
      setEditMockups((prev) => [...prev, ...urls]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setEditUploading(false);
    }
  };

  const removeEditMockup = (i: number) => {
    setEditMockups((prev) => prev.filter((_, idx) => idx !== i));
  };

  const makeEditMain = (i: number) => {
    setEditMockups((prev) => {
      if (i === 0) return prev;
      const copy = [...prev];
      const [picked] = copy.splice(i, 1);
      return [picked, ...copy];
    });
  };

  const saveEdit = async (id: string) => {
    const priceNum = parseFloat(editPrice);
    if (!editName.trim() || !priceNum || priceNum <= 0) {
      toast.error("Enter a valid name and price.");
      return;
    }
    if (editMockups.length === 0) {
      toast.error("At least one image is required.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateProduct(id, {
        name: editName.trim(),
        price: priceNum,
        description: editDescription.trim(),
        features: parseFeatures(editFeatures),
        image: editMockups[0],
        mockups: editMockups,
      });
      toast.success("Product updated.");
      cancelEdit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update";
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const onReplaceMockups = async (
    e: React.ChangeEvent<HTMLInputElement>,
    id: string,
  ) => {
    const chosen = Array.from(e.target.files ?? []).slice(0, MAX_MOCKUPS);
    e.target.value = "";
    if (!chosen.length) return;
    setReplacingId(id);
    try {
      const urls = await Promise.all(chosen.map(uploadFile));
      await updateProduct(id, { image: urls[0], mockups: urls });
      toast.success("Mockups updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update pics";
      toast.error(msg);
    } finally {
      setReplacingId(null);
    }
  };


  const sections = [
    { key: "poster" as const, label: "Poster addition", icon: Flower2 },
    { key: "add" as const, label: "Add product", icon: Plus },
    { key: "inventory" as const, label: "Inventory", icon: Package },
  ];

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h1 className="font-times uppercase tracking-[0.18em] text-3xl sm:text-5xl leading-tight">
          Admin
          <br />
          Dashboard
        </h1>
        <p className="mt-3 text-lg sm:text-xl">
          <span className="font-zari text-gold">Zari</span>{" "}
          <span className="font-times uppercase tracking-[0.25em] text-sm sm:text-base text-muted-foreground">
            Boutique
          </span>
        </p>
      </motion.div>

      <div className="space-y-4">
        {sections.map(({ key, label, icon: Icon }, idx) => {
          const open = activeSection === key;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
            >
              <button
                type="button"
                onClick={() => setActiveSection(open ? null : key)}
                aria-expanded={open}
                className={`w-full flex items-center gap-4 px-6 py-5 sm:py-6 rounded-full border transition-all ${
                  open
                    ? "bg-primary text-primary-foreground border-primary shadow-petal"
                    : "bg-card text-foreground border-border/70 shadow-soft hover:border-primary"
                }`}
              >
                <span
                  className={`w-10 h-10 shrink-0 rounded-full inline-flex items-center justify-center ${
                    open ? "bg-primary-foreground/20" : "bg-blush text-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-serif text-xl sm:text-2xl text-left">{label}</span>
                <ChevronDown
                  className={`ml-auto w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4">
                      {key === "poster" && user?.id && <BannerManager userId={user.id} />}
                      {key === "add" && renderAddProduct()}
                      {key === "inventory" && renderInventory()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .input {
          width: 100%;
          padding: 0.85rem 1rem;
          border-radius: 0.9rem;
          background: color-mix(in oklab, var(--blush) 60%, transparent);
          border: 1px solid var(--border);
          outline: none;
          transition: all 0.2s;
          font-size: 0.9rem;
        }
        .input:focus { border-color: var(--primary); background: var(--background); }
      `}</style>
    </div>
  );

  function renderAddProduct() {
    return (
        <div
          className="bg-card rounded-3xl shadow-soft p-6 sm:p-7 border border-border/60"
        >


          <form onSubmit={submit} className="space-y-4">
            <Field label="Product name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sakura Silk Gown"
                className="input"
                required
              />
            </Field>
            <Field label="PRICE (INR)">
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="149"
                className="input"
                required
              />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="input"
              >
                <option value="Clothing">Clothing</option>
                <option value="Accessories">Accessories</option>
              </select>
            </Field>
            <Field label="Description (written by AI from your image)">
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={aiBusy ? "AI is looking at your image…" : "Add an image and AI writes this for you — edit freely."}
                  rows={4}
                  className="input resize-y min-h-[110px]"
                />
                {aiBusy && (
                  <div className="absolute inset-0 rounded-[0.9rem] bg-background/60 flex items-center justify-center gap-2 text-xs text-primary">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing from your image…
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!previews[0]) {
                    toast.error("Add a product image first.");
                    return;
                  }
                  void generateCopy(previews[0]);
                }}
                disabled={aiBusy || previews.length === 0}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-blush text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                Regenerate with AI
              </button>
            </Field>

            <Field label="Highlights (one per line, up to 8)">
              <textarea
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder={"Hand-finished detail\nRose-gold accents\nSakura-soft palette\nShips in 2–7 days"}
                rows={4}
                className="input resize-y min-h-[110px]"
              />
            </Field>
            <Field label={`Product images (1–${MAX_MOCKUPS} · first is the main mockup)`}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onFileChange}
                disabled={files.length >= MAX_MOCKUPS}
                className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:cursor-pointer cursor-pointer disabled:opacity-60"
                required={files.length === 0}
              />
              {previews.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt={`Mockup ${i + 1}`}
                        className={`w-full aspect-square rounded-xl object-cover border ${i === 0 ? "border-primary ring-2 ring-primary/40" : "border-border/60"}`}
                      />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                          Main
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removePreview(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border/70 text-muted-foreground hover:text-destructive hover:border-destructive inline-flex items-center justify-center shadow-soft"
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                {files.length}/{MAX_MOCKUPS} selected
              </p>
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add to boutique
            </button>
          </form>
        </div>
    );
  }

  function renderInventory() {
    return (
        <div
          className="bg-card rounded-3xl shadow-soft p-6 sm:p-7 border border-border/60"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="font-serif text-2xl">Inventory</h2>
            </div>
            <span className="text-xs text-muted-foreground">{products.length} products</span>
          </div>


          <div className="overflow-hidden rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-blush/60 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4 hidden sm:table-cell">Category</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {products.map((p) => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="border-t border-border/60"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image}
                            alt=""
                            className="w-11 h-11 rounded-lg object-cover"
                          />
                          {editingId === p.id ? (
                            <div className="flex-1 flex flex-col gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="input !py-1.5 !px-3 max-w-[240px]"
                                autoFocus
                              />
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Description"
                                rows={2}
                                className="input !py-1.5 !px-3 text-xs resize-y min-h-[52px]"
                              />
                              <textarea
                                value={editFeatures}
                                onChange={(e) => setEditFeatures(e.target.value)}
                                placeholder="Highlights (one per line)"
                                rows={3}
                                className="input !py-1.5 !px-3 text-xs resize-y min-h-[64px]"
                              />
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                                  Mockups ({editMockups.length}/{MAX_MOCKUPS}) · click to make main
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                  {editMockups.map((src, i) => (
                                    <div key={src + i} className="relative group">
                                      <button
                                        type="button"
                                        onClick={() => makeEditMain(i)}
                                        className={`block w-full aspect-square rounded-md overflow-hidden border ${i === 0 ? "border-primary ring-2 ring-primary/40" : "border-border/60"}`}
                                        aria-label={`Make image ${i + 1} main`}
                                      >
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeEditMockup(i)}
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background border border-border/70 text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
                                        aria-label="Remove"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ))}
                                  {editMockups.length < MAX_MOCKUPS && (
                                    <label className="aspect-square rounded-md border border-dashed border-border/70 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary cursor-pointer">
                                      {editUploading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <ImagePlus className="w-3.5 h-3.5" />
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={onEditFileChange}
                                        className="hidden"
                                        disabled={editUploading}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium">{p.name}</span>
                              {p.description && (
                                <span className="text-xs text-muted-foreground line-clamp-1 max-w-[260px]">
                                  {p.description}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                        {p.category}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {editingId === p.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="input !py-1.5 !px-3 w-24 text-right ml-auto"
                          />
                        ) : (
                          <>₹{p.price}</>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {editingId === p.id ? (
                            <>
                              <button
                                onClick={() => saveEdit(p.id)}
                                disabled={savingEdit}
                                className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors disabled:opacity-50"
                                aria-label="Save"
                              >
                                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                                aria-label="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <label
                                className={`p-2 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer inline-flex ${replacingId === p.id ? "opacity-60 pointer-events-none" : ""}`}
                                aria-label="Change pics"
                                title="Change pics"
                              >
                                {replacingId === p.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Images className="w-4 h-4" />
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => onReplaceMockups(e, p.id)}
                                />
                              </label>
                              <button
                                onClick={() => startEdit(p)}
                                className="p-2 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                aria-label="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onRemove(p.id)}
                                className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
    );
  }
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
