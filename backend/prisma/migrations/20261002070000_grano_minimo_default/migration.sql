-- El café en grano de cafetería ahora también tiene mínimo (alerta de pocas existencias): 5 lb
-- por defecto para cada tipo de tueste. No pisa un mínimo que ya se haya configurado.
UPDATE "inventario_stock" SET "minimo_lb" = 5
WHERE "material" IN ('grano_claro', 'grano_medio', 'grano_oscuro') AND "minimo_lb" IS NULL;
