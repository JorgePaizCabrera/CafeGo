-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave")
);

-- La alerta de café en grano pasa a ser una sola, sobre el total de los tres tuestes (5 lb por
-- defecto), en vez de un mínimo por cada tueste: se quita el mínimo por tueste.
INSERT INTO "configuracion" ("clave", "valor", "updated_at") VALUES ('grano_cafeteria_minimo_lb', 5, now());

UPDATE "inventario_stock" SET "minimo_lb" = NULL
WHERE "material" IN ('grano_claro', 'grano_medio', 'grano_oscuro');
