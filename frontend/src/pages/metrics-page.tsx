import { useState, useEffect } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Code2,
  Sparkles,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useApi } from "@/lib/api-context"
import { fetchMetrics, createMetric, updateMetric, deleteMetric, ApiError } from "@/lib/api"
import type { Metric, MetricType } from "@/lib/types"
import { toast } from "sonner"

function MetricTypeBadge({ type, className }: { type: MetricType; className?: string }) {
  if (type === "predefined")
    return (
      <Badge className={`bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 gap-1 ${className || ""}`}>
        <Sparkles className="size-3" /> Predefined
      </Badge>
    )
  return (
    <Badge className={`bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-0 gap-1 ${className || ""}`}>
      <Code2 className="size-3" /> Custom
    </Badge>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const defaultConfig = {
  name: "",
  prompt_template: "",
  model: "llama-3.1-8b-instant",
  output_schema: '{"score": "float", "reason": "string"}',
  temperature: "0.0",
}

const GROQ_MODELS: { value: string; label: string }[] = [
  { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant" },
  { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
  { value: "openai/gpt-oss-20b", label: "openai/gpt-oss-20b" },
]

export function MetricsPage() {
  const { apiKey } = useApi()
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editMetric, setEditMetric] = useState<Metric | null>(null)
  const [metricToDelete, setMetricToDelete] = useState<Metric | null>(null)
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set())
  const [outputSchemaError, setOutputSchemaError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const [form, setForm] = useState(defaultConfig)

  const loadMetrics = async () => {
    if (!apiKey) { setLoading(false); return }
    try {
      const data = await fetchMetrics()
      setMetrics(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadMetrics() }, [apiKey])

  const toggleConfig = (id: string) => {
    setExpandedConfigs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCreate = () => {
    setForm(defaultConfig)
    setCreateOpen(true)
    setApiError(null)
    setOutputSchemaError(null)
  }

  const openEdit = (metric: Metric) => {
    setForm({
      name: metric.name,
      prompt_template: metric.config.prompt_template ?? "",
      model: metric.config.model ?? "llama-3.1-8b-instant",
      output_schema: JSON.stringify(metric.config.output_schema ?? { score: "float", reason: "string" }, null, 2),
      temperature: String(metric.config.temperature ?? 0.0),
    })
    setEditMetric(metric)
    setApiError(null)
    setOutputSchemaError(null)
  }

  const handleCreate = async () => {
    setApiError(null)
    setOutputSchemaError(null)
    let parsedSchema: Record<string, string>
    try {
      parsedSchema = JSON.parse(form.output_schema)
    } catch {
      setOutputSchemaError("Invalid JSON format. Must be a valid JSON object, e.g. {\"score\": \"float\"}")
      return
    }
    try {
      const newMetric = await createMetric({
        name: form.name.trim(),
        type: "custom",
        config: {
          prompt_template: form.prompt_template,
          model: form.model,
          output_schema: parsedSchema,
          temperature: parseFloat(form.temperature),
        },
      })
      setMetrics((prev) => [...prev, newMetric])
      setCreateOpen(false)
      toast.success("Metric created successfully")
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.humanMessage() : (e.message ?? "Failed to create metric")
      setApiError(msg)
      toast.error("Failed to create metric")
    }
  }

  const handleUpdate = async () => {
    if (!editMetric) return
    setApiError(null)
    setOutputSchemaError(null)
    let parsedSchema: Record<string, string>
    try {
      parsedSchema = JSON.parse(form.output_schema)
    } catch {
      setOutputSchemaError("Invalid JSON format. Must be a valid JSON object, e.g. {\"score\": \"float\"}")
      return
    }
    try {
      const updated = await updateMetric(editMetric.id, {
        name: form.name.trim(),
        config: {
          prompt_template: form.prompt_template,
          model: form.model,
          output_schema: parsedSchema,
          temperature: parseFloat(form.temperature),
        },
      })
      setMetrics((prev) => prev.map((m) => m.id === editMetric.id ? updated : m))
      setEditMetric(null)
      toast.success("Metric updated successfully")
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.humanMessage() : (e.message ?? "Failed to update metric")
      setApiError(msg)
      toast.error("Failed to update metric")
    }
  }

  const handleDelete = async () => {
    if (!metricToDelete) return
    try {
      await deleteMetric(metricToDelete.id)
      setMetrics((prev) => prev.filter((m) => m.id !== metricToDelete.id))
      setMetricToDelete(null)
      toast.success("Metric deleted")
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.humanMessage() : (e.message ?? "Failed to delete metric")
      toast.error(msg)
    }
  }

  const predefined = metrics.filter((m) => m.type === "predefined")
  const custom = metrics.filter((m) => m.type === "custom")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${predefined.length} predefined · ${custom.length} custom`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5" disabled={!apiKey}>
          <Plus className="size-4" /> New Metric
        </Button>
      </div>

      {/* Predefined */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Predefined
        </h2>
        {predefined.length === 0 ? (
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "No predefined metrics available."}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {predefined.map((metric) => (
              <Card key={metric.id} className="gap-3">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <CardTitle className="text-sm @lg/card-header:text-base capitalize min-w-0 truncate">
                      {metric.name.replace(/_/g, " ")}
                    </CardTitle>
                    <MetricTypeBadge type={metric.type} className="shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground font-mono">{metric.name}</p>
                  <p className="text-xs text-muted-foreground mt-2">Added {formatDate(metric.created_at)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Custom */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Custom
        </h2>
        {custom.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Code2 className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "No custom metrics yet."}</p>
              {!loading && (
                <Button variant="outline" size="sm" onClick={openCreate} className="mt-3 gap-1.5">
                  <Plus className="size-4" /> Create one
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {custom.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base capitalize">
                            {metric.name.replace(/_/g, " ")}
                          </CardTitle>
                          <MetricTypeBadge type={metric.type} />
                        </div>
                        <CardDescription className="font-mono mt-0.5">{metric.name}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(metric)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setMetricToDelete(metric)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                    {metric.config.model && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-foreground">Model:</span> {metric.config.model}
                      </span>
                    )}
                    {metric.config.temperature !== undefined && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-foreground">Temp:</span> {metric.config.temperature}
                      </span>
                    )}
                    <span>Created {formatDate(metric.created_at)}</span>
                  </div>
                  <Collapsible open={expandedConfigs.has(metric.id)} onOpenChange={() => toggleConfig(metric.id)}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown className={`size-3.5 transition-transform ${expandedConfigs.has(metric.id) ? "rotate-180" : ""}`} />
                      View prompt template
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap text-muted-foreground">
                        {metric.config.prompt_template}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Metric</DialogTitle>
            <DialogDescription>Define an LLM-driven evaluation metric with a custom prompt template.</DialogDescription>
          </DialogHeader>
          {(apiError || outputSchemaError) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm font-medium text-destructive mb-1">Validation Error</p>
              <pre className="text-xs text-destructive/80 whitespace-pre-wrap break-all font-mono">{apiError || outputSchemaError}</pre>
            </div>
          )}
          <MetricForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.prompt_template || !form.name.trim()}>Create Metric</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editMetric} onOpenChange={(open) => !open && setEditMetric(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Metric</DialogTitle>
            <DialogDescription>Update the configuration for "{editMetric?.name}".</DialogDescription>
          </DialogHeader>
          {(apiError || outputSchemaError) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm font-medium text-destructive mb-1">Validation Error</p>
              <pre className="text-xs text-destructive/80 whitespace-pre-wrap break-all font-mono">{apiError || outputSchemaError}</pre>
            </div>
          )}
          <MetricForm form={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMetric(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!metricToDelete} onOpenChange={(open) => !open && setMetricToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete metric?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "<strong>{metricToDelete?.name}</strong>". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface MetricFormProps {
  form: typeof defaultConfig
  onChange: (form: typeof defaultConfig) => void
}

function MetricForm({ form, onChange }: MetricFormProps) {
  const isKnownModel = GROQ_MODELS.some((m) => m.value === form.model)
  const modelSelectValue = form.model
    ? (isKnownModel ? form.model : `__custom__:${form.model}`)
    : "llama-3.1-8b-instant"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Metric Name</Label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. conciseness, tone_appropriateness"
        />
        <p className="text-xs text-muted-foreground">Lowercase, underscores recommended (e.g. <code>my_custom_metric</code>).</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Prompt Template</Label>
        <Textarea
          value={form.prompt_template}
          onChange={(e) => onChange({ ...form, prompt_template: e.target.value })}
          placeholder="Evaluate the response on a scale of 0 to 1"
          className="min-h-[120px] font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">Use {"{{query}}"}, {"{{response}}"}, {"{{context}}"} as template variables.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Model</Label>
          <Select
            value={modelSelectValue}
            onValueChange={(v) => {
              const next = v.startsWith("__custom__:") ? v.slice("__custom__:".length) : v
              onChange({ ...form, model: next })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!isKnownModel && form.model && (
                <SelectItem value={`__custom__:${form.model}`}>
                  {form.model} (current)
                </SelectItem>
              )}
              {GROQ_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Temperature</Label>
          <Input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={form.temperature}
            onChange={(e) => onChange({ ...form, temperature: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
