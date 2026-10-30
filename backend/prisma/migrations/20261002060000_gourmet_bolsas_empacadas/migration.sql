-- CreateTable
CREATE TABLE "inventario_gourmet_empacado" (
    "tipo_bolsa" TEXT NOT NULL,
    "bolsas" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventario_gourmet_empacado_pkey" PRIMARY KEY ("tipo_bolsa")
);

-- Conteo inicial a partir de lo ya registrado: bolsas llenadas en lotes finalizados, menos las
-- bolsas ya enviadas. Las salidas viejas no guardaban el tipo de bolsa: las de "gourmet_especial"
-- se restan de Especial, y las demás de Comercial primero (y el excedente, de Especial).
DO $$
DECLARE
  bag_lb CONSTANT NUMERIC := 350 / 453.59237;
  comercial INTEGER;
  especial INTEGER;
  salidas_especial INTEGER;
  salidas_otras INTEGER;
BEGIN
  SELECT COALESCE(SUM("comercial_bags"), 0), COALESCE(SUM("especial_bags"), 0)
    INTO comercial, especial
    FROM "producciones_gourmet" WHERE "status" = 'terminada';

  SELECT COALESCE(SUM(ROUND("cantidad_lb" / bag_lb)), 0) INTO salidas_especial
    FROM "inventario_movimientos" WHERE "tipo" = 'salida' AND "material" = 'gourmet_especial';
  SELECT COALESCE(SUM(ROUND("cantidad_lb" / bag_lb)), 0) INTO salidas_otras
    FROM "inventario_movimientos" WHERE "tipo" = 'salida' AND "material" IN ('gourmet', 'gourmet_comercial');

  especial := especial - salidas_especial;
  comercial := comercial - salidas_otras;
  IF comercial < 0 THEN
    especial := especial + comercial;
    comercial := 0;
  END IF;

  INSERT INTO "inventario_gourmet_empacado" ("tipo_bolsa", "bolsas", "updated_at") VALUES
    ('comercial', GREATEST(comercial, 0), now()),
    ('especial', GREATEST(especial, 0), now());
END $$;
