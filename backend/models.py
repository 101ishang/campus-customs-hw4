"""Request, response, and structured agent types for Campus Customs chat."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1_500)

    @field_validator("content")
    @classmethod
    def trim_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Chat messages cannot be blank.")
        return value


class ChatPageContext(BaseModel):
    page: Literal["home", "products", "product-detail", "about", "login", "create-account", "other"] = "other"
    product_id: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def product_id_requires_detail_page(self) -> "ChatPageContext":
        if self.product_id is not None and self.page != "product-detail":
            raise ValueError("product_id is only valid on the product-detail page.")
        return self


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    page_context: ChatPageContext = Field(default_factory=ChatPageContext)

    @field_validator("message")
    @classmethod
    def trim_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Chat messages cannot be blank.")
        return value


class AgentReply(BaseModel):
    reply: str = Field(min_length=1, max_length=4_000)
    product_matches: list["AgentProductMatch"] = Field(default_factory=list, max_length=5)


class ChatResponse(BaseModel):
    reply: str
    authenticated: bool
    products: list["ProductCard"] = Field(default_factory=list, max_length=5)


class ChatHistoryMessage(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)
    products: list["ProductCard"] = Field(default_factory=list, max_length=5)
    created_at: str


class ChatHistoryResponse(BaseModel):
    authenticated: bool
    messages: list[ChatHistoryMessage] = Field(default_factory=list, max_length=100)


class AgentDependencies(BaseModel):
    database_path: str
    authenticated: bool
    audit_run_id: str = ""
    customer: "AgentCustomer | None" = None
    page_context: ChatPageContext = Field(default_factory=ChatPageContext)
    catalogue_results: dict[str, "ProductCard"] = Field(default_factory=dict)
    catalogue_error: str | None = None


class AuthenticationStatus(BaseModel):
    authenticated: bool


class AgentCustomer(BaseModel):
    name: str = Field(min_length=1, max_length=161)
    email: str = Field(min_length=3, max_length=254)


class AgentProductMatch(BaseModel):
    """Agent-selected reference to a product returned by the catalogue tool."""

    product_id: str = Field(min_length=1, max_length=100)


class CatalogueSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)

    @field_validator("query")
    @classmethod
    def trim_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A catalogue search query cannot be blank.")
        return value


class CatalogueBatchSearchRequest(BaseModel):
    queries: list[str] = Field(min_length=1, max_length=5)

    @field_validator("queries")
    @classmethod
    def trim_queries(cls, values: list[str]) -> list[str]:
        queries = [value.strip() for value in values]
        if any(not query or len(query) > 200 for query in queries):
            raise ValueError("Each catalogue search query must contain 1 to 200 characters.")
        return queries


class ProductSizeStatus(BaseModel):
    size: str
    quantity: int = Field(ge=0)
    in_stock: bool

    @model_validator(mode="after")
    def stock_status_matches_quantity(self) -> "ProductSizeStatus":
        if self.in_stock != (self.quantity > 0):
            raise ValueError("in_stock must match whether quantity is greater than zero.")
        return self


class ProductCard(BaseModel):
    product_id: str
    name: str
    garment_type: str
    description: str
    price: float
    colors: list[str]
    sizes: list[ProductSizeStatus]


class CatalogueSearchResult(BaseModel):
    matched_query: str = Field(max_length=200)
    products: list[ProductCard] = Field(default_factory=list, max_length=5)
    status: Literal["ok", "unavailable"] = "ok"
    error_message: str | None = None


class CatalogueBatchSearchResult(BaseModel):
    searches: list[CatalogueSearchResult] = Field(default_factory=list, max_length=5)


AgentReply.model_rebuild()
ChatResponse.model_rebuild()
ChatHistoryMessage.model_rebuild()
ChatHistoryResponse.model_rebuild()
AgentDependencies.model_rebuild()
