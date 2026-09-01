import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Loader2, PawPrint, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, Input } from '@/shared/components/ui'
import { APP } from '@/app/env'
import { requireSupabase, HAS_SUPABASE } from '@/integrations/supabase'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [busy, setBusy] = useState(false)

  if (!HAS_SUPABASE) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream">
        <Card className="p-6 max-w-md text-center space-y-3">
          <PawPrint className="mx-auto text-vegetal" size={32} />
          <h2 className="text-md font-semibold text-ink">Modo local activo</h2>
          <p className="text-sm text-ink-soft">
            No hay Supabase configurado. La app funciona con localStorage del navegador.
            Para habilitar login y multi-tenant, define{' '}
            <code className="text-xs">VITE_SUPABASE_URL</code> y{' '}
            <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> en tu{' '}
            <code className="text-xs">.env</code>.
          </p>
        </Card>
      </div>
    )
  }

  const handleEmailPassword = async () => {
    setBusy(true)
    try {
      const sb = requireSupabase()
      if (mode === 'signup') {
        const { error } = await sb.auth.signUp({ email, password })
        if (error) throw error
        toast.success('Cuenta creada. Revisa tu correo si requiere confirmación.')
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  const handleMagicLink = async () => {
    setBusy(true)
    try {
      const sb = requireSupabase()
      const { error } = await sb.auth.signInWithOtp({ email })
      if (error) throw error
      toast.success('Te enviamos un enlace mágico a tu correo.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el enlace.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="rounded-sm bg-vegetal-soft text-vegetal p-2">
            <PawPrint size={20} />
          </span>
          <div>
            <h1 className="text-md font-semibold text-ink">{APP.productName}</h1>
            <p className="text-2xs text-ink-mute">Accede a tu cuenta</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-ink-soft">Correo</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1"
              autoComplete="email"
            />
          </label>

          {mode !== 'magic' && (
            <label className="block">
              <span className="text-sm text-ink-soft">Contraseña</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {mode === 'magic' ? (
            <Button variant="primary" size="md" onClick={handleMagicLink} disabled={busy || !email}>
              {busy ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
              Enviar enlace mágico
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleEmailPassword} disabled={busy || !email || !password}>
              {busy ? <Loader2 className="animate-spin" size={14} /> : <LogIn size={14} />}
              {mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
            </Button>
          )}

          <div className="flex items-center gap-2 text-xs text-ink-mute">
            <button
              type="button"
              className="hover:text-ink underline-offset-2 hover:underline"
              onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            >
              {mode === 'signup' ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
            </button>
            <span>·</span>
            <button
              type="button"
              className="hover:text-ink underline-offset-2 hover:underline"
              onClick={() => setMode('magic')}
            >
              Usar enlace mágico
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}