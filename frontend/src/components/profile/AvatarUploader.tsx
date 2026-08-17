'use client'
import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Avatar from '@/components/ui/Avatar'
import Tooltip from '@/components/ui/Tooltip'
import { usersService } from '@/services/users'

export default function AvatarUploader({
  name,
  avatarUrl,
  onChange,
}: {
  name: string
  avatarUrl?: string | null
  onChange: (avatarUrl: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslations('Common.AvatarUploader')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setBusy(true)
    setError('')
    try {
      const updated = await usersService.uploadAvatar(file)
      onChange(updated.avatar_url ?? null)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('errorUpload'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    setError('')
    try {
      await usersService.removeAvatar()
      onChange(null)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('errorRemove'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mb-3 w-fit">
      <div className="relative">
        <Avatar name={name} avatarUrl={avatarUrl} size="lg" />
        <div className="absolute -bottom-1 -right-1">
          <Tooltip label={t('changePhoto')}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-primary text-primary-on shadow-elevated hover:bg-primary-hover disabled:opacity-50"
              aria-label={t('changePhoto')}
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>
        </div>
        {avatarUrl && (
          <div className="absolute -top-1 -right-1">
            <Tooltip label={t('removePhoto')}>
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-ink text-bg hover:opacity-80 disabled:opacity-50"
                aria-label={t('removePhoto')}
              >
                <X className="w-3 h-3" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
