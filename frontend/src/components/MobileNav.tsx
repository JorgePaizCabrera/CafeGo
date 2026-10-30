import { Coffee, LayoutDashboard, Menu, Users, Warehouse } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/produccion', label: 'Producción', icon: Coffee },
  { to: '/inventario', label: 'Inventario', icon: Warehouse },
]

const RUTAS_EN_MAS = ['/facturacion', '/gastos']

export function MobileTopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-r from-[#2b1a10] via-[#1c120c] to-stone-950 pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-black/20 lg:hidden">
      <div className="flex h-16 items-center gap-3 px-4">
        <span className="rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-md shadow-black/40">
          <img src="/images/cafelogo.jpg" alt="Logo Go Café" className="h-11 w-11 rounded-full border-2 border-[#1c120c] bg-white object-cover" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/70">Go Café</p>
          <p className="truncate text-lg font-bold">{title}</p>
        </div>
      </div>
    </header>
  )
}

export function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { pathname } = useLocation()
  const masActivo = RUTAS_EN_MAS.some(r => pathname.startsWith(r))

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#1c120c]/95 pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="group flex flex-col items-center justify-center gap-0.5">
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-md shadow-amber-900/40' : 'text-stone-400 group-active:bg-white/10'}`}>
                  <Icon size={19} />
                </span>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-amber-300' : 'text-stone-400'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className="group flex flex-col items-center justify-center gap-0.5" aria-label="Más opciones">
          <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${masActivo ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-md shadow-amber-900/40' : 'text-stone-400 group-active:bg-white/10'}`}>
            <Menu size={19} />
          </span>
          <span className={`text-[11px] font-semibold ${masActivo ? 'text-amber-300' : 'text-stone-400'}`}>Más</span>
        </button>
      </div>
    </nav>
  )
}
