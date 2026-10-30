import { jsPDF } from 'jspdf'
import { COFFEE_TYPE_LABELS, PACKAGE_TYPES, type Order } from '../types/order'
import { amountToWords } from './numberToWords'
import { formatQ } from './money'
import { todayISODate } from './dates'

const COMPANY_NAME = 'GO CAFÉ'
const COMPANY_ADDRESSES = [
  '5ta 1ra calle Zona Teculután, Zacapa',
  'Km 140.5 Plaza Stanzia, Estanzuela, Zacapa',
]
const COMPANY_SCHEDULE = ['Lunes a Domingo', '7:00 am – 8:00 pm']

const INK = { r: 32, g: 27, b: 23 }
const MUTED = { r: 123, g: 111, b: 97 }
const BRAND = { r: 143, g: 84, b: 37 }
const HEADER_BG = { r: 71, g: 42, b: 22 }
const BORDER = { r: 224, g: 210, b: 190 }
const CREAM = { r: 251, g: 245, b: 237 }

const MARGIN_LEFT = 15
const MARGIN_RIGHT = 195
const PAGE_WIDTH = 210

function formatDateDMY(value: string | null | undefined): string {
  if (!value) return '—'
  let date: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    date = new Date(y, m - 1, d)
  } else {
    date = new Date(value)
  }
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatMoney(value: number): string {
  return formatQ(value)
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'
}

function buildPackagingRows(order: Order): [string, string][] {
  const hasIncompleteBag = order.actualRemainderGrams > 0
  const rows: [string, string][] = []

  for (const type of PACKAGE_TYPES) {
    const qty = order.packageAllocation[type] || 0
    const isIncompleteHere = hasIncompleteBag && order.incompletePackageType === type
    if (qty <= 0 && !isIncompleteHere) continue

    const parts: string[] = []
    if (qty > 0) parts.push(`${qty} bolsa${qty === 1 ? '' : 's'} (${order.bagSizeGrams} g c/u)`)
    if (isIncompleteHere) parts.push(`1 bolsa (${order.actualRemainderGrams.toFixed(1)} g)`)

    rows.push([`Empaque: ${capitalize(type)}`, parts.join(' + ')])
  }

  return rows
}

async function loadLogoAsJpegDataUrl(url: string, size = 300): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No se pudo cargar el logo'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return null
  }
}

export async function generateInvoicePdf(order: Order): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const logoDataUrl = await loadLogoAsJpegDataUrl('/images/cafelogo.jpg')

  doc.setFillColor(HEADER_BG.r, HEADER_BG.g, HEADER_BG.b)
  doc.rect(0, 0, PAGE_WIDTH, 3, 'F')

  const logoSize = 28
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', MARGIN_LEFT, 11, logoSize, logoSize)
  }

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text(COMPANY_NAME, MARGIN_LEFT + logoSize + 7, 27)

  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('COMPROBANTE DE SERVICIO', MARGIN_RIGHT, 22, { align: 'right' })

  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.setLineWidth(0.4)
  doc.line(MARGIN_LEFT, 45, MARGIN_RIGHT, 45)

  doc.setFontSize(9)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont('helvetica', 'normal')
  COMPANY_ADDRESSES.forEach((line, i) => doc.text(line, MARGIN_LEFT, 51 + i * 4.5))

  doc.setFont('helvetica', 'bold')
  doc.text('Horario:', MARGIN_RIGHT, 51, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  COMPANY_SCHEDULE.forEach((line, i) => doc.text(line, MARGIN_RIGHT, 55.5 + i * 4.5, { align: 'right' }))

  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.line(MARGIN_LEFT, 67, MARGIN_RIGHT, 67)

  const infoRowY = 74
  const infoLineGap = 6.5
  doc.setFontSize(10)

  const labelValue = (label: string, value: string, x: number, y: number, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'bold')
    const labelText = `${label}:`
    if (align === 'left') {
      doc.text(labelText, x, y)
      const labelWidth = doc.getTextWidth(labelText)
      doc.setFont('helvetica', 'normal')
      doc.text(value, x + labelWidth + 1.5, y)
    } else {
      doc.setFont('helvetica', 'normal')
      const full = `${labelText} ${value}`
      doc.text(full, x, y, { align: 'right' })
    }
  }

  labelValue('Cliente', order.clientName || '—', MARGIN_LEFT, infoRowY)
  labelValue('Orden', order.orderNo, MARGIN_RIGHT, infoRowY, 'right')

  labelValue('Teléfono', order.phone || '—', MARGIN_LEFT, infoRowY + infoLineGap)
  labelValue('Fecha recibido', formatDateDMY(order.receivedDate), MARGIN_RIGHT, infoRowY + infoLineGap, 'right')

  labelValue('Ciudad', order.city || '—', MARGIN_LEFT, infoRowY + infoLineGap * 2)
  labelValue('Fecha de finalización', formatDateDMY(order.finalizedAt), MARGIN_RIGHT, infoRowY + infoLineGap * 2, 'right')

  const tableTop = infoRowY + infoLineGap * 2 + 10
  const rowHeight = 9
  const col1X = MARGIN_LEFT
  const col2X = MARGIN_LEFT + 65
  const tableWidth = MARGIN_RIGHT - MARGIN_LEFT

  doc.setFillColor(HEADER_BG.r, HEADER_BG.g, HEADER_BG.b)
  doc.rect(MARGIN_LEFT, tableTop, tableWidth, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONCEPTO', col1X + 3, tableTop + 5.5)
  doc.text('DETALLE', col2X + 3, tableTop + 5.5)

  const rows: [string, string][] = [
    ['Tipo de café', COFFEE_TYPE_LABELS[order.coffeeType]],
    ['Peso inicial', `${order.initialWeight.toFixed(2)} lb`],
    ['Peso final', `${order.finalWeight.toFixed(2)} lb`],
    ['Tipo de tueste', capitalize(order.roastType)],
    ['Tipo de molienda', capitalize(order.grindType)],
    ...buildPackagingRows(order),
  ]

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  let rowY = tableTop + 8
  rows.forEach(([label, value], i) => {
    if (i % 2 === 1) {
      doc.setFillColor(CREAM.r, CREAM.g, CREAM.b)
      doc.rect(MARGIN_LEFT, rowY, tableWidth, rowHeight, 'F')
    }
    doc.setTextColor(INK.r, INK.g, INK.b)
    doc.setFont('helvetica', 'bold')
    doc.text(label, col1X + 3, rowY + 6)
    doc.setFont('helvetica', 'normal')
    doc.text(value, col2X + 3, rowY + 6, { maxWidth: tableWidth - (col2X - col1X) - 6 })
    rowY += rowHeight
  })

  const totalBags = order.actualFullBags + (order.actualRemainderGrams > 0 ? 1 : 0)
  doc.setFillColor(CREAM.r, CREAM.g, CREAM.b)
  doc.rect(MARGIN_LEFT, rowY, tableWidth, rowHeight, 'F')
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_LEFT, rowY, MARGIN_RIGHT, rowY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text('Total bolsas', col1X + 3, rowY + 6)
  doc.text(`${totalBags}`, col2X + 3, rowY + 6)
  rowY += rowHeight

  const tableRowCount = rows.length + 1
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN_LEFT, tableTop, tableWidth, 8 + tableRowCount * rowHeight)
  doc.line(col2X, tableTop, col2X, tableTop + 8 + tableRowCount * rowHeight)

  const totalBoxY = rowY + 8
  const totalBoxHeight = 20
  doc.setFillColor(CREAM.r, CREAM.g, CREAM.b)
  doc.rect(MARGIN_LEFT, totalBoxY, tableWidth, totalBoxHeight, 'F')
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.rect(MARGIN_LEFT, totalBoxY, tableWidth, totalBoxHeight)

  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('TOTAL EN LETRAS:', MARGIN_LEFT + 4, totalBoxY + 7)
  doc.setFont('helvetica', 'normal')
  const wordsLines = doc.splitTextToSize(amountToWords(order.totalPrice), 110)
  doc.text(wordsLines, MARGIN_LEFT + 4, totalBoxY + 12.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL:', MARGIN_RIGHT - 55, totalBoxY + 11)
  doc.setTextColor(HEADER_BG.r, HEADER_BG.g, HEADER_BG.b)
  doc.setFontSize(14)
  doc.text(formatMoney(order.totalPrice), MARGIN_RIGHT - 4, totalBoxY + 11.5, { align: 'right' })

  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
  doc.line(MARGIN_LEFT, 256, MARGIN_RIGHT, 256)

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setFont('helvetica', 'bolditalic')
  doc.setFontSize(11)
  doc.text('¡Gracias por su preferencia!', PAGE_WIDTH / 2, 267, { align: 'center' })

  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Documento generado por el sistema de producción Go Café.', MARGIN_LEFT, 280)

  doc.setFillColor(HEADER_BG.r, HEADER_BG.g, HEADER_BG.b)
  doc.rect(0, 294, PAGE_WIDTH, 3, 'F')

  doc.save(`Comprobante_${order.orderNo}_${todayISODate()}.pdf`)
}
