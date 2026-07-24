import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-blush/40">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl">
            <span className="text-gradient-rose">Zari</span> Boutique
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">
            Timeless elegance, hand-picked for the modern romantic. Bloom in every occasion.
          </p>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-widest text-xs text-muted-foreground mb-3">Shop</p>
          <ul className="space-y-2">
            <li><Link to="/shop" search={{ category: "Clothing" } as any} className="hover:text-primary">Clothing</Link></li>
            <li><Link to="/shop" search={{ category: "Accessories" } as any} className="hover:text-primary">Accessories</Link></li>
            <li><Link to="/shop" className="hover:text-primary">All Collection</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="uppercase tracking-widest text-xs text-muted-foreground mb-3">Boutique</p>
          <ul className="space-y-2">
            <li><Link to="/login" className="hover:text-primary">Sign in</Link></li>
            <li className="text-muted-foreground">hello@zariboutique.com</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Zari Boutique. Crafted with love.
      </div>
    </footer>
  );
}
