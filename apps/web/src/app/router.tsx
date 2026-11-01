import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../routes/AppShell.tsx'
import { IndexPage } from '../routes/IndexPage.tsx'
import { LoginPage } from '../routes/LoginPage.tsx'
import { NotFoundPage } from '../routes/NotFoundPage.tsx'
import { PanelPage } from '../routes/PanelPage.tsx'
import { ProtectedRoute } from '../routes/ProtectedRoute.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <IndexPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: 'panel', element: <PanelPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
