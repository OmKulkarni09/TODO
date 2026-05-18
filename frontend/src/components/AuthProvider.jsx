import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, onUnauthorized } from '../api.js'

const AuthCtx = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // On mount, if a token exists in localStorage, validate it by calling /me
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // Listen for 401s from anywhere in the app
  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null)
      setError('Your session expired. Please sign in again.')
    })
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const res = await api.login(email, password)
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (email, password) => {
    setError(null)
    const res = await api.register(email, password)
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setError(null)
  }, [])

  return (
    <AuthCtx.Provider
      value={{ user, loading, error, setError, login, register, logout }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
