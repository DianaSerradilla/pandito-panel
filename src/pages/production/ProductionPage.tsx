import { Expenses } from './Expenses.tsx'
import { PrintRuns } from './PrintRuns.tsx'

export function ProductionPage() {
  return (
    <div className="space-y-10">
      <h1 className="sr-only">Tiradas y gastos</h1>
      <PrintRuns />
      <Expenses />
    </div>
  )
}
