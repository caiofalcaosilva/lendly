'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@/types'
import { authService } from '@/services/auth'
import { usersService } from '@/services/users'

interface RegisterData {
  name: string
  email: string
  password: string
  phone?: string
  zip_code?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ requires_2fa: boolean; temp_token?: string }>
  register: (data: RegisterData) => Promise<void>
  completeTwoFactor: (tempToken: string, code: string, trustDevice?: boolean) => Promise<void>
  updateUser: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

async function resolveCoords(digits: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
    if (r.ok) {
      const geo = await r.json()
      const c = geo?.location?.coordinates
      if (c?.latitude && c?.longitude) {
        return { lat: parseFloat(c.latitude), lng: parseFloat(c.longitude) }
      }
    }
  } catch { /* fall through */ }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=Brazil&format=json&limit=1`,
      { headers: { 'User-Agent': 'lendly-app' } },
    )
    if (r.ok) {
      const results = await r.json()
      if (results?.[0]?.lat && results?.[0]?.lon) {
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
      }
    }
  } catch { /* ignore */ }

  return null
}

function geocodeAndPersist(zipCode: string, currentUser: User, onUpdated: (u: User) => void) {
  const digits = zipCode.replace(/\D/g, '')
  if (digits.length !== 8) return
  resolveCoords(digits)
    .then((coords) => {
      if (!coords) return undefined
      return usersService.updateMe({ latitude: coords.lat, longitude: coords.lng })
    })
    .then((updated) => { if (updated) onUpdated(updated) })
    .catch(() => {})
}

function persist(token: string, user: User, deviceToken: string) {
  localStorage.setItem('lendly_token', token)
  localStorage.setItem('lendly_user', JSON.stringify(user))
  localStorage.setItem('lendly_device', deviceToken)
  document.cookie = `lendly_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
}

function clear() {
  localStorage.removeItem('lendly_token')
  localStorage.removeItem('lendly_user')
  localStorage.removeItem('lendly_device')
  document.cookie = 'lendly_token=; path=/; max-age=0'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('lendly_user')
    const token = localStorage.getItem('lendly_token')
    if (stored) setUser(JSON.parse(stored))
    if (token) {
      usersService.getMe()
        .then((fresh) => {
          localStorage.setItem('lendly_user', JSON.stringify(fresh))
          setUser(fresh)
          if (fresh.zip_code && !fresh.latitude) {
            geocodeAndPersist(fresh.zip_code, fresh, (updated) => {
              localStorage.setItem('lendly_user', JSON.stringify(updated))
              setUser(updated)
            })
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const deviceToken = localStorage.getItem('lendly_device')
    const data = await authService.login(email, password, deviceToken)

    if (data.requires_2fa) {
      return { requires_2fa: true, temp_token: data.temp_token }
    }

    persist(data.access_token!, data.user!, data.device_token!)
    setUser(data.user!)
    return { requires_2fa: false }
  }

  const completeTwoFactor = async (tempToken: string, code: string, trustDevice = true) => {
    const data = await authService.completeTwoFactor(tempToken, code, trustDevice)
    persist(data.access_token, data.user, data.device_token)
    setUser(data.user)
  }

  const register = async (formData: RegisterData) => {
    const data = await authService.register(formData)
    persist(data.access_token, data.user, data.device_token)
    setUser(data.user)
  }

  const updateUser = (updated: User) => {
    localStorage.setItem('lendly_user', JSON.stringify(updated))
    setUser(updated)
  }

  const logout = () => {
    clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        completeTwoFactor,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
