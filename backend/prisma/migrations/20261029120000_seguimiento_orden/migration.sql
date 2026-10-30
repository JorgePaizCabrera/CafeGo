-- AlterTable: las órdenes existentes reciben su propio token (el valor por defecto se evalúa por fila).
ALTER TABLE "ordenes" ADD COLUMN "seguimiento_token" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-'::text, '');

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_seguimiento_token_key" ON "ordenes"("seguimiento_token");
