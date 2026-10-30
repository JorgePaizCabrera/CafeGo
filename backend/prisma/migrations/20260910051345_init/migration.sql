-- CreateEnum
CREATE TYPE "CoffeeType" AS ENUM ('pergamino', 'natural', 'oro');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Recibido', 'En preparación', 'En tueste', 'En molienda', 'En empaque', 'Finalizado');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('en_proceso', 'terminada');

-- CreateEnum
CREATE TYPE "RoastType" AS ENUM ('claro', 'medio', 'oscuro');

-- CreateEnum
CREATE TYPE "SegundaType" AS ENUM ('oro', 'natural');

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('entrada', 'salida');

-- CreateEnum
CREATE TYPE "ReferenciaTipo" AS ENUM ('produccion_gourmet', 'produccion_blend', 'manual');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "client_id" TEXT NOT NULL,
    "received_date" DATE NOT NULL,
    "estimated_date" DATE NOT NULL,
    "coffeeType" "CoffeeType" NOT NULL,
    "initial_weight" DECIMAL(10,2) NOT NULL,
    "humidity" DECIMAL(5,2) NOT NULL,
    "cleaning_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "threshing_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "final_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roast_type" TEXT NOT NULL,
    "grind_type" TEXT NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "actual_full_bags" INTEGER NOT NULL DEFAULT 0,
    "actual_remainder_grams" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "package_allocation" JSONB NOT NULL DEFAULT '{}',
    "incomplete_package_type" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "current_step_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_tuestes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "weight_lb" DECIMAL(10,2) NOT NULL,
    "initial_temp" DECIMAL(6,2) NOT NULL,
    "return_temp" DECIMAL(6,2) NOT NULL,
    "return_time" TEXT NOT NULL,
    "dehydration_temp" DECIMAL(6,2) NOT NULL,
    "dehydration_time" TEXT NOT NULL,
    "caramelization_temp" DECIMAL(6,2) NOT NULL,
    "caramelization_time" TEXT NOT NULL,
    "crack_temp" DECIMAL(6,2) NOT NULL,
    "crack_time" TEXT NOT NULL,
    "final_temp" DECIMAL(6,2) NOT NULL,
    "final_time" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "orden_tuestes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producciones_gourmet" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'en_proceso',
    "current_step_name" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "pergamino_used_lb" DECIMAL(10,2) NOT NULL,
    "trillado_weight_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "roast_type" "RoastType" NOT NULL DEFAULT 'medio',
    "peso_tueste_result_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reserva_cafeteria_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "molido_weight_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "empaque_comercial_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "empaque_especial_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notas" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "producciones_gourmet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producciones_gourmet_tuestes" (
    "id" TEXT NOT NULL,
    "produccion_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "weight_lb" DECIMAL(10,2) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "producciones_gourmet_tuestes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producciones_blend" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'en_proceso',
    "current_step_name" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad_planificada_lb" DECIMAL(10,2) NOT NULL,
    "segunda_type" "SegundaType" NOT NULL,
    "pergamino_used_lb" DECIMAL(10,2) NOT NULL,
    "segunda_used_lb" DECIMAL(10,2) NOT NULL,
    "trillado_weight_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "peso_tueste_result_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "molido_mezcla_weight_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actual_full_bags" INTEGER NOT NULL DEFAULT 0,
    "actual_remainder_grams" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notas" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "producciones_blend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producciones_blend_tuestes" (
    "id" TEXT NOT NULL,
    "produccion_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "weight_lb" DECIMAL(10,2) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "producciones_blend_tuestes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_stock" (
    "material" TEXT NOT NULL,
    "cantidad_lb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minimo_lb" DECIMAL(10,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_stock_pkey" PRIMARY KEY ("material")
);

-- CreateTable
CREATE TABLE "inventario_movimientos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "material" TEXT NOT NULL,
    "tipo" "MovementKind" NOT NULL,
    "cantidad_lb" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "referencia_tipo" "ReferenciaTipo",
    "referencia_id" TEXT,
    "saldo_resultante" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "inventario_movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_seq_key" ON "ordenes"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "orden_tuestes_order_id_seq_key" ON "orden_tuestes"("order_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "producciones_gourmet_seq_key" ON "producciones_gourmet"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "producciones_gourmet_tuestes_produccion_id_seq_key" ON "producciones_gourmet_tuestes"("produccion_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "producciones_blend_seq_key" ON "producciones_blend"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "producciones_blend_tuestes_produccion_id_seq_key" ON "producciones_blend_tuestes"("produccion_id", "seq");

-- CreateIndex
CREATE INDEX "inventario_movimientos_material_fecha_idx" ON "inventario_movimientos"("material", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_tuestes" ADD CONSTRAINT "orden_tuestes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producciones_gourmet_tuestes" ADD CONSTRAINT "producciones_gourmet_tuestes_produccion_id_fkey" FOREIGN KEY ("produccion_id") REFERENCES "producciones_gourmet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producciones_blend_tuestes" ADD CONSTRAINT "producciones_blend_tuestes_produccion_id_fkey" FOREIGN KEY ("produccion_id") REFERENCES "producciones_blend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
