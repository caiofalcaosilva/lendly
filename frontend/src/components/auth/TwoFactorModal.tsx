'use client'
import { useState, useRef, useEffect } from 'react'
import { ShieldCheck, Smartphone } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  tempToken: string
  onSuccess: () => void
  onClose: () => void
}

export default function TwoFactorModal({ tempToken, onSuccess, onClose }: Props) {
  const { completeTwoFactor } = useAuth()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [trustDevice, setTrustDevice] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputs.current[0]?.focus()
  }, [])

  const handleChange = (i: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      inputs.current[5]?.focus()
    }
  }

  const submit = async () => {
    const code = digits.join('')
    if (code.length < 6) return setError('Digite os 6 dígitos')
    setLoading(true)
    setError('')
    try {
      await completeTwoFactor(tempToken, code, trustDevice)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Código inválido')
      setDigits(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Verificação em duas etapas">
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-green-600" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Abra seu aplicativo autenticador e insira o código de 6 dígitos.
            </p>
            <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
              <Smartphone className="w-3 h-3" /> Google Authenticator, Authy, etc.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-lg outline-none transition-colors
                ${d ? 'border-green-500 bg-green-50' : 'border-gray-200'}
                focus:border-green-500`}
            />
          ))}
        </div>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="w-4 h-4 text-green-600 rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Confiar neste dispositivo por 30 dias</span>
        </label>

        <div className="flex gap-3">
          <Button
            onClick={submit}
            loading={loading}
            disabled={digits.join('').length < 6}
            className="flex-1"
          >
            Verificar
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
