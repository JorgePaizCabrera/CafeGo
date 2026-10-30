-- AlterEnum
ALTER TYPE "ReferenciaTipo" ADD VALUE 'orden';

-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "bag_size_grams" DECIMAL(10,2) NOT NULL DEFAULT 350;

-- AlterTable
ALTER TABLE "producciones_blend" ADD COLUMN     "bag_type" TEXT NOT NULL DEFAULT 'comercial';

-- AlterTable
ALTER TABLE "producciones_gourmet" ADD COLUMN     "comercial_bags" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "especial_bags" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "inventario_empaque_stock" (
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "minimo" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_empaque_stock_pkey" PRIMARY KEY ("tipo")
);

-- CreateTable
CREATE TABLE "inventario_empaque_movimientos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_empaque" TEXT NOT NULL,
    "tipo" "MovementKind" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "referencia_tipo" "ReferenciaTipo",
    "referencia_id" TEXT,
    "saldo_resultante" INTEGER NOT NULL,

    CONSTRAINT "inventario_empaque_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventario_empaque_movimientos_tipo_empaque_fecha_idx" ON "inventario_empaque_movimientos"("tipo_empaque", "fecha");
