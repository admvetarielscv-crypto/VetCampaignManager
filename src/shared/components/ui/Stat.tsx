import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'vegetal' | 'warn' | 'danger'
type Variant = 'card' | 'chip'

const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-mist-soft text-ink-soft',
  vegetal: 'bg-vegetal-soft text-vegetal',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}

const SIZE_CLS: Record<'sm' | 'md', { wrap: string; value: string }> = {
  sm: { wrap: 'p-3', value: 'text-xl' },
  md: { wrap: 'p-4', value: 'text-2xl' },
}

export interface StatProps {
  label: string
  value: number | string
  tone?: Tone
  variant?: Variant
  icon?: ReactNode
  mono?: boolean
  highlight?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  variant = 'card',
  icon,
  mono,
  highlight,
  size = 'md',
  className,
}: StatProps) {
  const toneCls = TONE_CLS[tone]

  if (variant === 'chip') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-mist px-2.5 py-1',
          toneCls,
          highlight && 'ring-1 ring-vegetal/30',
          className,
        )}
      >
        <span className="font-semibold tnum">{value}</span>
        {label}
      </span>
    )
  }

  const sz = SIZE_CLS[size]
  return (
    <div
      className={cn(
        'rounded-md bg-paper border border-mist flex flex-col gap-1',
        sz.wrap,
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-2xs uppercase tracking-wide rounded-sm w-fit px-1.5 py-0.5',
          toneCls,
        )}
      >
        {icon}
        {label}
      </span>
      <span
        className={cn(
          'font-semibold leading-none',
          sz.value,
          mono ? 'font-mono' : 'tnum',
        )}
      >
        {value}
      </span>
    </div>
  )
}
