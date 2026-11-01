import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { SesionProvider } from './app/SesionProvider.tsx'
import { router } from './app/router.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró #root')

createRoot(root).render(
  <StrictMode>
    <SesionProvider>
      <RouterProvider router={router} />
    </SesionProvider>
  </StrictMode>,
)
