'use client'
import { useTranslations } from 'next-intl'
import Modal from './Modal'
import Button from './Button'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  variant = 'danger',
  loading,
}: Props) {
  const t = useTranslations('Common.ConfirmDialog')

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-ink-muted">{description}</p>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {t('cancel')}
        </Button>
        <Button variant={variant} loading={loading} onClick={onConfirm}>
          {confirmLabel ?? t('confirm')}
        </Button>
      </div>
    </Modal>
  )
}
