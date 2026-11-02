import { createBrowserRouter, Navigate } from 'react-router'
import { AuthGate } from './components/AuthGate.tsx'
import { Layout } from './components/Layout.tsx'
import { ActivityPage } from './pages/activity/ActivityPage.tsx'
import { CatalogPage } from './pages/catalog/CatalogPage.tsx'
import { ProductPage } from './pages/catalog/ProductPage.tsx'
import { CollectionsPage } from './pages/collections/CollectionsPage.tsx'
import { HomePage } from './pages/home/HomePage.tsx'
import { EventsPage } from './pages/events/EventsPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { SalesPage } from './pages/sales/SalesPage.tsx'
import { PromotionsPage } from './pages/promos/PromotionsPage.tsx'
import { DownloadsPage } from './pages/downloads/DownloadsPage.tsx'
import { OrderPage } from './pages/orders/OrderPage.tsx'
import { PedidosPage } from './pages/pedidos/PedidosPage.tsx'
import { PricingPage } from './pages/pricing/PricingPage.tsx'

export const router = createBrowserRouter([
  { path: '/ingresar', element: <LoginPage /> },
  {
    element: <AuthGate />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'precios', element: <PricingPage /> },
          { path: 'catalogo', element: <CatalogPage /> },
          { path: 'catalogo/:productId', element: <ProductPage /> },
          { path: 'colecciones', element: <CollectionsPage /> },
          { path: 'ventas', element: <SalesPage /> },
          { path: 'promociones', element: <PromotionsPage /> },
          { path: 'descargas', element: <DownloadsPage /> },
          { path: 'eventos/:eventId?', element: <EventsPage /> },
          { path: 'actividad', element: <ActivityPage /> },
          { path: 'pedidos', element: <PedidosPage /> },
          { path: 'pedidos/solicitudes/:orderId', element: <OrderPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
