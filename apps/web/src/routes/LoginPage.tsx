import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../app/sesion.ts'
import { v1 } from '../lib/v1.ts'

export function LoginPage() {
  const { entrar } = useSesion()
  const navigate = useNavigate()
  const [telefono, setTelefono] = useState('5512345678')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviar(event: FormEvent) {
    event.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const data = await v1<{ token?: string; nombre?: string; rol?: string; ticket?: string }>('/auth/login', null, {
        telefono,
        codigo,
      })
      if (!data.token || !data.nombre || !data.rol) {
        setError('Esta cuenta tiene más de un negocio. Elige uno cuando exista esa pantalla.')
        return
      }
      entrar({ token: data.token, nombre: data.nombre, rol: data.rol })
      void navigate('/panel')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo entrar')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="auth-layout">
      <div>
        <p className="eyebrow">Acceso</p>
        <h1>Entra con tu teléfono.</h1>
        <p className="lede">El código de acceso es el adaptador de desarrollo. En producción se cambia por un OTP, sin reescribir el tablero.</p>
      </div>
      <form className="sheet form" onSubmit={(event) => void enviar(event)}>
        <label>
          Teléfono
          <input value={telefono} onChange={(event) => setTelefono(event.target.value)} inputMode="numeric" autoComplete="username" />
        </label>
        <label>
          Código
          <input value={codigo} onChange={(event) => setCodigo(event.target.value)} inputMode="numeric" autoComplete="one-time-code" />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="button" disabled={ocupado} type="submit">
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}
