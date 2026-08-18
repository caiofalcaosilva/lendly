'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface CodeInputHandle {
  reset: () => void
}

interface Props {
  length?: number
  onChange: (code: string) => void
  autoFocus?: boolean
}

/** A code entered one digit per box (bank-app style) — extracted from
 * TwoFactorModal, which was the only place this existed before. Owns its
 * own digit state and reports the joined code back via onChange; call
 * ref.current?.reset() to clear and refocus after a wrong-code error. */
const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput(
  { length = 6, onChange, autoFocus = true },
  ref
) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''))
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus()
  }, [autoFocus])

  useImperativeHandle(ref, () => ({
    reset: () => {
      setDigits(Array(length).fill(''))
      onChange('')
      inputs.current[0]?.focus()
    },
  }))

  const update = (next: string[]) => {
    setDigits(next)
    onChange(next.join(''))
  }

  const handleChange = (i: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = clean
    update(next)
    if (clean && i < length - 1) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (text.length === length) {
      update(text.split(''))
      inputs.current[length - 1]?.focus()
    }
  }

  return (
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
          className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-control outline-none transition-colors text-ink
            ${d ? 'border-primary bg-primary-subtle' : 'border-border bg-surface'}
            focus:border-primary`}
        />
      ))}
    </div>
  )
})

export default CodeInput
