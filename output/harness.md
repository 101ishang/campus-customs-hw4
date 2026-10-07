# Database

The database has four tables: `users`, `catalogue`, `inventory`, and `chat_messages`.

`catalogue` represents the products, their descriptions, prices, and other product data. `users` contains the website users’ accounts. Never share or print password hashes. `inventory` records item quantities, including in-stock items and out-of-stock items (with quantity zero). `chat_messages` contains logs of previous user chats, and some records may also contain product details.

## Account and Login

The `users` table stores each account’s `id`, combined `name`, `first_name`, `last_name`, `email`, `created_at`, and `password_hash`. Registration trims names and normalizes email addresses to lowercase. The password hash is private authentication data and must never be printed or shared.

Passwords are not stored as plaintext. New and migrated passwords are hashed with scrypt using a random 16-byte salt and the configured parameters `N=32768`, `r=8`, and `p=1`; the derived hash is 64 bytes. Registration requires at least 12 characters and allows up to 256. Existing legacy PBKDF2-SHA256 hashes remain verifiable and are upgraded to scrypt after a successful login.

After login, the API returns only public account fields (`id`, name, email, first name, and last name). It keeps sessions in memory and sends the session token in an HTTP-only, `SameSite=Strict` cookie with a 24-hour lifetime.

## Chat API and Agent

The front end sends a JSON `POST /api/chat` request containing the latest message, recent guest history, and current page context. During development, Vite proxies `/api/chat` and `/api/chat/history` to the FastAPI service on port 8001; `/api/auth` continues to go to the authentication service on port 8000. FastAPI validates a session cookie by checking `/api/auth/me`. For signed-in visitors it uses that verified response to persist history and inject the current customer's name and email into agent context. The chat response includes the assistant reply, signed-in status, and selected product cards. Product cards are rebuilt from catalogue tool results and local product images.

`backend/main.py` loads the agent from `backend/agent.py`. The agent reads its system instructions from `backend/prompts/prompt.md` and uses the configured Portkey model. `PORTKEY_API_KEY` is read by the backend process only; the key is not sent to the browser. The read-only `search_catalogue` and `search_catalogue_batch` tools supply product descriptions, prices, colors, and exact quantity per size from SQLite; a zero quantity is presented as out of stock. Catalogue reads retry once after a SQLite failure and then return a structured unavailable result with a shopper-safe message. `get_authentication_status` gives the agent only a signed-in boolean.

### Agent tools and model fields

The agent has three tools. Their database, identity, and page context is injected through server-side `AgentDependencies`: `database_path` identifies the SQLite file, `authenticated` carries the session check result, `customer` contains only the verified customer's `name` and `email`, `page_context` identifies the current page and an optional database-verified `product_id`, and `catalogue_results` holds trusted product cards for the API response. `catalogue_error` records a safe failure message so FastAPI can return it directly rather than relying on the model to explain a failed lookup. The database `user_id` used to scope saved history stays in FastAPI and is not passed to the agent.

#### `search_catalogue`

- **Lookup:** `CatalogueSearchRequest.query` is a trimmed free-text product query, limited to 200 characters. A free-text field lets the agent search with a product name or useful identifying terms without constructing SQL. Common plural forms are matched to their catalogue singulars (for example, “hoodies” matches “hoodie”). The read-only query matches against catalogue IDs, names, garment types, descriptions, colors, and search tags, then joins inventory by product ID.
- **Result:** `CatalogueSearchResult.matched_query` records the normalized query and `products` contains up to five matching `ProductCard` records. Each card returns `product_id`, `name`, `garment_type`, `description`, `price`, `colors`, and `sizes`. These fields let the assistant identify the matched item and answer product questions from database values; the ID also lets the front end link the card to its product page.
- **Stock detail:** Each `ProductCard.sizes` entry is a `ProductSizeStatus` with `size`, exact `quantity`, and `in_stock`. Keeping both quantity and status supports exact answers and simple display logic. A model validator enforces that `in_stock` is true only when quantity is above zero, so quantity zero is represented as out of stock.
- The prompt requires this tool for every product fact, especially every price, availability, or stock-count question. If no matching record or size is returned, the assistant says the database has no matching information rather than filling in a value.

#### `search_catalogue_batch`

- **Lookup:** `CatalogueBatchSearchRequest.queries` accepts one to five trimmed product queries, each limited to 200 characters. The tool loads the catalogue and inventory in one read-only SQLite query, then ranks those in-memory rows independently for each query. This avoids repeating the database read when a shopper asks for several related product types.
- **Result:** `CatalogueBatchSearchResult.searches` contains one `CatalogueSearchResult` per submitted query, with its own `matched_query` and up to five trusted `ProductCard` matches. The cards use the same fields as `search_catalogue`, and selected IDs are added to `AgentDependencies.catalogue_results` for safe API response resolution.
- **Failure handling:** Both catalogue tools make up to two read attempts. If SQLite still fails, the result is marked `status: "unavailable"` and carries a clear `error_message`. FastAPI returns that message with no product cards, so the assistant cannot fill in missing prices, stock, or product claims.

#### `get_authentication_status`

- **Lookup:** It takes no customer-supplied lookup fields. It reads only `AgentDependencies.authenticated`, which FastAPI derives by validating the session cookie with the auth service. This avoids giving the agent account identifiers or private account records.
- **Result:** `AuthenticationStatus.authenticated` is a boolean used only to answer whether the current visitor is signed in. It contains no profile fields, credentials, or password hashes.

### Product match API contract

For browse requests such as “What hoodies do you have?”, the agent returns up to five `AgentReply.product_matches`. Each `AgentProductMatch` contains only a `product_id` selected from the current search results. The agent does not generate product prices or descriptions in this selection. FastAPI resolves each ID against the `catalogue_results` populated by either catalogue search tool, then returns those trusted `ProductCard` objects in `ChatResponse.products` (up to five).

The front end receives each product's ID, name, database price, description, and stock data. It uses the ID to select the matching image already bundled from the public catalogue and links the card to that item's page. Chat cards display the image, name, price, and database description; CSS clamps the description to two lines so it reads as short info. This keeps the displayed details sourced from SQLite while letting the agent decide which search matches answer the customer's request.

### Chat product cards and detail pages

The search results reach the chat as follows: SQLite → `search_catalogue` or one SQLite read through `search_catalogue_batch` → `CatalogueSearchResult.products` → agent-selected `AgentReply.product_matches` IDs → FastAPI resolves those IDs back to the trusted tool results → `ChatResponse.products` → `ChatPanel` stores them on the assistant message and renders a card for each match. The bundled image is looked up by the same product ID in the front-end catalogue.

Each chat card is a React Router `Link` to `/products/{product_id}` (with the ID URL-encoded), the same route used by the Products page cards. `App.tsx` maps `/products/:productId` to `ProductDetailPage`; it finds the item in the full front-end catalogue and shows the large image, full product name, description, colors, price, and per-size quantities and availability. This preserves the Section 3 single-item shopping page for cards returned dynamically by chat.

### Persisted chat history and runtime context

Signed-in chat turns are saved to the existing `chat_messages` table after a successful agent response. FastAPI obtains `user_id`, `name`, and `email` from the auth service's `/api/auth/me` response; it uses `user_id` only to associate and retrieve rows. It writes one `user` row and one `assistant` row per exchange. The assistant row's `products_json` stores only selected product IDs, so cards reloaded later are reconstructed from current `catalogue` and `inventory` values rather than stale serialized prices or stock counts. Guest messages remain in browser memory and are never written to the table.

When a signed-in user returns or logs in, the front end calls `GET /api/chat/history`. FastAPI returns that user's latest 100 messages and rehydrates saved product IDs into current product cards. On each signed-in `POST /api/chat`, FastAPI loads the same user's latest 12 messages for the model context and ignores browser-supplied history. The request includes the page name and, on a product-detail page, the current product ID derived from the route. FastAPI checks that ID against SQLite before adding it to `AgentDependencies.page_context`. The agent's dynamic instructions receive the verified `AgentDependencies.customer` name and email plus this page context; the user ID and session token are never given to the model. The prompt treats profile values as data, avoids volunteering the email, and directs “this” or “it” product questions through a fresh catalogue lookup using the verified product ID.

The catalogue lists product colors, while `inventory` stores quantities by product and size without a color dimension. The agent can confirm whether a color is listed for the current product, but it must explain that color-specific stock is not recorded rather than claiming a size quantity applies to that color.

### Catalogue discovery, cart, and checkout preview

The Products page searches product names, descriptions, categories, garment types, and tags. Shoppers can filter by category, minimum/maximum price, listed color, and available size, then sort by category, ascending or descending price, listed color, or number of listed color/available-size choices. These controls use the catalogue exported from SQLite; available-size filters exclude sizes whose recorded quantity is zero.

On a product detail page, a shopper chooses one of the catalogue's listed colors and an in-stock size before adding the variant to the cart. The cart is stored in browser `localStorage` and shows each selection, quantity, and catalogue-price subtotal. Quantity changes are capped by the recorded product/size amount across color variants, but the cart does not reserve inventory; the database does not track stock by color.

The checkout route is an order-review preview only. It repeats selected variants and the item subtotal, and states that shipping, tax, payment, and order submission are not connected. Its order button is disabled, so the interface does not claim that a purchase was made or a payment collected.

## Agent loop, audit, and limits

`backend/main.py` starts one PydanticAI run for each `POST /api/chat`. The run uses `UsageLimits(request_limit=8, tool_calls_limit=6)`: at most eight model requests and six successful tool calls. The agent configuration allows one retry for agent validation/tool errors; the Portkey OpenAI client allows one HTTP retry with a 30-second timeout. Catalogue SQLite reads independently make at most two attempts with a brief delay. A run-level error yields HTTP 502 with a generic message. A catalogue failure yields a structured `unavailable` tool result and a safe shopper-facing error, with no cards.

`output/audit_trail.json` is a JSON array of records preserved across server runs. Each record contains a UTC `time`, `run_id`, `tool_name`, short `args` and `result` summaries, and a `stop_reason` (null while the loop continues). The API writes an `agent.run` start and finish/error record; each catalogue or authentication tool writes its own outcome. The finish record uses the last model response's `finish_reason` when available, otherwise `completed`; an exception records its type. File updates are serialized and atomic so earlier records are retained. The log deliberately includes only counts, lengths, statuses, error types, and the verified signed-in boolean. It excludes chat text, search strings, names, emails, product text, session cookies, passwords, hashes, and API keys.
The initial records include local smoke checks using a stubbed model; no external model call was needed to verify audit persistence and error logging.

## Structured models and result caps

The types live in `backend/models.py` (there is no `model.py`). `ChatRequest` limits the incoming message to 2,000 characters, guest history to 12 turns of 1,500 characters, and page context to an allowed page plus an optional 100-character product ID. These bounds prevent an oversized browser request from becoming agent context. `AgentDependencies` carries the read-only database path, authenticated state, verified name/email when signed in, validated page context, current trusted catalogue results, safe catalogue error, and an audit run ID; the run ID joins audit events without identifying the shopper. `AgentReply` limits generated reply text to 4,000 characters and selected product IDs to five. `ChatResponse` sends at most five verified product cards; `ChatHistoryResponse` sends at most 100 saved messages. `CatalogueSearchRequest.query` is at most 200 characters; `CatalogueBatchSearchRequest.queries` allows one to five queries of that size. Each search returns at most five cards. `ProductCard` carries database name, type, description, price, colors, and size status; `ProductSizeStatus` validates that `in_stock` agrees with the nonnegative quantity. `AuthenticationStatus` holds only a boolean. These separate fields keep product data and provider/runtime metadata out of free-form reply text.

## Safety and operations

The agent can search the read-only catalogue and inventory, search several related queries in one database read, and check the verified sign-in boolean. It cannot change stock, accounts, or orders. Every product answer requires a fresh successful tool lookup; prices and quantities come only from SQLite. Missing data is described as missing, and quantity zero is called out of stock. Because inventory is not recorded by color, the agent cannot promise color-specific stock. Customer text, chat history, and catalogue descriptions are untrusted data; they cannot override the system prompt or reveal secrets. The model sees verified name and email only for a signed-in shopper, but does not receive the user ID, cookie, password hash, or Portkey key.

The model is `PORTKEY_MODEL` (default `gpt-4o-mini`) through Portkey's OpenAI-compatible endpoint at `PORTKEY_BASE_URL` (default `https://api.portkey.ai/v1`). The backend reads `PORTKEY_API_KEY` from its environment or ignored `backend/.env`; optional `PORTKEY_VIRTUAL_KEY` or `PORTKEY_PROVIDER` controls routing. No key belongs in `VITE_` variables. From the `hw4/` root, install Python packages with `.venv/bin/python -m pip install -r requirements.txt`; install JavaScript packages with `cd frontend && npm ci`. From `hw4/frontend/`, `npm run dev` starts auth on port 8000, chat on 8001, and Vite on 5173; the launcher runs Uvicorn with `backend/` as its working directory. To run chat separately from `hw4/backend/`: `../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001`. The front end proxies `/api/auth` to auth and `/api/chat` to chat. `GET /health` checks the chat process.
