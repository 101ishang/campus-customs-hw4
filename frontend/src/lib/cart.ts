export type CartItem = {
  productId: string;
  size: string;
  color: string;
  quantity: number;
};

const STORAGE_KEY = "campus-customs-cart";

export function readCart(): CartItem[] {
  try {
    const payload: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(payload)) return [];
    return payload.filter((item): item is CartItem =>
      typeof item === "object" && item !== null &&
      typeof item.productId === "string" &&
      typeof item.size === "string" &&
      typeof item.color === "string" &&
      Number.isInteger(item.quantity) && item.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The cart remains usable for the current page if browser storage is unavailable.
  }
}

export function cartSizeQuantity(items: CartItem[], productId: string, size: string): number {
  return items
    .filter((item) => item.productId === productId && item.size === size)
    .reduce((total, item) => total + item.quantity, 0);
}

export function addCartItem(
  items: CartItem[],
  newItem: Omit<CartItem, "quantity">,
  availableQuantity: number,
): { items: CartItem[]; added: boolean } {
  if (cartSizeQuantity(items, newItem.productId, newItem.size) >= availableQuantity) {
    return { items, added: false };
  }

  const existing = items.find((item) =>
    item.productId === newItem.productId && item.size === newItem.size && item.color === newItem.color,
  );
  if (existing) {
    return {
      items: items.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item),
      added: true,
    };
  }
  return { items: [...items, { ...newItem, quantity: 1 }], added: true };
}

export function setCartItemQuantity(
  items: CartItem[],
  target: CartItem,
  quantity: number,
  availableQuantity: number,
): CartItem[] {
  if (quantity <= 0) {
    return items.filter((item) => item !== target);
  }
  const quantityInOtherColors = items
    .filter((item) => item.productId === target.productId && item.size === target.size && item !== target)
    .reduce((total, item) => total + item.quantity, 0);
  const cappedQuantity = Math.min(quantity, Math.max(0, availableQuantity - quantityInOtherColors));
  if (cappedQuantity <= 0) return items.filter((item) => item !== target);
  return items.map((item) => item === target ? { ...item, quantity: cappedQuantity } : item);
}
