import { useLocation } from 'react-router-dom'
import { Stepper, type StepperStep } from '@/shared/components/ui/Stepper'
import { APP } from '@/app/env'

const steps: StepperStep[] = [
  { id: 'import', label: 'Importar' },
  { id: 'preview', label: 'Revisar' },
  { id: 'send', label: 'Enviar' },
]

export function TopBar() {
  const { pathname } = useLocation()
  const isCampaign = pathname.startsWith('/campaign')

  let stepIndex = -1
  if (pathname === '/campaign') stepIndex = 0
  else if (pathname === '/campaign/preview') stepIndex = 1
  else if (pathname === '/campaign/send') stepIndex = 2

  return (
    <header className="h-topbar shrink-0 border-b border-mist bg-paper flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <h1 className="text-md font-semibold leading-none">
          {isCampaign ? 'Nueva campaña' : APP.productName}
        </h1>
      </div>
      {isCampaign && stepIndex >= 0 && (
        <Stepper steps={steps} currentIndex={stepIndex} />
      )}
    </header>
  )
}