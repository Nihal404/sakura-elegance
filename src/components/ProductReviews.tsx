import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

type Review = {
  id: string;
  productId: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: number;
};

const STORAGE_KEY = "zari-reviews";

function loadAll(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(reviews: Review[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

function StarRow({
  value,
  onChange,
  size = 18,
  interactive = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  interactive?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onMouseEnter={() => interactive && setHover(n)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onChange?.(n)}
            className={`${interactive ? "cursor-pointer" : "cursor-default"} p-0.5`}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              width={size}
              height={size}
              className={
                filled
                  ? "fill-primary text-primary"
                  : "text-primary/40"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setReviews(loadAll().filter((r) => r.productId === productId));
  }, [productId]);

  const avg = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;
    const review: Review = {
      id: crypto.randomUUID(),
      productId,
      name: name.trim().slice(0, 60),
      rating,
      comment: comment.trim().slice(0, 500),
      createdAt: Date.now(),
    };
    const all = loadAll();
    const next = [review, ...all];
    saveAll(next);
    setReviews(next.filter((r) => r.productId === productId));
    setName("");
    setComment("");
    setRating(5);
  };

  return (
    <section className="mt-20">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-primary">
            Petal Reviews
          </span>
          <h2 className="font-serif text-3xl lg:text-4xl mt-2">
            What blossoms are saying
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <StarRow value={Math.round(avg)} />
          <span className="text-sm text-muted-foreground">
            {reviews.length
              ? `${avg.toFixed(1)} · ${reviews.length} review${reviews.length > 1 ? "s" : ""}`
              : "Be the first to review"}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Form */}
        <form
          onSubmit={submit}
          className="rounded-3xl bg-blush/50 border border-border/60 p-6 lg:p-8 shadow-soft"
        >
          <h3 className="font-serif text-2xl">Leave a review</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Share how this piece made you feel.
          </p>

          <label className="block mt-6 text-xs uppercase tracking-widest text-foreground/70">
            Your rating
          </label>
          <div className="mt-2">
            <StarRow value={rating} onChange={setRating} interactive size={26} />
          </div>

          <label className="block mt-5 text-xs uppercase tracking-widest text-foreground/70">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            placeholder="Sakura L."
            className="mt-2 w-full rounded-full bg-background border border-border/70 px-5 py-3 focus:outline-none focus:border-primary transition-colors"
          />

          <label className="block mt-5 text-xs uppercase tracking-widest text-foreground/70">
            Review
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            required
            rows={4}
            placeholder="This piece felt like spring in silk…"
            className="mt-2 w-full rounded-2xl bg-background border border-border/70 px-5 py-3 focus:outline-none focus:border-primary transition-colors resize-none"
          />

          <button
            type="submit"
            className="mt-6 px-7 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
          >
            Post review
          </button>
        </form>

        {/* List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 p-10 text-center text-muted-foreground">
              No reviews yet. Your words could be the first petal to fall.
            </div>
          ) : (
            reviews.map((r, i) => (
              <motion.article
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="rounded-3xl bg-card border border-border/60 p-6 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <StarRow value={r.rating} size={16} />
                </div>
                <p className="mt-3 text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {r.comment}
                </p>
              </motion.article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
