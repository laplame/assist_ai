import { useState, type ReactNode } from 'react'
import { SesionContext, type Sesion } from './sesion.ts'

const clave = 'bizneai-sesion'

function leer(): Sesion | null {
  const crudo = sessionStorage.getItem(clave)
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as Sesion
  } catch {
    return null
  }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(leer)

  return (
    <SesionContext.Provider
      value={{
        sesion,
        entrar: (siguiente) => {
          sessionStorage.setItem(clave, JSON.stringify(siguiente))
          setSesion(siguiente)
        },
        salir: () => {
          sessionStorage.removeItem(clave)
          setSesion(null)
        },
      }}
    >
      {children}
    </SesionContext.Provider>
  )
}
