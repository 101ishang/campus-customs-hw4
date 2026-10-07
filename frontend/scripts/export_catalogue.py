"""Export only public product and inventory data for the frontend."""

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "data" / "campus_customs.db"
OUTPUT = ROOT / "frontend" / "src" / "data" / "catalogue.json"
SIZE_ORDER = {"XS": 0, "S": 1, "M": 2, "L": 3, "XL": 4, "XXL": 5}


def main() -> None:
    connection = sqlite3.connect(DATABASE.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        inventory_by_product: dict[str, list[dict[str, int | str]]] = {}
        inventory_rows = connection.execute(
            "SELECT product_id, size, quantity FROM inventory"
        )
        for product_id, size, quantity in inventory_rows:
            inventory_by_product.setdefault(product_id, []).append(
                {"size": size, "quantity": quantity}
            )

        for sizes in inventory_by_product.values():
            sizes.sort(key=lambda item: SIZE_ORDER.get(str(item["size"]), 99))

        catalogue = []
        product_rows = connection.execute(
            """
            SELECT product_id, name, garment_type, description, colors,
                   search_tags, image_file_path, price
            FROM catalogue
            ORDER BY name
            """
        )
        for row in product_rows:
            (
                product_id,
                name,
                garment_type,
                description,
                colors,
                search_tags,
                image_file_path,
                price,
            ) = row
            if not (ROOT / "data" / image_file_path).is_file():
                raise FileNotFoundError(f"Product image is missing: {image_file_path}")

            catalogue.append(
                {
                    "product_id": product_id,
                    "name": name,
                    "garment_type": garment_type,
                    "description": description,
                    "colors": json.loads(colors),
                    "search_tags": json.loads(search_tags),
                    "image_file_path": image_file_path,
                    "price": price,
                    "inventory": inventory_by_product.get(product_id, []),
                }
            )
    finally:
        connection.close()

    OUTPUT.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n")
    print(f"Exported {len(catalogue)} products and {sum(len(p['inventory']) for p in catalogue)} size inventory records.")


if __name__ == "__main__":
    main()
