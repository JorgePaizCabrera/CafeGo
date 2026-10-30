import { prisma } from '../../src/lib/prisma'

const TABLES = [
  'orden_tuestes',
  'ordenes',
  'clientes',
  'producciones_gourmet_tuestes',
  'producciones_gourmet',
  'producciones_blend_tuestes',
  'producciones_blend',
  'inventario_movimientos',
  'inventario_stock',
  'inventario_empaque_movimientos',
  'inventario_empaque_stock',
  'inventario_producto_empacado',
  'configuracion',
  'usuarios',
]

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`)
}

export async function disconnectDb() {
  await prisma.$disconnect()
}
