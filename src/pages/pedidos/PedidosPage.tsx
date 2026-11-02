import { RequestsTab } from './RequestsTab.tsx'

/** Orders section: customer requests. Delivery is coordinated by WhatsApp for now. */
export function PedidosPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <RequestsTab />
    </div>
  )
}
