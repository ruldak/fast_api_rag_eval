import { useState, useEffect } from "react"
import { Copy, Eye, EyeOff, CheckCircle2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useApi } from "@/lib/api-context"
import { createTenant, verifyApiKey, ApiError } from "@/lib/api"
import { toast } from "sonner"

export function SettingsPage() {
  const { apiKey, setApiKey, clearApiKey, tenant, health, refreshTenant, refreshHealth } = useApi()
  const [keyVisible, setKeyVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newOrgName, setNewOrgName] = useState("")
  const [creatingTenant, setCreatingTenant] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const [savingKey, setSavingKey] = useState(false)

  const maskedKey = apiKey ? "rag_sk_" + "•".repeat(24) : ""

  const copyKey = () => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveKey = async () => {
    const val = keyInput.trim()
    if (!val) return
    setSavingKey(true)
    try {
      await verifyApiKey(val)
      setApiKey(val)
      setKeyInput("")
      toast.success("API key verified and saved!")
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.humanMessage() : (e.message ?? "Invalid API key")
      toast.error(msg)
    }
    setSavingKey(false)
  }

  const handleCreateTenant = async () => {
    if (!newOrgName.trim()) return
    setCreatingTenant(true)
    try {
      const result = await createTenant(newOrgName.trim())
      if (result.api_key) {
        setApiKey(result.api_key)
        toast.success("Tenant created! API key saved.")
      } else {
        toast.success("Tenant created.")
      }
      setNewOrgName("")
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.humanMessage() : (e.message ?? "Failed to create tenant")
      toast.error(msg)
    }
    setCreatingTenant(false)
  }

  const handleRefreshStatus = async () => {
    await refreshHealth()
    toast.success("Status refreshed")
  }

  // No API key yet — show setup screen
  if (!apiKey) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect to your RAG Evaluation backend
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect to Backend</CardTitle>
            <CardDescription>Enter your API key or create a new tenant to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 p-3">
              <p className="text-xs text-blue-800 dark:text-blue-400">
                Make sure your backend is running at <code className="font-mono">http://localhost:8000</code>
              </p>
            </div>

            <Separator />

            {/* Enter existing key */}
            <div className="flex flex-col gap-1.5">
              <Label>Enter existing API Key</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="rag_sk_..."
                  className="font-mono text-xs"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveKey()
                  }}
                />
                <Button variant="secondary" onClick={handleSaveKey} disabled={!keyInput.trim() || savingKey}>
                  {savingKey ? "Verifying..." : "Save Key"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste your API key from the backend. It will be stored in localStorage.
              </p>
            </div>

            <Separator />

            {/* Create new tenant */}
            <div className="flex flex-col gap-1.5">
              <Label>Or create a new tenant</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateTenant() }}
                />
                <Button onClick={handleCreateTenant} disabled={!newOrgName.trim() || creatingTenant}>
                  {creatingTenant ? "Creating..." : "Create"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This will register a new tenant and automatically save the API key.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Health (always visible) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health</CardTitle>
            <CardDescription>Live status of backend services</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: "API Service", value: health?.status ?? "checking...", ok: health?.status === "healthy" },
              { label: "Database", value: health?.database ?? "checking...", ok: health?.database === "connected" },
              { label: "Environment", value: health?.environment ?? "checking...", ok: true },
              { label: "Version", value: health?.version ? `v${health.version}` : "checking...", ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <div className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
                  <span className="text-sm font-medium capitalize">{value}</span>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-fit mt-1 gap-1.5" onClick={handleRefreshStatus}>
              <RefreshCw className="size-4" /> Refresh Status
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authenticated — show full settings
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your tenant account and API credentials
        </p>
      </div>

      {/* Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant Account</CardTitle>
          <CardDescription>Your organization details</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Organization Name</Label>
            <Input value={tenant?.name ?? "Loading..."} readOnly className="bg-muted/30" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tenant ID</Label>
            <div className="flex gap-2">
              <Input value={tenant?.id ?? "Loading..."} readOnly className="bg-muted/30 font-mono text-xs" />
              {tenant?.id && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(tenant.id).catch(() => {})}
                >
                  <Copy className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">API Key</CardTitle>
              <CardDescription>Used in the X-API-Key header for all authenticated requests</CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={keyVisible ? apiKey : maskedKey}
              readOnly
              className="font-mono text-xs bg-muted/30 flex-1"
            />
            <Button variant="outline" size="icon" onClick={() => setKeyVisible((v) => !v)}>
              {keyVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={copyKey}>
              {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-3">
            <p className="text-xs text-amber-800 dark:text-amber-400">
              Keep your API key secret. Never expose it in client-side code or commit it to version control. Rotate it if compromised.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <p className="text-xs text-muted-foreground">Usage:</p>
            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
              X-API-Key: {maskedKey}
            </code>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Health</CardTitle>
          <CardDescription>Live status of backend services</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[
            { label: "API Service", value: health?.status ?? "unknown", ok: health?.status === "healthy" },
            { label: "Database", value: health?.database ?? "unknown", ok: health?.database === "connected" },
            { label: "Environment", value: health?.environment ?? "unknown", ok: true },
            { label: "Version", value: health?.version ? `v${health.version}` : "?", ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <div className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
                <span className="text-sm font-medium capitalize">{value}</span>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit mt-1 gap-1.5" onClick={handleRefreshStatus}>
            <RefreshCw className="size-4" /> Refresh Status
          </Button>
        </CardContent>
      </Card>

      {/* Disconnect */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          <CardDescription>Actions for your current session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Disconnect</p>
              <p className="text-xs text-muted-foreground">Remove API key from this session.</p>
            </div>
            <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white" onClick={clearApiKey}>
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
