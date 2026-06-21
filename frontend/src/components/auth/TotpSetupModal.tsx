'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ShieldCheck, Copy, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authService } from '@/services/auth'
import { User } from '@/types'

// QRCode only runs on client (canvas)
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false })

interface Props {
  onSuccess: (updatedUser: User) => void
  onClose: () => void
}

type Step = 'scan' | 'confirm'

export default function TotpSetupModal({ onSuccess, onClose }: Props) {
  const [step, setStep] = useState<Step>('scan')
  const [uri, setUri] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    authService
      .setupTotp()
      .then(({ secret, uri }) => { setSecret(secret); setUri(uri) })
      .catch(() => setError('Erro ao iniciar configuração'))
      .finally(() => setLoading(false))
  }, [])

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirm = async () => {
    if (code.replace(/\D/g, '').length < 6) return setError('Digite o código de 6 dígitos')
    setConfirming(true)
    setError('')
    try {
      const updated = await authService.enableTotp(code.replace(/\D/g, ''))
      onSuccess(updated)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Código inválido. Tente novamente.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Configurar autenticação em 2 etapas">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : step === 'scan' ? (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Escaneie o QR code com seu aplicativo autenticador (Google Authenticator, Authy, 1Password, etc.).
          </p>

          <div className="flex justify-center py-2">
            {uri && <QRCodeSVG value={uri} size={200} level="M" />}
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Ou insira a chave manualmente:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-gray-700 break-all">{secret}</code>
              <button
                onClick={copySecret}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                title="Copiar"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Após adicionar a conta no aplicativo, clique em <strong>Continuar</strong> para confirmar.
          </p>

          <div className="flex gap-3">
            <Button onClick={() => setStep('confirm')} className="flex-1">Continuar</Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <ShieldCheck className="w-10 h-10 text-green-500" />
            <p className="text-sm text-gray-600 text-center">
              Insira o código de 6 dígitos gerado pelo seu aplicativo para confirmar a configuração.
            </p>
          </div>

          <Input
            label="Código de verificação"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className="text-center text-2xl tracking-widest font-mono"
          />

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <div className="flex gap-3">
            <Button onClick={confirm} loading={confirming} disabled={code.length < 6} className="flex-1">
              Ativar 2FA
            </Button>
            <Button variant="outline" onClick={() => setStep('scan')}>Voltar</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
