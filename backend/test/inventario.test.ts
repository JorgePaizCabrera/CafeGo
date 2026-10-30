import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, createAdminAndLogin, authHeader } from './helpers/testApp'

let token: string

beforeEach(async () => {
  await resetDb()
  token = await createAdminAndLogin()
})
afterAll(disconnectDb)

describe('GET /api/inventario/stock', () => {
  it('devuelve los 8 materiales en 0 aunque no haya filas todavía (base recién migrada)', async () => {
    const res = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(8)
    expect(res.body.every((s: any) => s.cantidadLb === 0)).toBe(true)
  })
})

describe('POST /api/inventario/materia-prima/:material/entrada', () => {
  it('suma al stock y registra un movimiento de entrada', async () => {
    const res = await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 60, motivo: 'Compra inicial' })
    expect(res.status).toBe(204)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'pergamino').cantidadLb).toBe(60)

    const movimientos = await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'pergamino' })
    expect(movimientos.body).toHaveLength(1)
    expect(movimientos.body[0].tipo).toBe('entrada')
    expect(movimientos.body[0].motivo).toBe('Compra inicial')
  })

  it('rechaza cantidades <= 0', async () => {
    const res = await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 0 })
    expect(res.status).toBe(400)
  })

  it('rechaza un material que no es materia prima', async () => {
    const res = await request(app).post('/api/inventario/materia-prima/blend_bolsas/entrada').set(authHeader(token)).send({ cantidadLb: 10 })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/inventario/materia-prima/:material/salida', () => {
  it('resta del stock y agrega un único movimiento de salida (no reescribe el historial)', async () => {
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 105 })

    const res = await request(app).post('/api/inventario/materia-prima/pergamino/salida').set(authHeader(token)).send({ cantidadLb: 5, motivo: 'Corrección de captura' })
    expect(res.status).toBe(204)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'pergamino').cantidadLb).toBe(100)

    const movimientos = await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'pergamino' })
    expect(movimientos.body).toHaveLength(2)
    expect(movimientos.body[0].tipo).toBe('salida')
    expect(movimientos.body[0].motivo).toBe('Corrección de captura')
  })

  it('rechaza restar más de lo disponible', async () => {
    const res = await request(app).post('/api/inventario/materia-prima/pergamino/salida').set(authHeader(token)).send({ cantidadLb: 999 })
    expect(res.status).toBe(400)
  })

  it('rechaza cantidades <= 0', async () => {
    const res = await request(app).post('/api/inventario/materia-prima/pergamino/salida').set(authHeader(token)).send({ cantidadLb: 0 })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/inventario/materia-prima/:material/umbral', () => {
  it('actualiza el mínimo y dispara/quita la alerta según corresponda', async () => {
    await request(app).patch('/api/inventario/materia-prima/pergamino/umbral').set(authHeader(token)).send({ minimoLb: 50 })
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 10 })

    const conAlerta = await request(app).get('/api/inventario/alertas').set(authHeader(token))
    expect(conAlerta.body.some((a: any) => a.material === 'pergamino')).toBe(true)

    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 100 })
    const sinAlerta = await request(app).get('/api/inventario/alertas').set(authHeader(token))
    expect(sinAlerta.body.some((a: any) => a.material === 'pergamino')).toBe(false)
  })
})

describe('alerta de café en grano (una sola, sobre el total de los tueste)', () => {
  const alertaGrano = async () => {
    const res = await request(app).get('/api/inventario/alertas').set(authHeader(token))
    return res.body.filter((a: any) => a.material === 'grano_cafeteria')
  }

  it('no alerta aunque un tueste esté en 0, si el total supera el mínimo (5 lb por defecto)', async () => {
    await prisma.inventarioStock.createMany({ data: [{ material: 'grano_claro', cantidadLb: 10 }, { material: 'grano_medio', cantidadLb: 4 }] })
    expect(await alertaGrano()).toHaveLength(0)
  })

  it('una sola alerta cuando el total baja del mínimo', async () => {
    await prisma.inventarioStock.createMany({ data: [{ material: 'grano_claro', cantidadLb: 2 }, { material: 'grano_medio', cantidadLb: 1.5 }] })
    expect(await alertaGrano()).toHaveLength(1)
  })

  it('el mínimo se puede cambiar', async () => {
    await prisma.inventarioStock.create({ data: { material: 'grano_claro', cantidadLb: 8 } })
    const res = await request(app).patch('/api/inventario/grano-cafeteria/umbral').set(authHeader(token)).send({ minimoLb: 10 })
    expect(res.status).toBe(204)

    const umbral = await request(app).get('/api/inventario/grano-cafeteria/umbral').set(authHeader(token))
    expect(umbral.body.minimoLb).toBe(10)
    expect(await alertaGrano()).toHaveLength(1)
  })
})

describe('salidas de producto terminado / grano reservado', () => {
  it('descuenta grano de cafetería reservado y falla si no alcanza', async () => {
    await prisma.inventarioStock.create({ data: { material: 'grano_medio', cantidadLb: 5 } })

    const ok = await request(app).post('/api/inventario/grano-cafeteria/medio/salida').set(authHeader(token)).send({ cantidadLb: 3, motivo: 'Venta cafetería' })
    expect(ok.status).toBe(204)

    const excede = await request(app).post('/api/inventario/grano-cafeteria/medio/salida').set(authHeader(token)).send({ cantidadLb: 10, motivo: 'Venta cafetería' })
    expect(excede.status).toBe(400)
  })

  it('envía bolsas de Gourmet por tipo y falla si no hay suficientes de ese tipo', async () => {
    await prisma.inventarioStock.create({ data: { material: 'gourmet', cantidadLb: (10 * 350) / 453.59237 } })
    await prisma.inventarioProductoEmpacado.createMany({ data: [{ tipoBolsa: 'comercial', bolsas: 6 }, { tipoBolsa: 'especial', bolsas: 4 }] })

    const excede = await request(app).post('/api/inventario/gourmet/salida').set(authHeader(token)).send({ tipoBolsa: 'especial', bolsas: 5, motivo: 'Venta' })
    expect(excede.status).toBe(400)

    const ok = await request(app).post('/api/inventario/gourmet/salida').set(authHeader(token)).send({ tipoBolsa: 'comercial', bolsas: 2, motivo: 'Venta' })
    expect(ok.status).toBe(204)

    const empacado = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(empacado.body.comercial).toBe(4)
    expect(empacado.body.especial).toBe(4)
    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'gourmet').cantidadLb).toBeCloseTo((8 * 350) / 453.59237, 1)
  })

  it('empacar sobrante: el café suelto pasa a bolsa llena y descuenta la bolsa vacía, sin cambiar las libras', async () => {
    const totalLb = (2 * 350 + 400) / 453.59237
    await prisma.inventarioStock.create({ data: { material: 'gourmet', cantidadLb: totalLb } })
    await prisma.inventarioProductoEmpacado.create({ data: { tipoBolsa: 'comercial', bolsas: 2 } })
    await prisma.inventarioEmpaqueStock.create({ data: { tipo: 'especial', cantidad: 3 } })

    const excede = await request(app).post('/api/inventario/gourmet/empacar-sobrante').set(authHeader(token)).send({ tipoBolsa: 'especial', bolsas: 2 })
    expect(excede.status).toBe(400)

    const ok = await request(app).post('/api/inventario/gourmet/empacar-sobrante').set(authHeader(token)).send({ tipoBolsa: 'especial', bolsas: 1 })
    expect(ok.status).toBe(204)

    const empacado = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(empacado.body.comercial).toBe(2)
    expect(empacado.body.especial).toBe(1)
    expect(Math.abs(empacado.body.sueltoGramos - 50)).toBeLessThan(3)

    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    expect(empaque.body.find((s: any) => s.tipo === 'especial').cantidad).toBe(2)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'gourmet').cantidadLb).toBeCloseTo(totalLb, 2)
  })

  it('envía bolsas de blend por unidad completa, no por libras sueltas', async () => {
    await prisma.inventarioStock.create({ data: { material: 'blend_bolsas', cantidadLb: (10 * 350) / 453.59237 } })
    await prisma.inventarioProductoEmpacado.create({ data: { tipoBolsa: 'blend', bolsas: 10 } })

    const excede = await request(app).post('/api/inventario/blend/salida').set(authHeader(token)).send({ bolsas: 11, motivo: 'Venta' })
    expect(excede.status).toBe(400)

    const ok = await request(app).post('/api/inventario/blend/salida').set(authHeader(token)).send({ bolsas: 4, motivo: 'Venta' })
    expect(ok.status).toBe(204)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const restante = stock.body.find((s: any) => s.material === 'blend_bolsas').cantidadLb
    expect(restante).toBeCloseTo((6 * 350) / 453.59237, 2)
  })
})

describe('inventario de empaque (bolsas)', () => {
  it('devuelve los 9 tipos en 0 aunque no haya filas todavía', async () => {
    const res = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(9)
    expect(res.body.every((s: any) => s.cantidad === 0)).toBe(true)
  })

  it('entrada suma al stock y registra el movimiento', async () => {
    const res = await request(app).post('/api/inventario/empaque/transparente/entrada').set(authHeader(token)).send({ cantidad: 100, motivo: 'Compra a proveedor' })
    expect(res.status).toBe(204)

    const stock = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.tipo === 'transparente').cantidad).toBe(100)

    const movimientos = await request(app).get('/api/inventario/empaque/movimientos').set(authHeader(token)).query({ tipo: 'transparente' })
    expect(movimientos.body).toHaveLength(1)
    expect(movimientos.body[0].tipo).toBe('entrada')
  })

  it('rechaza un tipo de empaque inválido', async () => {
    const res = await request(app).post('/api/inventario/empaque/no-existe/entrada').set(authHeader(token)).send({ cantidad: 10 })
    expect(res.status).toBe(400)
  })

  it('salida rechaza restar más de lo disponible', async () => {
    await request(app).post('/api/inventario/empaque/comercial/entrada').set(authHeader(token)).send({ cantidad: 5 })
    const res = await request(app).post('/api/inventario/empaque/comercial/salida').set(authHeader(token)).send({ cantidad: 10 })
    expect(res.status).toBe(400)
  })

  it('umbral dispara/quita la alerta según corresponda', async () => {
    const tipo = encodeURIComponent('kraft con válvula')
    await request(app).patch(`/api/inventario/empaque/${tipo}/umbral`).set(authHeader(token)).send({ minimo: 10 })

    const conAlerta = await request(app).get('/api/inventario/empaque/alertas').set(authHeader(token))
    expect(conAlerta.body.some((a: any) => a.tipo === 'kraft con válvula')).toBe(true)

    await request(app).post(`/api/inventario/empaque/${tipo}/entrada`).set(authHeader(token)).send({ cantidad: 50 })
    const sinAlerta = await request(app).get('/api/inventario/empaque/alertas').set(authHeader(token))
    expect(sinAlerta.body.some((a: any) => a.tipo === 'kraft con válvula')).toBe(false)
  })
})

describe('control de gastos (costo de las compras)', () => {
  const mes = { desde: '2000-01-01T00:00:00.000Z', hasta: '2100-01-01T00:00:00.000Z' }

  it('guarda el costo total de la entrada y lo devuelve en el historial', async () => {
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 100, costoTotal: 1500 })
    await request(app).post('/api/inventario/empaque/comercial/entrada').set(authHeader(token)).send({ cantidad: 200, costoTotal: 300 })

    const mov = await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'pergamino' })
    expect(Number(mov.body[0].costoTotal)).toBe(1500)
    const movEmp = await request(app).get('/api/inventario/empaque/movimientos').set(authHeader(token)).query({ tipo: 'comercial' })
    expect(Number(movEmp.body[0].costoTotal)).toBe(300)
  })

  it('rechaza un costo negativo y permite entradas sin costo', async () => {
    const neg = await request(app).post('/api/inventario/materia-prima/oro/entrada').set(authHeader(token)).send({ cantidadLb: 10, costoTotal: -5 })
    expect(neg.status).toBe(400)
    const sinCosto = await request(app).post('/api/inventario/materia-prima/oro/entrada').set(authHeader(token)).send({ cantidadLb: 10 })
    expect(sinCosto.status).toBe(204)
  })

  it('suma los gastos del periodo por material y por bolsa, con precio promedio', async () => {
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 100, costoTotal: 1500 })
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 50, costoTotal: 800 })
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 20 })
    await request(app).post('/api/inventario/empaque/especial/entrada').set(authHeader(token)).send({ cantidad: 100, costoTotal: 250 })

    const res = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query(mes)
    expect(res.status).toBe(200)
    const perg = res.body.items.find((i: any) => i.clave === 'pergamino')
    expect(perg.costoTotal).toBe(2300)
    expect(perg.cantidad).toBe(170)
    expect(perg.entradasSinCosto).toBe(1)
    expect(perg.precioPromedio).toBe(15.33) // 2300 / 150 lb con costo
    expect(res.body.totalMateriaPrima).toBe(2300)
    expect(res.body.totalEmpaque).toBe(250)
    expect(res.body.total).toBe(2550)
  })

  it('no cuenta salidas ni fechas fuera del rango', async () => {
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 100, costoTotal: 1500 })
    await request(app).post('/api/inventario/materia-prima/pergamino/salida').set(authHeader(token)).send({ cantidadLb: 10 })
    const fuera = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query({ desde: '2000-01-01', hasta: '2000-02-01' })
    expect(fuera.body.total).toBe(0)
    const dentro = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query(mes)
    expect(dentro.body.items).toHaveLength(1)
    expect(dentro.body.items[0].cantidad).toBe(100)
  })

  it('rechaza fechas inválidas', async () => {
    const res = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query({ desde: 'x', hasta: '2026-01-01' })
    expect(res.status).toBe(400)
  })
})

describe('corrección del costo de una compra', () => {
  const mes = { desde: '2000-01-01T00:00:00.000Z', hasta: '2100-01-01T00:00:00.000Z' }

  it('corrige el costo de una entrada de materia prima, marca la fecha y no toca el stock', async () => {
    await request(app).post('/api/inventario/materia-prima/pergamino/entrada').set(authHeader(token)).send({ cantidadLb: 100, costoTotal: 15000 })
    const [mov] = (await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'pergamino' })).body

    const res = await request(app).patch(`/api/inventario/movimientos/${mov.id}/costo`).set(authHeader(token)).send({ costoTotal: 1500 })
    expect(res.status).toBe(204)

    const [corregido] = (await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'pergamino' })).body
    expect(Number(corregido.costoTotal)).toBe(1500)
    expect(corregido.costoCorregidoAt).not.toBeNull()
    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'pergamino').cantidadLb).toBe(100)
    const gastos = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query(mes)
    expect(gastos.body.total).toBe(1500)
  })

  it('permite quitar el costo (null) y corregir el de bolsas', async () => {
    await request(app).post('/api/inventario/empaque/comercial/entrada').set(authHeader(token)).send({ cantidad: 100, costoTotal: 300 })
    const [mov] = (await request(app).get('/api/inventario/empaque/movimientos').set(authHeader(token))).body

    expect((await request(app).patch(`/api/inventario/empaque/movimientos/${mov.id}/costo`).set(authHeader(token)).send({ costoTotal: null })).status).toBe(204)
    const gastos = await request(app).get('/api/inventario/gastos').set(authHeader(token)).query(mes)
    expect(gastos.body.total).toBe(0)
    expect(gastos.body.entradasSinCosto).toBe(1)
  })

  it('no permite poner costo a una salida, ni costos negativos, y responde 404 si no existe', async () => {
    await request(app).post('/api/inventario/materia-prima/oro/entrada').set(authHeader(token)).send({ cantidadLb: 50 })
    await request(app).post('/api/inventario/materia-prima/oro/salida').set(authHeader(token)).send({ cantidadLb: 5 })
    const movs = (await request(app).get('/api/inventario/movimientos').set(authHeader(token)).query({ material: 'oro' })).body
    const salida = movs.find((m: any) => m.tipo === 'salida')
    const entrada = movs.find((m: any) => m.tipo === 'entrada')

    expect((await request(app).patch(`/api/inventario/movimientos/${salida.id}/costo`).set(authHeader(token)).send({ costoTotal: 10 })).status).toBe(400)
    expect((await request(app).patch(`/api/inventario/movimientos/${entrada.id}/costo`).set(authHeader(token)).send({ costoTotal: -1 })).status).toBe(400)
    expect((await request(app).patch('/api/inventario/movimientos/00000000-0000-0000-0000-000000000000/costo').set(authHeader(token)).send({ costoTotal: 10 })).status).toBe(404)
  })
})
