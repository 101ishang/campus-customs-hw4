export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatPageContext = {
  page: "home" | "products" | "product-detail" | "about" | "login" | "create-account" | "other";
  product_id: string | null;
};

export type ChatProductCard = {
  product_id: string;
  name: string;
  garment_type: string;
  description: string;
  price: number;
  colors: string[];
  sizes: Array<{ size: string; quantity: number; in_stock: boolean }>;
};

export type ChatReply = {
  reply: string;
  authenticated: boolean;
  products: ChatProductCard[];
};

export type SavedChatMessage = ChatHistoryTurn & {
  id: number;
  products: ChatProductCard[];
  created_at: string;
};

export type SavedChatHistory = {
  authenticated: boolean;
  messages: SavedChatMessage[];
};

export async function loadChatHistory(): Promise<SavedChatHistory> {
  const response = await fetch("/api/chat/history", { credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as
    | SavedChatHistory
    | { detail?: string }
    | null;
  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : undefined;
    throw new Error(detail || "Saved chat history could not be loaded.");
  }
  if (!payload || !("messages" in payload) || !Array.isArray(payload.messages)) {
    throw new Error("The server returned invalid chat history.");
  }
  return payload;
}

export async function sendChatMessage(
  message: string,
  history: ChatHistoryTurn[],
  pageContext: ChatPageContext,
): Promise<ChatReply> {
  const response = await fetch("/api/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, page_context: pageContext }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ChatReply
    | { detail?: string }
    | null;
  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : undefined;
    throw new Error(detail || "The assistant could not respond right now.");
  }
  if (!payload || !("reply" in payload)) {
    throw new Error("The assistant returned an invalid response.");
  }
  return payload;
}
