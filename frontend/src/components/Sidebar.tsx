import { Coffee, Download, LayoutDashboard, LogOut, ReceiptText, Users, Wallet, Warehouse } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '../store/authStore'
import { instalarApp, puedeInstalarse } from '../utils/instalarApp'

interface NavItem { to: string, label: string, icon: typeof Users }

export const NAV_SECTIONS: { title: string | null, items: NavItem[] }[] = [
  {
    title: null,
    items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard }],
  },
  {
    title: 'Operación',
    items: [
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/produccion', label: 'Producción', icon: Coffee },
      { to: '/inventario', label: 'Inventario', icon: Warehouse },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { to: '/facturacion', label: 'Cobros', icon: ReceiptText },
      { to: '/gastos', label: 'Gastos', icon: Wallet },
    ],
  },
]

export default function Sidebar({ open, onClose }: { open: boolean, onClose: () => void }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-stone-950/60 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-gradient-to-b from-[#2b1a10] via-[#1c120c] to-stone-950 text-white shadow-2xl shadow-black/40 transition-transform duration-200 lg:z-30 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />

        <Link to="/" onClick={onClose} className="relative flex justify-center px-6 pb-7 pt-[max(2rem,env(safe-area-inset-top))]" aria-label="Ir al inicio">
          <span className="rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-1 shadow-xl shadow-amber-950/60 transition hover:scale-[1.03]">
            <img src="/images/cafelogo.jpg" alt="Logo Go Café" className="h-32 w-32 rounded-full border-4 border-[#1c120c] bg-white object-cover" />
          </span>
        </Link>

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.title ?? 'inicio'}>
              {section.title && (
                <div className="mb-2 flex items-center gap-2 px-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-200/60">{section.title}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-amber-200/20 to-transparent" />
                </div>
              )}
              <div className="space-y-1.5">
                {section.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-lg shadow-amber-900/40'
                          : 'text-stone-300 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${isActive ? 'bg-stone-950/15' : 'bg-white/5 text-amber-200/80 group-hover:bg-white/10 group-hover:text-amber-200'}`}>
                          <Icon size={18} />
                        </span>
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {puedeInstalarse() && (
            <button
              type="button"
              onClick={() => { onClose(); void instalarApp() }}
              title="Instalar Go Café en este dispositivo"
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-white/5 hover:text-stone-300"
            >
              <Download size={14} /> App
            </button>
          )}
          <button onClick={handleLogout} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-stone-400 transition hover:bg-red-500/10 hover:text-red-300">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 transition group-hover:bg-red-500/15"><LogOut size={18} /></span>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
