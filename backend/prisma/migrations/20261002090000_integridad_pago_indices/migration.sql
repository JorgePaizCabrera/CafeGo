-- Fecha de pago: "Cobrado en <mes>" debe usar cuándo se cobró, no cuándo se finalizó la orden.
ALTER TABLE "ordenes" ADD COLUMN "pagado_at" TIMESTAMP(3);
-- Para las órdenes ya pagadas no se sabe la fecha real de pago: se usa la de finalización como aproximación.
UPDATE "ordenes" SET "pagado_at" = COALESCE("finalized_at", "updated_at") WHERE "pagado" = true;

-- Postgres no indexa las llaves foráneas por sí solo; se filtran órdenes por cliente.
CREATE INDEX "ordenes_client_id_idx" ON "ordenes"("client_id");

-- Última línea de defensa: aunque un error de código intente dejar existencias negativas, la base lo
-- rechaza (y la transacción se revierte) en vez de guardar un inventario corrupto en silencio.
ALTER TABLE "inventario_stock" ADD CONSTRAINT "inventario_stock_cantidad_no_negativa" CHECK ("cantidad_lb" >= 0);
ALTER TABLE "inventario_empaque_stock" ADD CONSTRAINT "inventario_empaque_stock_cantidad_no_negativa" CHECK ("cantidad" >= 0);
ALTER TABLE "inventario_gourmet_empacado" ADD CONSTRAINT "inventario_gourmet_empacado_bolsas_no_negativas" CHECK ("bolsas" >= 0);
