-- AlterTable: el seguimiento queda apagado hasta que el admin lo envía por WhatsApp.
ALTER TABLE "ordenes" ADD COLUMN "seguimiento_activo" BOOLEAN NOT NULL DEFAULT false;
