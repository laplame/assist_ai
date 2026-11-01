import { createContext, useContext } from 'react'

export interface Sesion {
  token: string
  nombre: string
  rol: string
}

export const SesionContext = createContext<{
  sesion: Sesion | null
  entrar: (sesion: Sesion) => void
  salir: () => void
} | null>(null)

export function useSesion() {
  const value = useContext(SesionContext)
  if (!value) throw new Error('Sesión fuera del proveedor')
  return value
}
