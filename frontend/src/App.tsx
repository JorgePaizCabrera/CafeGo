import { Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import ClientesPage from './pages/ClientesPage'
import ClienteFormPage from './pages/ClienteFormPage'
import ClienteDetailPage from './pages/ClienteDetailPage'
import NuevaOrdenPage from './pages/NuevaOrdenPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProduccionPage from './pages/ProduccionPage'
import NuevaProduccionGourmetPage from './pages/NuevaProduccionGourmetPage'
import NuevaProduccionBlendPage from './pages/NuevaProduccionBlendPage'
import ProduccionDetailPage from './pages/ProduccionDetailPage'
import InventarioPage from './pages/InventarioPage'
import FacturacionPage from './pages/FacturacionPage'
import GastosPage from './pages/GastosPage'
import NotFoundPage from './pages/NotFoundPage'
import SeguimientoPage from './pages/SeguimientoPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/seguimiento/:token" element={<SeguimientoPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
          <Route path="/clientes/:clientId" element={<ClienteDetailPage />} />
          <Route path="/clientes/:clientId/editar" element={<ClienteFormPage />} />
          <Route path="/clientes/:clientId/ordenes/nueva" element={<NuevaOrdenPage />} />
          <Route path="/clientes/ordenes/:id" element={<OrderDetailPage />} />
          <Route path="/clientes/ordenes/:id/editar" element={<NuevaOrdenPage />} />
          <Route path="/produccion" element={<ProduccionPage />} />
          <Route path="/produccion/gourmet/nueva" element={<NuevaProduccionGourmetPage />} />
          <Route path="/produccion/gourmet/:id/editar" element={<NuevaProduccionGourmetPage />} />
          <Route path="/produccion/blend/nueva" element={<NuevaProduccionBlendPage />} />
          <Route path="/produccion/blend/:id/editar" element={<NuevaProduccionBlendPage />} />
          <Route path="/produccion/:id" element={<ProduccionDetailPage />} />
          <Route path="/inventario" element={<InventarioPage />} />
          <Route path="/facturacion" element={<FacturacionPage />} />
          <Route path="/gastos" element={<GastosPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
