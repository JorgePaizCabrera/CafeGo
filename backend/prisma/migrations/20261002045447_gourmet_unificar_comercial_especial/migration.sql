-- Comercial y Especial no son productos distintos: es el mismo café Gourmet, la diferencia es
-- solo la bolsa de empaque usada (ver inventario_empaque_stock). Se fusiona el stock de ambos
-- materiales en uno solo ("gourmet"). Los movimientos históricos del Kardex
-- (inventario_movimientos) NO se tocan: son hechos pasados, nunca se reescriben.
INSERT INTO "inventario_stock" ("material", "cantidad_lb", "updated_at")
SELECT
  'gourmet',
  COALESCE((SELECT "cantidad_lb" FROM "inventario_stock" WHERE "material" = 'gourmet_comercial'), 0)
    + COALESCE((SELECT "cantidad_lb" FROM "inventario_stock" WHERE "material" = 'gourmet_especial'), 0),
  now()
ON CONFLICT ("material") DO UPDATE SET "cantidad_lb" = EXCLUDED."cantidad_lb", "updated_at" = now();

DELETE FROM "inventario_stock" WHERE "material" IN ('gourmet_comercial', 'gourmet_especial');

-- AlterTable: el paso de Empaque de Gourmet pasa a funcionar igual que Blend (bolsas completas +
-- sobrante en gramos) en vez de forzar un reparto de libras entre "comercial" y "especial".
ALTER TABLE "producciones_gourmet"
  DROP COLUMN "empaque_comercial_lb",
  DROP COLUMN "empaque_especial_lb",
  ADD COLUMN "actual_full_bags" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actual_remainder_grams" DECIMAL(10,2) NOT NULL DEFAULT 0;
