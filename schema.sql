CREATE TABLE IF NOT EXISTS panel_products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model text NOT NULL,
  flavor text NOT NULL,
  stock integer NOT NULL CHECK (stock >= 0)
);

ALTER TABLE panel_products
  ADD COLUMN IF NOT EXISTS order_quantity integer
  CHECK (order_quantity BETWEEN 0 AND 1000000);

CREATE UNIQUE INDEX IF NOT EXISTS panel_product_name
  ON panel_products (lower(model), lower(flavor));

CREATE TABLE IF NOT EXISTS panel_sales (
  id uuid PRIMARY KEY,
  sold_on date NOT NULL,
  product_id bigint NOT NULL REFERENCES panel_products(id),
  units integer NOT NULL CHECK (units > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS panel_sales_date
  ON panel_sales (sold_on);
