import { useNavigate } from 'react-router-dom'
import { FileDown, FileSpreadsheet, ArrowRight, Send } from 'lucide-react'
import { Button, Card, MessagePreview } from '@/shared/components/ui'
import { DashboardPanel } from './DashboardPanel'
import { APP } from '@/app/env'

const DEMO_MESSAGE =
  'Hola María 👋\n\nNos encantaría ver a Rocko 🐾\n\nResponde para agendar.'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const STEPS = [
  {
    icon: FileDown,
    title: 'Exporta',
    text: 'Descarga de VetPraxis el reporte de eventos pendientes (formato Excel).',
  },
  {
    icon: FileSpreadsheet,
    title: 'Importa',
    text: 'Arrastra el archivo aquí. Revisamos teléfonos y categorías por ti.',
  },
  {
    icon: Send,
    title: 'Envía',
    text: 'Confirma y listo: cada cliente recibe su recordatorio por WhatsApp.',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-5xl mx-auto animate-rise">
      <p className="text-sm text-ink-mute">{greeting()} 👋</p>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mt-0.5">
        Los recordatorios de hoy, en WhatsApp
      </h1>

      {/* Hero: the outcome of the product, shown on landing */}
      <Card className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6 p-6 items-center">
        <div>
          <p className="text-sm text-ink-soft max-w-md leading-relaxed">
            Importa el reporte de VetPraxis, revisa a quién le escribirás y
            envía recordatorios a todos tus clientes en un par de minutos.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => navigate('/campaign')}>
              Nueva campaña
              <ArrowRight size={16} />
            </Button>
            <span className="text-xs text-ink-mute">
              Todo se revisa antes de enviar
            </span>
          </div>
        </div>
        <MessagePreview
          recipientName="María"
          message={DEMO_MESSAGE}
          caption={false}
        />
      </Card>

      {/* Campaign results: month, branches, trend */}
      <div className="mt-8">
        <DashboardPanel />
      </div>

      {/* The flow is a real sequence: numbered steps carry true order */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <Card key={title} className="p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="relative rounded-sm bg-vegetal-soft text-vegetal p-1.5">
                <Icon size={16} />
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-vegetal text-paper text-2xs tnum flex items-center justify-center font-medium">
                  {i + 1}
                </span>
              </span>
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed">{text}</p>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-2xs text-ink-mute text-center">
        {APP.productName} · recordatorios por WhatsApp para {APP.clinicName}
      </p>
    </div>
  )
}
