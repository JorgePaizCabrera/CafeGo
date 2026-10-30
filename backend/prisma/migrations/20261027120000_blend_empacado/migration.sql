-- La tabla de bolsas llenas pasa a cubrir todo el producto terminado (Gourmet y Blend).
ALTER TABLE "inventario_gourmet_empacado" RENAME TO "inventario_producto_empacado";
ALTER TABLE "inventario_producto_empacado" RENAME CONSTRAINT "inventario_gourmet_empacado_pkey" TO "inventario_producto_empacado_pkey";
ALTER TABLE "inventario_producto_empacado" RENAME CONSTRAINT "inventario_gourmet_empacado_bolsas_no_negativas" TO "inventario_producto_empacado_bolsas_no_negativas";

-- Bolsas de Blend llenas = bolsas producidas - bolsas enviadas, sin exceder lo que cubre el stock en libras.
INSERT INTO "inventario_producto_empacado" ("tipo_bolsa", "bolsas", "updated_at")
SELECT 'blend', GREATEST(0, LEAST(
  COALESCE((SELECT SUM("actual_full_bags") FROM "producciones_blend" WHERE "status" = 'terminada'), 0)
    - COALESCE((SELECT SUM(ROUND("cantidad_lb" * 453.59237 / 350)) FROM "inventario_movimientos" WHERE "material" = 'blend_bolsas' AND "tipo" = 'salida'), 0),
  COALESCE((SELECT FLOOR(("cantidad_lb" * 453.59237 + 3) / 350) FROM "inventario_stock" WHERE "material" = 'blend_bolsas'), 0)
)), NOW()
ON CONFLICT ("tipo_bolsa") DO NOTHING;
