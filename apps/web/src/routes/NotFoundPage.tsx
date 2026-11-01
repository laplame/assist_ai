import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="missing">
      <h1>Esa página no está en el archivo</h1>
      <Link className="button" to="/">
        Volver al inicio
      </Link>
    </section>
  )
}
