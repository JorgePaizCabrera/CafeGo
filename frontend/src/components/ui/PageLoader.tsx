import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

export default function PageLoader() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="animate-fade-in flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center text-stone-500">
      <Loader2 size={28} className="animate-spin text-amber-600" />
      <p className="text-sm font-medium">Cargando…</p>
      {slow && (
        <div className="mt-2 max-w-sm">
          <p className="text-sm">Esto está tardando más de lo normal. Verifica que el servidor esté encendido y que haya conexión.</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => window.location.reload()}><RefreshCw size={16} /> Reintentar</button>
        </div>
      )}
    </div>
  )
}
