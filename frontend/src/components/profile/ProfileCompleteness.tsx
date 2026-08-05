import { CheckCircle2, Circle } from 'lucide-react'
import { User } from '@/types'

function buildChecks(user: User) {
  const checks = [
    { key: 'avatar', label: 'Foto de perfil', done: !!user.avatar_url },
    { key: 'bio', label: user.account_type === 'business' ? 'Sobre o negócio' : 'Bio', done: !!user.bio },
    { key: 'phone', label: 'Telefone', done: !!user.phone },
    { key: 'address', label: 'Endereço', done: !!user.zip_code },
    { key: 'verified', label: 'E-mail verificado', done: user.is_verified },
    { key: '2fa', label: 'Autenticação em duas etapas', done: user.totp_enabled },
  ]
  if (user.account_type === 'business') {
    checks.push({
      key: 'contact',
      label: 'Site, Instagram ou WhatsApp',
      done: !!(user.website || user.instagram || user.whatsapp),
    })
  }
  return checks
}

// Hides itself once complete — a permanent 100% badge would be a
// participation trophy, not a signal worth showing.
export default function ProfileCompleteness({ user }: { user: User }) {
  const checks = buildChecks(user)
  const doneCount = checks.filter((c) => c.done).length
  const percent = Math.round((doneCount / checks.length) * 100)

  if (percent >= 100) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Perfil {percent}% completo</p>
        <span className="text-xs text-gray-400 dark:text-gray-500">{doneCount}/{checks.length}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {checks.map((c) => (
          <span
            key={c.key}
            className={`flex items-center gap-1 text-xs ${
              c.done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {c.done ? <CheckCircle2 className="w-3 h-3 text-green-500 dark:text-green-400" /> : <Circle className="w-3 h-3" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}
