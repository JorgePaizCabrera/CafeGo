-- Blend tiene su propia bolsa (no se divide en Comercial/Especial como Gourmet): cada lote descuenta
-- del tipo de empaque "blend", así que ya no hace falta guardar el tipo de bolsa por lote.
ALTER TABLE "producciones_blend" DROP COLUMN "bag_type";

INSERT INTO "inventario_empaque_stock" ("tipo", "cantidad", "updated_at") VALUES ('blend', 0, now())
ON CONFLICT ("tipo") DO NOTHING;
