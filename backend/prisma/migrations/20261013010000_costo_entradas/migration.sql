-- Control de gastos: cuánto se pagó por cada entrada (compra) de materia prima y de bolsas.
-- Opcional: las entradas anteriores y las que no son compras quedan sin costo (NULL).
ALTER TABLE "inventario_movimientos" ADD COLUMN "costo_total" DECIMAL(12,2);
ALTER TABLE "inventario_empaque_movimientos" ADD COLUMN "costo_total" DECIMAL(12,2);

ALTER TABLE "inventario_movimientos" ADD CONSTRAINT "inventario_movimientos_costo_no_negativo" CHECK ("costo_total" IS NULL OR "costo_total" >= 0);
ALTER TABLE "inventario_empaque_movimientos" ADD CONSTRAINT "inventario_empaque_movimientos_costo_no_negativo" CHECK ("costo_total" IS NULL OR "costo_total" >= 0);
