# Shopper usability improvements

## Catalogue search, filters, and sorting

The collection already contains enough structured information to help shoppers narrow a large catalogue: product category, price, colors, and sizes with stock quantities. Adding text search, category and price filters, color and available-size filters, and useful sort orders helps shoppers reach relevant items quickly and compare options without scanning every product card. For the business, clearer discovery can expose more of the catalogue and make product details easier to evaluate.

Customization filters use the colors and sizes recorded for each product. Inventory is tracked by product and size, not by color, so the interface must not imply that a particular color and size combination has verified stock.

## Cart and checkout clarity

A cart that keeps selected product, size, color, quantity, and subtotal together gives shoppers a clear place to review their choices before proceeding. A visible item count and direct access to the cart reduce uncertainty about what they have selected. This also gives the business a familiar shopping flow that can later connect to order processing.

The current backend does not take payment or create orders. Checkout is therefore a review preview that clearly says no order is submitted, no charge is made, and shipping or tax are not included in the displayed item subtotal. This prevents the interface from suggesting a purchase has completed when the service cannot complete one.

## Batched catalogue lookups and failure handling

When a shopper asks about several product types or constraints, a batch catalogue tool can answer multiple related searches from one SQLite catalogue read. This reduces repeated database work and tool round trips, helping the agent reply faster with less model/tool overhead. Bounded retries can recover from transient database failures; if a lookup still fails, a structured fallback and plain error message tell the shopper the catalogue is temporarily unavailable instead of fabricating product facts.
