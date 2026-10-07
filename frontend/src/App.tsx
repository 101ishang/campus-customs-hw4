import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { products, type Product, type ProductCategory } from "./data/products";
import { createAccount, getCurrentUser, logIn, logOut, type AuthUser } from "./lib/auth";
import { loadChatHistory, sendChatMessage, type ChatPageContext, type ChatProductCard } from "./lib/chat";
import { addCartItem, cartSizeQuantity, readCart, setCartItemQuantity, writeCart, type CartItem } from "./lib/cart";
import handsomeDanPhoto from "./data/handsome-dan.jpg";
import handsomeDanAvatar from "./data/handsome-dan-avatar.jpg";

const navigation = [
  { label: "Home", to: "/", end: true },
  { label: "Products", to: "/products", end: false },
  { label: "About Us", to: "/about", end: false },
];

function HandsomeDanPhoto({ className, variant = "avatar" }: { className?: string; variant?: "avatar" | "full" }) {
  const classes = `bulldog-icon handsome-dan-photo${className ? ` ${className}` : ""}`;
  return <img className={classes} src={variant === "full" ? handsomeDanPhoto : handsomeDanAvatar} alt={variant === "full" ? "Handsome Dan XIX, Yale's bulldog mascot, wearing a blue bandana" : ""} />;
}

function PawPrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="26" rx="9" ry="7" />
      <ellipse cx="9" cy="17" rx="3.4" ry="4.2" transform="rotate(-22 9 17)" />
      <ellipse cx="17" cy="11" rx="3.4" ry="4.2" transform="rotate(-7 17 11)" />
      <ellipse cx="25" cy="11" rx="3.4" ry="4.2" transform="rotate(7 25 11)" />
      <ellipse cx="32" cy="17" rx="3.4" ry="4.2" transform="rotate(22 32 17)" />
    </svg>
  );
}

function colorSwatch(color: string): string {
  const normalized = color.toLowerCase();
  if (normalized.includes("white")) return "#fffdf8";
  if (normalized.includes("black")) return "#192331";
  if (normalized.includes("navy")) return "#142f50";
  if (normalized.includes("blue")) return "#4a77a3";
  if (normalized.includes("red") || normalized.includes("maroon")) return "#9f3847";
  if (normalized.includes("pink")) return "#d78e9b";
  if (normalized.includes("green")) return "#63836d";
  if (normalized.includes("yellow") || normalized.includes("gold")) return "#d3aa55";
  if (normalized.includes("gray") || normalized.includes("grey")) return "#92989c";
  if (normalized.includes("brown") || normalized.includes("tan")) return "#aa8260";
  if (normalized.includes("purple")) return "#8872a0";
  return "#aec0ce";
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function SiteHeader({ user, onLogout, notice, cartCount }: { user: AuthUser | null; onLogout: () => void; notice: string; cartCount: number }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" to="/" aria-label="Campus Customs home">
          <span className="brand-mark" aria-hidden="true"><HandsomeDanPhoto /></span>
          <span className="brand-name">Campus<span>Customs</span></span>
        </Link>

        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <nav className="account-nav" aria-label="Account navigation">
          <Link className="cart-link" to="/cart" aria-label={`Shopping cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4l1.3-6.1H7" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
            <span>Cart</span><span className="cart-count">{cartCount}</span>
          </Link>
          {user ? (
            <>
              <span className="account-greeting">Hi, {user.first_name || user.name}</span>
              <button className="logout-button" type="button" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink className="login-link" to="/login">Log in</NavLink>
              <NavLink className="signup-link" to="/create-account">Create account</NavLink>
            </>
          )}
          {notice && <span className="auth-header-notice" role="status">{notice}</span>}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="footer-brand" to="/">Campus Customs</Link>
      <p>Campus-inspired favorites, made for wherever you call home.</p>
      <span>© {new Date().getFullYear()} Campus Customs</span>
    </footer>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link className="product-image-link" to={`/products/${encodeURIComponent(product.id)}`} aria-label={`View ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
          <span className="product-view-label">View item <span aria-hidden="true">↗</span></span>
        </Link>
        <span className="product-category">{product.category}</span>
        <span className="product-mascot" aria-hidden="true"><HandsomeDanPhoto /></span>
      </div>
      <div className="product-copy">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <span className="product-price">${product.price.toFixed(2)}</span>
        </div>
        <p>{product.description}</p>
        <div className="product-card-options">
          <div className="product-card-swatches" role="group" aria-label={`Listed colors: ${product.colors.join(", ")}`}>
            {product.colors.slice(0, 3).map((color) => <span className="product-color-chip" key={color} title={color}><i className="product-color-swatch" style={{ backgroundColor: colorSwatch(color) }} />{color}</span>)}
            {product.colors.length > 3 && <span className="product-more-colors">+{product.colors.length - 3}</span>}
          </div>
          <span>{product.colors.length} colors · {product.inventory.filter((item) => item.quantity > 0).length} available sizes</span>
        </div>
      </div>
    </article>
  );
}

function HomePage() {
  const featuredIds = ["yale-bowl-t-shirt", "baseball-left-chest-crewneck", "basic-hoodie-big-yale", "saybrook-sweater-fleece-jacket"];
  const featured = featuredIds.flatMap((id) => {
    const product = products.find((item) => item.id === id);
    return product ? [product] : [];
  });
  const heroProduct = products.find((product) => product.id === "saybrook-sweater-fleece-jacket")!;

  return (
    <main>
      <section className="hero-section page-width">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> Yale-inspired campus essentials</span>
          <h1>Wear your<br /><span>campus</span> with pride.</h1>
          <p>Find the layers, tees, and keepsakes that bring a little campus spirit to every day.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/products">Explore the collection <span aria-hidden="true">↗</span></Link>
            <Link className="text-link" to="/about">Our story <span aria-hidden="true">→</span></Link>
          </div>
          <div className="hero-note"><PawPrintIcon className="paw-mark" /><span>Made for campus days<br /><strong>and everywhere after.</strong></span></div>
        </div>
        <div className="hero-art">
          <div className="hero-art-backdrop" />
          <span className="hero-sticker"><HandsomeDanPhoto /><span>Campus<br />classics</span></span>
          <img className="hero-product-image" src={heroProduct.image} alt={heroProduct.name} />
          <div className="hero-product-tag"><span>Campus favorite</span><strong>{heroProduct.name}</strong><small>${heroProduct.price}</small></div>
          <span className="hero-sparkle sparkle-one" aria-hidden="true">✳</span>
          <span className="hero-sparkle sparkle-two" aria-hidden="true">✦</span>
        </div>
      </section>

      <section className="benefit-strip" aria-label="Campus Customs highlights">
        <div className="page-width benefit-inner">
          <span><PawPrintIcon /> Your campus, your style</span>
          <span><PawPrintIcon /> Classics worth keeping</span>
          <span><PawPrintIcon /> Find your new favorite</span>
        </div>
      </section>

      <section className="section-block page-width">
        <div className="section-heading">
          <div><span className="eyebrow">Picked for you</span><h2>Campus favorites</h2></div>
          <Link className="text-link" to="/products">Shop all products <span aria-hidden="true">→</span></Link>
        </div>
        <div className="product-grid featured-grid">
          {featured.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      <section className="home-about page-width">
        <div className="about-mark"><HandsomeDanPhoto /><PawPrintIcon /></div>
        <div><span className="eyebrow">More than a sweatshirt</span><h2>A little piece of campus goes a long way.</h2></div>
        <Link className="button button-dark" to="/about">Get to know us <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  );
}

function ProductsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "All styles">("All styles");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [color, setColor] = useState("All colors");
  const [size, setSize] = useState("All available sizes");
  const [sort, setSort] = useState("featured");
  const categories: Array<ProductCategory | "All styles"> = ["All styles", "T-shirts", "Sweatshirts", "Outerwear"];
  const colors = useMemo(() => [...new Set(products.flatMap((product) => product.colors))].sort((a, b) => a.localeCompare(b)), []);
  const sizes = useMemo(() => [...new Set(products.flatMap((product) => product.inventory.filter((item) => item.quantity > 0).map((item) => item.size)))].sort((a, b) => a.localeCompare(b)), []);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const min = minimumPrice === "" ? null : Number(minimumPrice);
    const max = maximumPrice === "" ? null : Number(maximumPrice);
    const filtered = products.filter((product) => {
      const matchesCategory = category === "All styles" || product.category === category;
      const searchableText = `${product.name} ${product.description} ${product.category} ${product.garmentType} ${product.searchTags.join(" ")}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesPrice = (min === null || product.price >= min) && (max === null || product.price <= max);
      const matchesColor = color === "All colors" || product.colors.includes(color);
      const matchesSize = size === "All available sizes" || product.inventory.some((item) => item.size === size && item.quantity > 0);
      return matchesCategory && matchesQuery && matchesPrice && matchesColor && matchesSize;
    });
    const customizationCount = (product: Product) => product.colors.length + product.inventory.filter((item) => item.quantity > 0).length;
    return filtered.sort((left, right) => {
      switch (sort) {
        case "category":
          return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
        case "price-low":
          return left.price - right.price || left.name.localeCompare(right.name);
        case "price-high":
          return right.price - left.price || left.name.localeCompare(right.name);
        case "options":
          return customizationCount(right) - customizationCount(left) || left.name.localeCompare(right.name);
        case "color":
          return (left.colors[0] ?? "").localeCompare(right.colors[0] ?? "") || left.name.localeCompare(right.name);
        default:
          return products.indexOf(left) - products.indexOf(right);
      }
    });
  }, [category, color, maximumPrice, minimumPrice, query, size, sort]);

  function clearFilters() {
    setQuery("");
    setCategory("All styles");
    setMinimumPrice("");
    setMaximumPrice("");
    setColor("All colors");
    setSize("All available sizes");
    setSort("featured");
  }

  return (
    <main className="page-width inner-page">
      <div className="page-intro">
        <span className="eyebrow">The Campus Customs collection</span>
        <h1>Find your <span>campus favorite.</span></h1>
        <p>Easygoing staples, school spirit, and cozy layers for the whole year.</p>
      </div>

      <div className="category-tabs" aria-label="Filter products by category">
        {categories.map((item) => (
          <button key={item} className={category === item ? "category-tab active" : "category-tab"} onClick={() => setCategory(item)} aria-pressed={category === item}>
            {item}
          </button>
        ))}
      </div>

      <div className="catalogue-controls">
        <label className="search-box">
          <span className="visually-hidden">Search products</span>
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" />
        </label>
        <div className="price-filter" aria-label="Filter by price">
          <label><span>Min $</span><input type="number" min="0" step="0.01" value={minimumPrice} onChange={(event) => setMinimumPrice(event.target.value)} aria-label="Minimum price" placeholder="Any" /></label>
          <span aria-hidden="true">–</span>
          <label><span>Max $</span><input type="number" min="0" step="0.01" value={maximumPrice} onChange={(event) => setMaximumPrice(event.target.value)} aria-label="Maximum price" placeholder="Any" /></label>
        </div>
        <label className="filter-select"><span>Color</span><select value={color} onChange={(event) => setColor(event.target.value)}><option>All colors</option>{colors.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-select"><span>Available size</span><select value={size} onChange={(event) => setSize(event.target.value)}><option>All available sizes</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="filter-select sort-select"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Featured</option><option value="category">Category</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="options">Most customization options</option><option value="color">Color: A–Z</option>
        </select></label>
      </div>
      <p className="catalogue-results" aria-live="polite">Showing {filteredProducts.length} of {products.length} products · filter by listed colors and in-stock sizes</p>

      {filteredProducts.length > 0 ? (
        <div className="product-grid catalogue-grid">
          {filteredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="empty-state"><span>✳</span><h2>No matches just yet</h2><p>Try another search or browse all styles.</p><button className="button button-dark" onClick={clearFilters}>Clear filters</button></div>
      )}
      <p className="catalogue-note">Color choices come from the catalogue. Inventory counts are recorded by product and size, not by color.</p>
    </main>
  );
}

function ProductDetailPage({ cart, onAddToCart }: { cart: CartItem[]; onAddToCart: (product: Product, size: string, color: string) => boolean }) {
  const { productId } = useParams();
  const product = products.find((item) => item.id === productId);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [cartNotice, setCartNotice] = useState("");

  useEffect(() => {
    if (!product) return;
    setSelectedColor(product.colors[0] ?? "Standard");
    setSelectedSize(product.inventory.find((item) => item.quantity > 0)?.size ?? product.inventory[0]?.size ?? "");
    setCartNotice("");
  }, [productId, product]);

  if (!product) {
    return (
      <main className="page-width inner-page product-not-found">
        <span className="eyebrow">Product not found</span>
        <h1>We can’t find that item.</h1>
        <Link className="button button-primary" to="/products">Back to products <span aria-hidden="true">→</span></Link>
      </main>
    );
  }

  return (
    <main className="page-width inner-page product-detail-page">
      <Link className="back-to-products" to="/products"><span aria-hidden="true">←</span> All products</Link>
      <section className="product-detail-layout">
        <div className="detail-image-wrap">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="detail-information">
          <span className="eyebrow">{product.garmentType}</span>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <p className="detail-colors"><strong>Colors</strong><span>{product.colors.join(", ")}</span></p>
          <p className="detail-price">${product.price.toFixed(2)}</p>
          <div className="product-options">
            {product.colors.length > 0 && (
              <label className="product-option"><span>Color</span><select value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}>{product.colors.map((item) => <option key={item}>{item}</option>)}</select></label>
            )}
            <label className="product-option"><span>Size</span><select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
              {product.inventory.map(({ size, quantity }) => <option key={size} value={size} disabled={quantity <= 0}>{size}{quantity > 0 ? ` · ${quantity} recorded` : " · out of stock"}</option>)}
            </select></label>
          </div>
          <button className="button button-primary add-to-cart-button" type="button" disabled={!selectedSize || (product.inventory.find((item) => item.size === selectedSize)?.quantity ?? 0) <= cartSizeQuantity(cart, product.id, selectedSize)} onClick={() => setCartNotice(onAddToCart(product, selectedSize, selectedColor || "Standard") ? "Added to cart. This does not reserve inventory." : "The catalogue has no additional quantity recorded for this size.")}>
            Add to cart <span aria-hidden="true">→</span>
          </button>
          {cartNotice && <p className="cart-action-notice" role="status">{cartNotice}</p>}
          <p className="inventory-disclaimer">Colors are catalogue options; recorded stock counts are by size and are not color-specific.</p>
          <section className="detail-inventory" aria-labelledby="size-availability-heading">
            <div className="inventory-heading">
              <h2 id="size-availability-heading">Size availability</h2>
              <span>{product.inventory.filter((size) => size.quantity > 0).length} of {product.inventory.length} sizes in stock</span>
            </div>
            <ul className="size-stock-list">
              {product.inventory.map(({ size, quantity }) => {
                const inStock = quantity > 0;
                return (
                  <li className={inStock ? "in-stock" : "out-of-stock"} key={size}>
                    <strong>{size}</strong>
                    <span>{inStock ? `In stock · ${quantity} available` : "Out of stock"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}

function CartPage({ cart, onQuantityChange, onRemove }: {
  cart: CartItem[];
  onQuantityChange: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
}) {
  const cartProducts = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product ? [{ item, product }] : [];
  });
  const subtotal = cartProducts.reduce((total, { item, product }) => total + item.quantity * product.price, 0);

  if (!cartProducts.length) {
    return (
      <main className="page-width inner-page cart-page">
        <div className="page-intro"><span className="eyebrow">Your shopping bag</span><h1>Your cart is <span>ready for a favorite.</span></h1><p>Choose a product, then select its listed color and an available size.</p></div>
        <div className="empty-state"><span>✳</span><h2>Your cart is empty</h2><p>Your selected items will appear here for review.</p><Link className="button button-primary" to="/products">Browse products <span aria-hidden="true">→</span></Link></div>
      </main>
    );
  }

  return (
    <main className="page-width inner-page cart-page">
      <div className="page-intro"><span className="eyebrow">Your shopping bag</span><h1>Review your <span>selections.</span></h1><p>Check each item, color, size, and quantity before continuing.</p></div>
      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {cartProducts.map(({ item, product }) => {
            const availableQuantity = product.inventory.find((entry) => entry.size === item.size)?.quantity ?? 0;
            const otherColorQuantity = cart
              .filter((entry) => entry.productId === item.productId && entry.size === item.size && entry !== item)
              .reduce((total, entry) => total + entry.quantity, 0);
            const canIncrement = item.quantity + otherColorQuantity < availableQuantity;
            return (
              <article className="cart-item" key={`${item.productId}-${item.size}-${item.color}`}>
                <Link className="cart-item-image" to={`/products/${encodeURIComponent(product.id)}`}><img src={product.image} alt={product.name} /></Link>
                <div className="cart-item-details">
                  <div className="cart-item-heading"><div><span className="eyebrow">{product.category}</span><h2>{product.name}</h2></div><strong>${(product.price * item.quantity).toFixed(2)}</strong></div>
                  <p>Color: {item.color} <span aria-hidden="true">·</span> Size: {item.size}</p>
                  <p className="cart-unit-price">${product.price.toFixed(2)} each · catalogue shows {availableQuantity} for this size</p>
                  <div className="cart-item-actions">
                    <div className="quantity-control" aria-label={`Quantity for ${product.name}`}>
                      <button type="button" onClick={() => onQuantityChange(item, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => onQuantityChange(item, item.quantity + 1)} disabled={!canIncrement} aria-label="Increase quantity">+</button>
                    </div>
                    <button type="button" className="remove-cart-item" onClick={() => onRemove(item)}>Remove</button>
                  </div>
                </div>
              </article>
            );
          })}
          <p className="cart-inventory-note">The catalogue records quantity by product and size, not color. Adding items does not reserve stock.</p>
          <Link className="text-link cart-continue-shopping" to="/products"><span aria-hidden="true">←</span> Continue shopping</Link>
        </section>
        <aside className="cart-summary">
          <span className="eyebrow">Order summary</span>
          <h2>Items subtotal</h2>
          <div className="cart-summary-row"><span>Items ({cartProducts.reduce((total, entry) => total + entry.item.quantity, 0)})</span><strong>${subtotal.toFixed(2)}</strong></div>
          <p>Shipping and tax are not calculated in this preview.</p>
          <Link className="button button-primary checkout-link" to="/checkout">Review checkout <span aria-hidden="true">→</span></Link>
          <small>No order or payment is submitted by continuing.</small>
        </aside>
      </div>
    </main>
  );
}

function CheckoutPage({ cart }: { cart: CartItem[] }) {
  const lines = cart.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product ? [{ item, product }] : [];
  });
  const subtotal = lines.reduce((total, { item, product }) => total + item.quantity * product.price, 0);

  return (
    <main className="page-width inner-page checkout-page">
      <div className="page-intro"><span className="eyebrow">Checkout preview</span><h1>Review before <span>you go.</span></h1><p>Your selected items and current catalogue subtotal are shown below.</p></div>
      {!lines.length ? (
        <div className="empty-state"><span>✳</span><h2>There are no items to review</h2><p>Add products to your cart to see a checkout preview.</p><Link className="button button-primary" to="/products">Browse products <span aria-hidden="true">→</span></Link></div>
      ) : (
        <div className="checkout-layout">
          <section className="checkout-review">
            <div className="checkout-notice" role="status"><strong>Ordering is not connected yet.</strong><span>This is a review preview. No order will be placed and no payment will be collected.</span></div>
            <h2>Items to review</h2>
            {lines.map(({ item, product }) => <div className="checkout-line" key={`${item.productId}-${item.size}-${item.color}`}><span><strong>{product.name}</strong><small>{item.quantity} × ${product.price.toFixed(2)} · {item.color} · size {item.size}</small></span><strong>${(item.quantity * product.price).toFixed(2)}</strong></div>)}
            <Link className="text-link" to="/cart"><span aria-hidden="true">←</span> Return to cart</Link>
          </section>
          <aside className="cart-summary">
            <span className="eyebrow">Current estimate</span>
            <h2>Items subtotal</h2>
            <div className="cart-summary-row"><span>{lines.reduce((total, entry) => total + entry.item.quantity, 0)} items</span><strong>${subtotal.toFixed(2)}</strong></div>
            <p>Shipping and tax are unavailable until live checkout is connected.</p>
            <button className="button checkout-unavailable" type="button" disabled>Place order · unavailable</button>
            <small>No charge will be made. This subtotal is for item prices only.</small>
          </aside>
        </div>
      )}
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page-width inner-page about-page">
      <div className="page-intro">
        <span className="eyebrow">A little campus spirit</span>
        <h1>For the moments<br />that make <span>campus yours.</span></h1>
        <p>Campus Customs brings the colors, traditions, and everyday feeling of Yale into pieces you can take with you.</p>
      </div>
      <section className="about-story">
        <div className="story-art"><HandsomeDanPhoto className="story-dan-photo" variant="full" /><span className="story-caption">EST. ON CAMPUS<br />MADE FOR EVERYWHERE</span></div>
        <div className="story-copy">
          <span className="eyebrow">Our point of view</span>
          <h2>Good campus gear should feel like it already belongs to you.</h2>
          <p>From the first cool morning of the semester to the last game of the year, the right favorite becomes part of the story. We bring together tees, sweatshirts, and layers inspired by the places and traditions that make Yale special.</p>
          <p>Browse the collection, find your piece, and carry a little campus with you wherever you go next.</p>
          <Link className="button button-primary" to="/products">Explore the collection <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </main>
  );
}

function AccountPage({ mode, onAuthenticated }: { mode: "login" | "create"; onAuthenticated: (user: AuthUser) => void }) {
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const isCreate = mode === "create";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");

    if (isCreate) {
      const firstName = String(values.get("firstName") ?? "").trim();
      const lastName = String(values.get("lastName") ?? "").trim();
      const confirmPassword = String(values.get("confirmPassword") ?? "");
      if (password !== confirmPassword) {
        setNotice("The passwords do not match.");
        return;
      }

      setNotice("");
      setIsSubmitting(true);
      try {
        const user = await createAccount({ firstName, lastName, email, password, confirmPassword });
        onAuthenticated(user);
        navigate("/");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not create the account.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setNotice("");
    setIsSubmitting(true);
    try {
      const user = await logIn(email, password);
      onAuthenticated(user);
      navigate("/");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="account-page page-width">
      <div className="account-card">
        <div className="account-card-top"><span className="brand-mark" aria-hidden="true"><HandsomeDanPhoto /></span><span>Campus Customs</span></div>
        <span className="eyebrow">{isCreate ? "Join the campus club" : "Welcome back"}</span>
        <h1>{isCreate ? "Create your account." : "Good to see you."}</h1>
        <p className="account-intro">{isCreate ? "Save your favorites and make the collection yours." : "Log in to pick up where you left off."}</p>
        <form className="account-form" onSubmit={handleSubmit}>
          {isCreate && <>
            <label>First name<input name="firstName" type="text" autoComplete="given-name" placeholder="First name" maxLength={80} required /></label>
            <label>Last name<input name="lastName" type="text" autoComplete="family-name" placeholder="Last name" maxLength={80} required /></label>
          </>}
          <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></label>
          <label>Password
            <input name="password" type="password" autoComplete={isCreate ? "new-password" : "current-password"} placeholder="Enter your password" minLength={isCreate ? 12 : undefined} maxLength={256} required />
            {isCreate && <small className="form-help">Use at least 12 characters.</small>}
          </label>
          {isCreate && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" minLength={12} maxLength={256} required /></label>}
          <button className="button button-primary form-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Please wait…" : isCreate ? "Create account" : "Log in"}<span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="form-notice" role={notice ? "alert" : "status"} aria-live="polite">{notice}</p>
        <p className="account-switch">{isCreate ? "Already have an account?" : "New to Campus Customs?"} <Link to={isCreate ? "/login" : "/create-account"}>{isCreate ? "Log in" : "Create account"}</Link></p>
      </div>
      <div className="account-side-note"><span>✳</span><p>Find a favorite.<br /><strong>Make it yours.</strong></p><Link to="/products">Browse the collection →</Link></div>
    </main>
  );
}

type ChatMessage = {
  id: number;
  role: "assistant" | "visitor";
  content: string;
  products?: ChatProductCard[];
};

function getChatPageContext(pathname: string): ChatPageContext {
  if (pathname === "/") return { page: "home", product_id: null };
  if (pathname === "/products") return { page: "products", product_id: null };
  if (pathname === "/about") return { page: "about", product_id: null };
  if (pathname === "/login") return { page: "login", product_id: null };
  if (pathname === "/create-account") return { page: "create-account", product_id: null };

  const productRoute = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productRoute) {
    let productId = productRoute[1];
    try {
      productId = decodeURIComponent(productId);
    } catch {
      // The backend will discard an invalid ID after checking the catalogue.
    }
    return { page: "product-detail", product_id: productId };
  }
  return { page: "other", product_id: null };
}

function welcomeMessage(): ChatMessage {
  return {
    id: 0,
    role: "assistant",
    content: "Hi! I can help you find Campus Customs products, prices, and available sizes.",
  };
}

function ChatPanel({ userId, authReady }: { userId: number | null; authReady: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage()]);
  const location = useLocation();
  const isOnProductPage = /^\/products\/[^/]+\/?$/.test(location.pathname);
  const chatStarters = isOnProductPage
    ? ["Do you have this in another color?", "Which sizes are in stock?", "Show similar items"]
    : ["Show me hoodies", "What can I get under $50?", "Help me find a gift"];
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  useEffect(() => {
    if (!authReady) return;
    let active = true;

    if (userId === null) {
      setAuthenticated(false);
      setMessages([welcomeMessage()]);
      setIsLoadingHistory(false);
      return () => { active = false; };
    }

    setAuthenticated(true);
    setMessages([welcomeMessage()]);
    setIsLoadingHistory(true);
    loadChatHistory()
      .then((savedHistory) => {
        if (!active) return;
        setAuthenticated(savedHistory.authenticated);
        const savedMessages = savedHistory.authenticated
          ? savedHistory.messages.map((message) => ({
            id: message.id,
            role: message.role === "user" ? "visitor" as const : "assistant" as const,
            content: message.content,
            products: message.products,
          }))
          : [];
        setMessages([welcomeMessage(), ...savedMessages]);
      })
      .catch(() => {
        if (active) {
          setMessages([
            welcomeMessage(),
            { id: -1, role: "assistant", content: "Saved chat history could not be loaded. You can still start a new chat." },
          ]);
        }
      })
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });

    return () => { active = false; };
  }, [authReady, userId]);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending || isLoadingHistory || !authReady) return;
    const submittedUserId = userId;

    const history = messages
      .filter((message) => message.id !== 0)
      .slice(-12)
      .map((message) => ({
        role: message.role === "visitor" ? "user" as const : "assistant" as const,
        content: message.content,
      }));
    setMessages((current) => [...current, { id: current.length, role: "visitor", content }]);
    setDraft("");
    setIsSending(true);
    try {
      const response = await sendChatMessage(content, history, getChatPageContext(location.pathname));
      if (currentUserId.current !== submittedUserId) return;
      setAuthenticated(response.authenticated);
      setMessages((current) => [
        ...current,
        { id: current.length, role: "assistant", content: response.reply, products: response.products },
      ]);
    } catch (error) {
      if (currentUserId.current !== submittedUserId) return;
      const errorMessage = error instanceof Error ? error.message : "The assistant could not respond right now.";
      setMessages((current) => [...current, { id: current.length, role: "assistant", content: errorMessage }]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="chat-widget">
      <section
        className="chat-panel"
        id="chat-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="chat-heading"
        hidden={!isOpen}
      >
        <div className="chat-header">
          <span className="chat-brand-mark" aria-hidden="true"><HandsomeDanPhoto /></span>
          <div className="chat-heading-copy">
            <h2 id="chat-heading">Campus Guide</h2>
            <span><i aria-hidden="true" /> {authenticated ? "Signed in · Ready to help" : "Here to help you shop"}</span>
          </div>
          <button className="chat-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close chat panel">×</button>
        </div>
        <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-busy={isSending}>
          {messages.map((message) => (
            <div className={`chat-message ${message.role}${message.products?.length ? " with-products" : ""}`} key={message.id}>
              <span className="chat-sender">{message.role === "visitor" ? "You" : <><HandsomeDanPhoto /> Campus Guide</>}</span>
              <p>{message.content}</p>
              {message.products && message.products.length > 0 && (
                <div className="chat-product-cards" aria-label="Matching products">
                  {message.products.map((card) => {
                    const catalogueProduct = products.find((product) => product.id === card.product_id);
                    if (!catalogueProduct) return null;

                    return (
                      <Link
                        className="chat-product-card"
                        aria-label={`View full details for ${card.name}`}
                        key={card.product_id}
                        to={`/products/${encodeURIComponent(card.product_id)}`}
                      >
                        <img src={catalogueProduct.image} alt={card.name} loading="lazy" />
                        <span className="chat-product-card-copy">
                          <strong>{card.name}</strong>
                          <span className="chat-product-card-price">${card.price.toFixed(2)}</span>
                          <span className="chat-product-card-description">{card.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {messages.length === 1 && messages[0].id === 0 && !isLoadingHistory && (
            <div className="chat-starters" aria-label="Suggested questions">
              <span>Try asking</span>
              {chatStarters.map((starter) => <button key={starter} type="button" disabled={!authReady} onClick={() => setDraft(starter)}>{starter}<span aria-hidden="true">↗</span></button>)}
            </div>
          )}
        </div>
        <form className="chat-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="chat-draft">Your message</label>
          <input
            id="chat-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isLoadingHistory ? "Loading saved chat…" : isSending ? "Campus Customs is thinking…" : "Write a message..."}
            autoComplete="off"
            disabled={isSending || isLoadingHistory || !authReady}
          />
          <button type="submit" disabled={!draft.trim() || isSending || isLoadingHistory || !authReady} aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3-7-8-1Zm8 1 8-9" /></svg>
          </button>
        </form>
        <p className="chat-footnote">Product details use the live catalogue · Never share passwords</p>
      </section>
      <button
        className="chat-launcher"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Close chat panel" : "Open chat panel"}
        aria-expanded={isOpen}
        aria-controls="chat-panel"
      >
        {isOpen ? (
          <span className="chat-launcher-close" aria-hidden="true">×</span>
        ) : (
          <span className="chat-launcher-icon"><HandsomeDanPhoto /><span aria-hidden="true">✦</span></span>
        )}
      </button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(readCart);

  useEffect(() => {
    writeCart(cart);
  }, [cart]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setAuthNotice("Account service is unavailable.");
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    try {
      await logOut();
      setUser(null);
      setAuthNotice("");
    } catch {
      setAuthNotice("Could not log out. Please try again.");
    }
  }

  function handleAddToCart(product: Product, size: string, color: string): boolean {
    const availableQuantity = product.inventory.find((entry) => entry.size === size)?.quantity ?? 0;
    const result = addCartItem(cart, { productId: product.id, size, color }, availableQuantity);
    if (result.added) setCart(result.items);
    return result.added;
  }

  function handleCartQuantityChange(item: CartItem, quantity: number) {
    const product = products.find((entry) => entry.id === item.productId);
    const availableQuantity = product?.inventory.find((entry) => entry.size === item.size)?.quantity ?? 0;
    setCart((current) => setCartItemQuantity(current, item, quantity, availableQuantity));
  }

  function handleRemoveCartItem(item: CartItem) {
    setCart((current) => current.filter((entry) => entry !== item));
  }

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <>
      <ScrollToTop />
      <SiteHeader user={user} onLogout={() => { void handleLogout(); }} notice={authNotice} cartCount={cartCount} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage cart={cart} onAddToCart={handleAddToCart} />} />
        <Route path="/cart" element={<CartPage cart={cart} onQuantityChange={handleCartQuantityChange} onRemove={handleRemoveCartItem} />} />
        <Route path="/checkout" element={<CheckoutPage cart={cart} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<AccountPage mode="login" onAuthenticated={setUser} />} />
        <Route path="/create-account" element={<AccountPage mode="create" onAuthenticated={setUser} />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      <SiteFooter />
      <ChatPanel userId={user?.id ?? null} authReady={authReady} />
    </>
  );
}
