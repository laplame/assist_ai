import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../app/sesion.ts'

export function AppShell() {
  const { sesion, salir } = useSesion()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="frame">
      <aside className="spine" aria-hidden="true">
        <span>BizneAI</span>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link to="/" className="brand">
            <strong>BizneAI</strong>
            <small>Asistencia y tiempo extra</small>
          </Link>
          <nav className="nav">
            {sesion ? (
              <>
                <NavLink to="/panel">Tablero</NavLink>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    salir()
                    void navigate('/')
                  }}
                >
                  Salir
                </button>
              </>
            ) : location.pathname === '/login' ? null : (
              <NavLink to="/login" className="button">
                Entrar
              </NavLink>
            )}
          </nav>
        </header>
        <main className="stage">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
