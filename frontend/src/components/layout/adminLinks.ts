import { BarChart3, Users, Package, UsersRound, ShieldAlert, ShieldCheck, History, Settings as SettingsIcon, Download, Tags } from 'lucide-react'

export const ADMIN_LINKS = [
  { href: '/admin/dashboard', key: 'dashboard', icon: BarChart3 },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/items', key: 'items', icon: Package },
  { href: '/admin/groups', key: 'groups', icon: UsersRound },
  { href: '/admin/moderation', key: 'moderation', icon: ShieldAlert },
  { href: '/admin/verification', key: 'verification', icon: ShieldCheck },
  { href: '/admin/actions', key: 'actions', icon: History },
  { href: '/admin/settings', key: 'settings', icon: SettingsIcon },
  { href: '/admin/export', key: 'export', icon: Download },
  { href: '/admin/categories', key: 'categories', icon: Tags },
] as const
