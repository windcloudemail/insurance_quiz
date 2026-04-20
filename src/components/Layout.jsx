import { Outlet, Link, useLocation } from 'react-router-dom'

export default function Layout() {
  const { pathname } = useLocation()
  const isAdmin = pathname === '/admin'

  return (
    <div className="min-h-screen bg-base">
      <nav className="bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-7 h-7 rounded-md bg-primary text-surface font-serif font-bold flex items-center justify-center text-[15px] leading-none">
              Q
            </span>
            <span className="font-serif font-semibold text-ink text-lg tracking-tight group-hover:text-primary transition-colors">
              題庫
            </span>
          </Link>
          <Link
            to="/admin"
            className={`text-sm px-3 py-1.5 rounded-md font-medium transition-all ${isAdmin
              ? 'text-primary bg-primary/10'
              : 'text-ink-soft hover:text-ink hover:bg-card'
              }`}
          >
            題庫管理
          </Link>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
