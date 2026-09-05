import { cn } from '@/lib/cn'

export interface StepperStep {
  id: string
  label: string
}

export interface StepperProps {
  steps: StepperStep[]
  currentIndex: number
  className?: string
}

export function Stepper({ steps, currentIndex, className }: StepperProps) {
  return (
    <nav className={cn('flex items-center', className)} aria-label="Pasos">
      {steps.map((step, i) => {
        const state =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo'
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    state === 'done' && 'bg-vegetal text-paper',
                    state === 'current' &&
                      'bg-vegetal-soft text-vegetal border border-vegetal/30',
                    state === 'todo' && 'bg-mist-soft text-ink-mute border border-mist',
                  )}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'text-xs',
                  state === 'todo' ? 'text-ink-mute' : 'text-ink',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'mx-3 h-px w-8 transition-colors',
                  i < currentIndex ? 'bg-vegetal' : 'bg-mist',
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}