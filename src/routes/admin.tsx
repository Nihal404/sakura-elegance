import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Trash2, Package, Plus, LayoutDashboard, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, type Category } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, authLoading, products, addProduct, removeProduct } = useStore();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Category>("Clothing");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

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

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (!name || !priceNum || !file) {
      toast.error("Please fill all fields and pick an image.");
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      // Long-lived signed URL (10 years)
      const { data: signed, error: sErr } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("Failed to sign URL");

      await addProduct({
        name,
        price: priceNum,
        category,
        image: signed.signedUrl,
      });
      toast.success("Product added to the boutique.");
      setName("");
      setPrice("");
      setFile(null);
      setPreview("");
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

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-10"
      >
        <div className="w-12 h-12 rounded-2xl bg-sakura flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
          <h1 className="font-serif text-4xl">Boutique Dashboard</h1>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-card rounded-3xl shadow-soft p-7 border border-border/60 h-fit"
        >
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-4 h-4 text-primary" />
            <h2 className="font-serif text-2xl">Add product</h2>
          </div>

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
            <Field label="Price (USD)">
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
            <Field label="Product image">
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:cursor-pointer cursor-pointer"
                required={!file}
              />
              {preview && (
                <img
                  src={preview}
                  alt="Preview"
                  className="mt-3 w-24 h-24 rounded-xl object-cover border border-border/60"
                />
              )}
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 bg-card rounded-3xl shadow-soft p-7 border border-border/60"
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
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                        {p.category}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">${p.price}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onRemove(p.id)}
                          className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
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
