import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import {
  ALL_MATERIALS,
  GRANO_MINIMO_CLAVE,
  GRANO_MINIMO_DEFAULT_LB,
  MATERIA_PRIMA_MINIMO_DEFAULT_LB,
  RAW_MATERIALS,
} from '../src/modules/inventario/inventario.constants'
import { EMPAQUE_TYPES } from '../src/modules/inventario/empaque.constants'

const prisma = new PrismaClient()

async function seedUsuario() {
  const username = process.env.SEED_USERNAME
  const password = process.env.SEED_PASSWORD
  if (!username || !password) {
    console.log('SEED_USERNAME / SEED_PASSWORD no están definidos en .env — se omite la creación del usuario.')
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.usuario.upsert({
    where: { username },
    create: { username, passwordHash },
    update: { passwordHash },
  })
  console.log(`Usuario "${username}" listo (contraseña actualizada si ya existía).`)
}

async function seedInventarioStock() {
  await prisma.configuracion.upsert({
    where: { clave: GRANO_MINIMO_CLAVE },
    create: { clave: GRANO_MINIMO_CLAVE, valor: GRANO_MINIMO_DEFAULT_LB },
    update: {},
  })
  for (const material of ALL_MATERIALS) {
    const minimoLb = (RAW_MATERIALS as readonly string[]).includes(material) ? MATERIA_PRIMA_MINIMO_DEFAULT_LB : null
    await prisma.inventarioStock.upsert({
      where: { material },
      create: { material, cantidadLb: 0, minimoLb },
      update: {},
    })
  }
  console.log(`Inventario inicializado (${ALL_MATERIALS.length} materiales).`)
}

async function seedInventarioEmpaque() {
  for (const tipo of EMPAQUE_TYPES) {
    await prisma.inventarioEmpaqueStock.upsert({
      where: { tipo },
      create: { tipo, cantidad: 0 },
      update: {},
    })
  }
  console.log(`Inventario de empaque inicializado (${EMPAQUE_TYPES.length} tipos de bolsa).`)
}

async function main() {
  await seedUsuario()
  await seedInventarioStock()
  await seedInventarioEmpaque()
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
