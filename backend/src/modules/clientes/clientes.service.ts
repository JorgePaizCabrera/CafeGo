import { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError, NotFoundError } from '../../errors'

export function listClientes() {
  return prisma.cliente.findMany({ orderBy: { updatedAt: 'desc' } })
}

export async function getClienteConOrdenes(id: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { ordenes: { orderBy: { createdAt: 'desc' }, include: { roasts: { orderBy: { seq: 'asc' } } } } },
  })
  if (!cliente) throw new NotFoundError('Cliente no encontrado.')
  return cliente
}

export function createCliente(input: { nombre: string; ciudad: string; telefono: string }) {
  return prisma.cliente.create({ data: input })
}

export async function updateCliente(id: string, patch: Partial<{ nombre: string; ciudad: string; telefono: string }>) {
  const exists = await prisma.cliente.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Cliente no encontrado.')
  return prisma.cliente.update({ where: { id }, data: patch })
}

export async function deleteCliente(id: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ordenes WHERE client_id = ${id} FOR UPDATE`)
    const exists = await tx.cliente.findUnique({ where: { id } })
    if (!exists) throw new NotFoundError('Cliente no encontrado.')
    const finalizadas = await tx.orden.count({ where: { clienteId: id, status: OrderStatus.Finalizado } })
    if (finalizadas > 0) {
      throw new AppError(
        `No se puede eliminar este cliente: tiene ${finalizadas} orden${finalizadas === 1 ? '' : 'es'} finalizada${finalizadas === 1 ? '' : 's'} con factura.`
      )
    }
    await tx.cliente.delete({ where: { id } })
  })
}
