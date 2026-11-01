import { Link } from 'react-router-dom'

export function IndexPage() {
  return (
    <section>
      <p className="eyebrow">Kiosko de sucursal</p>
      <h1>La checada queda en el teléfono.</h1>
      <p className="lede">
        El tablero simula tiempo extra, guarda el salario pactado y ancla la raíz del día. La app del kiosko no muestra sueldos.
      </p>
      <div className="actions">
        <Link className="button" to="/login">
          Entrar al tablero
        </Link>
      </div>
    </section>
  )
}
