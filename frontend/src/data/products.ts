import catalogueData from "./catalogue.json";

export type ProductCategory = "T-shirts" | "Sweatshirts" | "Outerwear";

export type ProductSizeInventory = {
  size: string;
  quantity: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  garmentType: string;
  category: ProductCategory;
  price: number;
  image: string;
  colors: string[];
  searchTags: string[];
  inventory: ProductSizeInventory[];
};

type CatalogueRecord = {
  product_id: string;
  name: string;
  garment_type: string;
  description: string;
  colors: string[];
  search_tags: string[];
  image_file_path: string;
  price: number;
  inventory: ProductSizeInventory[];
};

const productImages = import.meta.glob<string>("../../../data/products/*.jpg", {
  eager: true,
  import: "default",
  query: "?url",
});

function getCategory(garmentType: string): ProductCategory {
  const normalizedType = garmentType.toLowerCase();
  if (normalizedType.includes("jacket") || normalizedType.includes("bomber")) {
    return "Outerwear";
  }
  if (normalizedType.includes("shirt") || normalizedType.includes("tee")) {
    return "T-shirts";
  }
  return "Sweatshirts";
}

export const products: Product[] = (catalogueData as CatalogueRecord[]).map((record) => {
  const imageKey = `../../../data/${record.image_file_path}`;
  const image = productImages[imageKey];

  if (!image) {
    throw new Error(`Missing product image import for ${record.product_id}: ${imageKey}`);
  }

  return {
    id: record.product_id,
    name: record.name,
    description: record.description,
    garmentType: record.garment_type,
    category: getCategory(record.garment_type),
    price: record.price,
    image,
    colors: record.colors,
    searchTags: record.search_tags,
    inventory: record.inventory,
  };
});
