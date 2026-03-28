import { useState } from 'react'

const SESSION_KEY = 'notperdi_admin'

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  const login = async (password: string): Promise<boolean> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setIsAdmin(true)
      return true
    }
    return false
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setIsAdmin(false)
  }

  return { isAdmin, login, logout }
}
