-- Fecha de la última corrección del costo de una entrada (null = nunca se corrigió).
ALTER TABLE "inventario_movimientos" ADD COLUMN "costo_corregido_at" TIMESTAMP(3);
ALTER TABLE "inventario_empaque_movimientos" ADD COLUMN "costo_corregido_at" TIMESTAMP(3);
