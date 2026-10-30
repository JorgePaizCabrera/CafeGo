import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar, { NAV_SECTIONS } from './Sidebar'
import { MobileTabBar, MobileTopBar } from './MobileNav'

function useSectionTitle(): string {
  const { pathname } = useLocation()
  const items = NAV_SECTIONS.flatMap(s => s.items)
  const match = items
    .filter(i => i.to === '/' ? pathname === '/' : pathname === i.to || pathname.startsWith(`${i.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'Go Café'
}

export default function AdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const title = useSectionTitle()
  const { pathname } = useLocation()
  const enFormulario = /\/(nueva|nuevo|editar)$/.test(pathname)

  return (
    <div className="min-h-screen bg-stone-100">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="lg:pl-72">
        <MobileTopBar title={title} />
        <main className={`mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 ${enFormulario ? '' : 'pb-28 lg:pb-8'}`}><Outlet /></main>
      </div>
      {!enFormulario && <MobileTabBar onMore={() => setMobileNavOpen(true)} />}
    </div>
  )
}
