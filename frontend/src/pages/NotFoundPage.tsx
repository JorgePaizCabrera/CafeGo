import { Link } from 'react-router-dom'
import { Coffee, Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 p-6 text-center">
      <div className="mb-5 rounded-2xl bg-stone-900 p-4 text-white"><Coffee size={28} /></div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold text-stone-900">Página no encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">La página que buscas no existe o la dirección está mal escrita.</p>
      <Link to="/" className="btn-primary mt-6"><Home size={16} /> Volver al inicio</Link>
    </div>
  )
}
