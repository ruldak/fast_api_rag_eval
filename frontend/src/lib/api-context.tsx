import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Tenant, HealthStatus } from "./types"
import { fetchTenant, fetchHealth } from "./api"

interface ApiContextValue {
  apiKey: string | null
  setApiKey: (key: string) => void
  clearApiKey: () => void
  tenant: Tenant | null
  health: HealthStatus | null
  loading: boolean
  refreshTenant: () => Promise<void>
  refreshHealth: () => Promise<void>
}

const ApiContext = createContext<ApiContextValue | null>(null)

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    try { return localStorage.getItem("api_key") } catch { return null }
  })
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem("api_key", key)
    setApiKeyState(key)
  }, [])

  const clearApiKey = useCallback(() => {
    localStorage.removeItem("api_key")
    setApiKeyState(null)
    setTenant(null)
  }, [])

  const refreshTenant = useCallback(async () => {
    if (!apiKey) { setTenant(null); return }
    try {
      const t = await fetchTenant()
      setTenant(t)
    } catch {
      setTenant(null)
    }
  }, [apiKey])

  const refreshHealth = useCallback(async () => {
    try {
      const h = await fetchHealth()
      setHealth(h)
    } catch {
      setHealth({ status: "unhealthy", environment: "unknown", database: "disconnected", version: "0.0.0" })
    }
  }, [])

  // Fetch health once on mount (unauthenticated)
  useEffect(() => {
    refreshHealth()
  }, [refreshHealth])

  // Fetch tenant when apiKey changes (authenticated)
  useEffect(() => {
    setLoading(true)
    refreshTenant().finally(() => setLoading(false))
  }, [apiKey, refreshTenant])

  return (
    <ApiContext.Provider value={{ apiKey, setApiKey, clearApiKey, tenant, health, loading, refreshTenant, refreshHealth }}>
      {children}
    </ApiContext.Provider>
  )
}

export function useApi() {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error("useApi must be used within ApiProvider")
  return ctx
}
