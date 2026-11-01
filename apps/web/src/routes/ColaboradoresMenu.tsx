import { useState } from 'react'
import { v1 } from '../lib/v1.ts'

export interface Colaborador {
  id: string
  nombre: string
  rol: string
  sucursal: string
  acuerdoVigente: boolean
}

const roles: Record<string, string> = {
  admin: 'Admin',
  coach: 'Coach',
  empleado: 'Colaborador',
  contador: 'Contador',
}

export function ColaboradoresMenu({ token, onElegir }: { token: string | null; onElegir: (colaborador: Colaborador) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [items, setItems] = useState<Colaborador[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)

  async function abrir() {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (!siguiente || items) return
    try {
      const data = await v1<{ items: Colaborador[] }>('/colaboradores', token)
      setItems(data.items)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el listado')
    }
  }

  return (
    <>
      <button
        type="button"
        className={abierto ? 'crew-tab crew-tab-open' : 'crew-tab'}
        aria-expanded={abierto}
        aria-controls="colaboradores"
        onClick={() => void abrir()}
      >
        Colaboradores
      </button>
      <aside id="colaboradores" className={abierto ? 'crew-panel open' : 'crew-panel'} aria-label="Otros colaboradores">
        <div className="crew-head">
          <h2>Otros colaboradores</h2>
          <button type="button" className="textish" onClick={() => setAbierto(false)}>
            Cerrar
          </button>
        </div>
        <p className="muted">Elige a alguien para usarlo en el salario pactado. No aparece quien inició sesión.</p>
        {error ? <p className="error">{error}</p> : null}
        {items?.length === 0 ? <p>No hay otros colaboradores activos.</p> : null}
        <ul className="crew-list">
          {items?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={elegido === item.id ? 'crew-person chosen' : 'crew-person'}
                onClick={() => {
                  setElegido(item.id)
                  onElegir(item)
                }}
              >
                <strong>{item.nombre}</strong>
                <span>
                  {roles[item.rol] ?? item.rol} · {item.sucursal}
                </span>
                <span>{item.acuerdoVigente ? 'Acuerdo vigente' : 'Sin acuerdo'}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
