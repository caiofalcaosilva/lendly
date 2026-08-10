'use client'
import { useEffect, useState } from 'react'
import { BadgeCheck, Clock, ShieldAlert, ShieldQuestion, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { User, VerificationStatus } from '@/types'
import { verificationService } from '@/services/verification'
import { usersService } from '@/services/users'
import { isValidCpf, formatCpf } from '@/lib/cpf'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'

interface Props {
  user: User
  updateUser: (user: User) => void
}

export default function IdentityVerificationSection({ user, updateUser }: Props) {
  const [status, setStatus] = useState<VerificationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [cpf, setCpf] = useState('')
  const [selfie, setSelfie] = useState<File | null>(null)
  const [document, setDocument] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const t = useTranslations('Common.IdentityVerificationSection')

  useEffect(() => {
    verificationService.me().then(setStatus).finally(() => setLoading(false))
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isValidCpf(cpf)) {
      setError(t('errorInvalidCpf'))
      return
    }
    if (!selfie || !document) {
      setError(t('errorFilesRequired'))
      return
    }
    setSubmitting(true)
    try {
      await verificationService.submit(cpf, selfie, document)
      const fresh = await usersService.getMe()
      updateUser(fresh)
      setStatus({ identity_status: 'pending' })
    } catch (e: any) {
      setError(e.response?.data?.detail || t('errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const identityStatus = status?.identity_status ?? user.identity_status ?? 'none'

  return (
    <div id="identity-verification" className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 scroll-mt-24">
      <div className="flex items-start gap-3 mb-1">
        {identityStatus === 'approved' ? (
          <BadgeCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
        ) : identityStatus === 'pending' ? (
          <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        ) : identityStatus === 'rejected' ? (
          <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        ) : (
          <ShieldQuestion className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('title')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {identityStatus === 'approved' && t('approved')}
            {identityStatus === 'pending' && t('pending')}
            {identityStatus === 'rejected' && t('rejected')}
            {identityStatus === 'none' && t('none')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-green-600" /></div>
      ) : (identityStatus === 'none' || identityStatus === 'rejected') && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {identityStatus === 'rejected' && status?.rejection_reason && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2 mb-3">
              {t('rejectionReason', { reason: status.rejection_reason })}
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <Input
              label="CPF"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              required
            />

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('selfie')}</label>
              <label className="flex items-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:border-green-400 dark:hover:border-green-600">
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="truncate min-w-0">{selfie ? selfie.name : t('chooseSelfie')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('documentWithPhoto')}</label>
              <label className="flex items-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:border-green-400 dark:hover:border-green-600">
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="truncate min-w-0">{document ? document.name : t('chooseDocument')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <Button type="submit" size="sm" loading={submitting} className="w-full">
              {t('submit')}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
