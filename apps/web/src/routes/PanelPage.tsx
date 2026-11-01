import { useState, type FormEvent } from 'react'
import { useSesion } from '../app/sesion.ts'
import { v1 } from '../lib/v1.ts'
import { ColaboradoresMenu, type Colaborador } from './ColaboradoresMenu.tsx'

interface Simulacion {
  valorHora: number
  clasificacion: { doblesMilesimas: number; triplesMilesimas: number; excedeHorasDia: boolean; excedeDiasConExtra: boolean }
  pago: { dobles: number; triples: number; total: number; exento: number; gravado: number }
  imss: { conservador: number; alterno: number; diferencia: number; criterio: string }
  isr: { code: string; mensaje: string }
  semaforo: 'verde' | 'ambar' | 'rojo'
  aviso: string
}

interface Lote {
  fecha: string
  raiz: string
  nHojas: number
  anclaje: string
}

interface Sucursal {
  _id: string
  nombre: string
}

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function PanelPage() {
  const { sesion } = useSesion()
  const token = sesion?.token ?? null
  const [horas, setHoras] = useState('9,8,8,8,8,0,0')
  const [salario, setSalario] = useState('400')
  const [jornada, setJornada] = useState<'diurna' | 'nocturna' | 'mixta'>('diurna')
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null)
  const [membresiaId, setMembresiaId] = useState('mem-ana')
  const [colaboradorNombre, setColaboradorNombre] = useState<string | null>(null)
  const [pactado, setPactado] = useState('400')
  const [aceptado, setAceptado] = useState(false)
  const [salarioMsg, setSalarioMsg] = useState<string | null>(null)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [codigo, setCodigo] = useState<string | null>(null)
  const [lotes, setLotes] = useState<Lote[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  function elegir(colaborador: Colaborador) {
    setMembresiaId(colaborador.id)
    setColaboradorNombre(colaborador.nombre)
  }

  async function simular(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const horasPorDia = horas.split(',').map((item) => Number(item.trim()))
    setSimulacion(
      await v1<Simulacion>('/nomina/simular', token, {
        horasPorDia,
        salarioDiario: Number(salario),
        tipoJornada: jornada,
      }),
    )
  }

  async function guardarSalario(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSalarioMsg(null)
    if (!aceptado) {
      setSalarioMsg('El colaborador tiene que aceptar el acuerdo.')
      return
    }
    const data = await v1<{ salarioDiario: number; zona: string }>('/salarios/pactado', token, {
      membresiaId,
      salarioDiario: Number(pactado),
      jornadaHorasBase: 8,
      aceptadoPorColaborador: true,
    })
    setSalarioMsg(`Quedó en ${pesos.format(data.salarioDiario)} diarios, zona ${data.zona}.`)
  }

  async function cargarSucursales() {
    const data = await v1<{ items: Sucursal[] }>('/sucursales', token)
    setSucursales(data.items)
  }

  async function generarCodigo(sucursalId: string) {
    const data = await v1<{ codigo: string }>(`/sucursales/${sucursalId}/codigos-kiosko`, token, {})
    setCodigo(data.codigo)
  }

  async function anclar(event: FormEvent) {
    event.preventDefault()
    setError(null)
    await v1('/integridad/lotes', token, { fecha })
    const data = await v1<{ items: Lote[] }>('/integridad/lotes', token)
    setLotes(data.items)
  }

  return (
    <section>
      <p className="eyebrow">Nómina y asistencia</p>
      <h1>Tablero de {sesion?.nombre}.</h1>
      <p className="lede">
        Simula tiempo extra, pacta el salario por encima del mínimo y ancla la raíz del día. El ISR no se calcula si falta la tarifa.
      </p>
      {error ? <p className="error">{error}</p> : null}

      <form className="sheet form" onSubmit={(event) => void simular(event).catch((reason) => setError(mensaje(reason)))}>
        <h2>Tiempo extra</h2>
        <label>
          Horas por día, separadas por coma
          <input value={horas} onChange={(event) => setHoras(event.target.value)} />
        </label>
        <label>
          Salario diario
          <input value={salario} onChange={(event) => setSalario(event.target.value)} inputMode="decimal" />
        </label>
        <label>
          Jornada
          <select value={jornada} onChange={(event) => setJornada(event.target.value as typeof jornada)}>
            <option value="diurna">Diurna</option>
            <option value="nocturna">Nocturna</option>
            <option value="mixta">Mixta</option>
          </select>
        </label>
        <button className="button" type="submit">Simular</button>
        {simulacion ? (
          <div>
            <p className={`luz ${simulacion.semaforo}`}>Semáforo {simulacion.semaforo}</p>
            <p>Hora {pesos.format(simulacion.valorHora)} · Dobles {pesos.format(simulacion.pago.dobles)} · Triples {pesos.format(simulacion.pago.triples)}</p>
            <p>Exento {pesos.format(simulacion.pago.exento)} · Gravado {pesos.format(simulacion.pago.gravado)} · Total {pesos.format(simulacion.pago.total)}</p>
            <p>IMSS a integrar, conservador {pesos.format(simulacion.imss.conservador)}, alterno {pesos.format(simulacion.imss.alterno)}. Diferencia {pesos.format(simulacion.imss.diferencia)}.</p>
            <p>{simulacion.imss.criterio}</p>
            <p>ISR: {simulacion.isr.mensaje}</p>
            <p className="muted">{simulacion.aviso}</p>
          </div>
        ) : null}
      </form>

      <form className="sheet form" onSubmit={(event) => void guardarSalario(event).catch((reason) => setError(mensaje(reason)))}>
        <h2>Salario pactado</h2>
        <label>
          Membresía{colaboradorNombre ? ` · ${colaboradorNombre}` : ''}
          <input value={membresiaId} onChange={(event) => setMembresiaId(event.target.value)} />
        </label>
        <label>
          Salario diario
          <input value={pactado} onChange={(event) => setPactado(event.target.value)} inputMode="decimal" />
        </label>
        <label className="check">
          <input type="checkbox" checked={aceptado} onChange={(event) => setAceptado(event.target.checked)} />
          El colaborador aceptó este acuerdo
        </label>
        <button className="button" type="submit">Guardar</button>
        {salarioMsg ? <p>{salarioMsg}</p> : null}
      </form>

      <section className="sheet form">
        <h2>Kiosko</h2>
        <button className="ghost" type="button" onClick={() => void cargarSucursales().catch((reason) => setError(mensaje(reason)))}>
          Ver sucursales
        </button>
        {sucursales.map((sucursal) => (
          <button className="button" type="button" key={sucursal._id} onClick={() => void generarCodigo(sucursal._id).catch((reason) => setError(mensaje(reason)))}>
            Código para {sucursal.nombre}
          </button>
        ))}
        {codigo ? <p>Código de un solo uso, 15 minutos: <strong>{codigo}</strong></p> : null}
      </section>

      <form className="sheet form" onSubmit={(event) => void anclar(event).catch((reason) => setError(mensaje(reason)))}>
        <h2>Integridad</h2>
        <label>
          Fecha
          <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </label>
        <button className="button" type="submit">Anclar raíz local</button>
        <p className="muted">El sello por correo o OpenTimestamps es un puerto pendiente. Aquí solo se guarda la raíz.</p>
        {lotes.map((lote) => (
          <p key={lote.raiz}>
            {lote.fecha} · {lote.nHojas} hojas · {lote.anclaje}
            <br />
            <code>{lote.raiz}</code>
          </p>
        ))}
      </form>
      <ColaboradoresMenu token={token} onElegir={elegir} />
    </section>
  )
}

function mensaje(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'No se pudo completar'
}
