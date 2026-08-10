import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

type Review = {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  comment: string;
  created_at: string;
};

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
              className={filled ? "fill-primary text-primary" : "text-primary/40"}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reviews")
        .select("id, product_id, name, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (!error && data) setReviews(data as Review[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`reviews:${productId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `product_id=eq.${productId}` },
        (payload) => {
          setReviews((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Review;
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== (payload.old as Review).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [productId]);

  const avg = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Please sign in to leave a review.");
      return;
    }
    if (!name.trim() || !comment.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        product_id: productId,
        name: name.trim().slice(0, 60),
        rating,
        comment: comment.trim().slice(0, 1000),
        user_id: user.id,
      })
      .select("id, product_id, name, rating, comment, created_at")
      .single();
    setSubmitting(false);
    if (error) {
      setError("Couldn't post your review. Please try again.");
      return;
    }
    if (data) {
      setReviews((prev) =>
        prev.some((r) => r.id === (data as Review).id) ? prev : [data as Review, ...prev],
      );
    }
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
              : loading
                ? "Loading reviews…"
                : "Be the first to review"}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Form */}
        {!user ? (
          <div className="rounded-3xl bg-blush/50 border border-border/60 p-6 lg:p-8 shadow-soft flex flex-col items-start">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Lock className="w-3.5 h-3.5" />
              Sign in required
            </div>
            <h3 className="font-serif text-2xl mt-3">Leave a review</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Sign in to share your thoughts on this piece. Only Zari members can post reviews — it keeps the garden honest.
            </p>
            <Link
              to="/login"
              className="mt-6 px-7 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all"
            >
              Sign in to review
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl bg-blush/50 border border-border/60 p-6 lg:p-8 shadow-soft"
          >
            <h3 className="font-serif text-2xl">Leave a review</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Posting as <span className="text-foreground/80">{user.email}</span>
            </p>

            <label className="block mt-6 text-xs uppercase tracking-widest text-foreground/70">
              Your rating
            </label>
            <div className="mt-2">
              <StarRow value={rating} onChange={setRating} interactive size={26} />
            </div>

            <label htmlFor="review-name" className="block mt-5 text-xs uppercase tracking-widest text-foreground/70">
              Display name
            </label>
            <input
              id="review-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              placeholder="Sakura L."
              className="mt-2 w-full rounded-full bg-background border border-border/70 px-5 py-3 focus:outline-none focus:border-primary transition-colors"
            />

            <label htmlFor="review-comment" className="block mt-5 text-xs uppercase tracking-widest text-foreground/70">
              Review
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              required
              rows={4}
              placeholder="This piece felt like spring in silk…"
              className="mt-2 w-full rounded-2xl bg-background border border-border/70 px-5 py-3 focus:outline-none focus:border-primary transition-colors resize-none"
            />

            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 px-7 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wide shadow-soft hover:shadow-petal transition-all inline-flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Posting…" : "Post review"}
            </button>
          </form>
        )}

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-dashed border-border/70 p-10 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="w-4 h-4 animate-spin" /> Gathering petals…
            </div>
          ) : reviews.length === 0 ? (
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
                      {new Date(r.created_at).toLocaleDateString(undefined, {
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
