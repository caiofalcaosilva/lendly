'use client'
import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Avatar from '@/components/ui/Avatar'
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full bg-green-600 text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          title={t('changePhoto')}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900 disabled:opacity-50"
            title={t('removePhoto')}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
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
