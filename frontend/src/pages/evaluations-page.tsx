import { useState, useEffect } from "react"
import {
  ChevronLeft,
  Search,
  ArrowUpDown,
  Eye,
  ChevronRight,
  Layers,
  BarChart3
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useApi } from "@/lib/api-context"
import { fetchEvaluationRuns, fetchEvaluationDetail } from "@/lib/api"
import type { Page, RunStatus, EvaluationRun, EvaluationDetail } from "@/lib/types"

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "completed")
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Completed</Badge>
  if (status === "pending")
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pending</Badge>
  if (status === "processing")
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px] sm:text-xs">Processing</Badge>
  return <Badge variant="destructive">Failed</Badge>
}

function ScoreCell({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colorClass =
    value >= 0.85
      ? "[&>div]:bg-emerald-500 text-emerald-700 dark:text-emerald-400"
      : value >= 0.7
        ? "[&>div]:bg-amber-500 text-amber-700 dark:text-amber-400"
        : "[&>div]:bg-destructive text-destructive"
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <Progress value={pct} className={`h-1.5 flex-1 ${colorClass}`} />
      <span className={`text-xs font-mono w-7 text-right ${colorClass.split(" ").slice(1).join(" ")}`}>{pct}%</span>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function RunRow({ run, detail, onClick }: { run: EvaluationRun; detail?: EvaluationDetail; onClick: () => void }) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell className="text-[10px] sm:text-xs">
        <span className="font-mono text-muted-foreground">{run.run_id.slice(0, 6)}…</span>
      </TableCell>
      <TableCell className="text-[10px] sm:text-xs">
        {run.metadata.model ? (
          <code className="bg-muted px-1 py-0.5 rounded text-[9px] sm:text-xs">{run.metadata.model}</code>
        ) : (
          <code className="bg-muted px-1 py-0.5 rounded text-[9px] sm:text-xs">llama-3.1-8b-instant</code>
        )}
      </TableCell>
      <TableCell className="text-[11px] sm:text-sm text-center">{run.item_count}</TableCell>
      <TableCell><StatusBadge status={run.status} /></TableCell>
      <TableCell className="text-[10px] sm:text-xs text-muted-foreground">{formatDate(run.created_at)}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-sm">
          <Eye className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

interface EvaluationsListProps {
  onNavigate: (page: Page, runId?: string) => void
}

export function EvaluationsPage({ onNavigate }: EvaluationsListProps) {
  const { apiKey } = useApi()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [offset, setOffset] = useState(0)
  const limit = 5

  const [allRuns, setAllRuns] = useState<EvaluationRun[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  // Fetch runs from API
  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    setLoading(true)
    fetchEvaluationRuns({ limit: 100, status: statusFilter === "all" ? undefined : statusFilter })
      .then((res) => {
        // Client-side search filtering
        let filtered = res.items
        console.log(filtered)
        if (search) {
          const q = search.toLowerCase()
          filtered = filtered.filter(
            (r) =>
              r.run_id.includes(q) ||
              (r.metadata.model_tested ?? "").toLowerCase().includes(q) ||
              (r.metadata.environment ?? "").toLowerCase().includes(q)
          )
        }
        setAllRuns(filtered)
        setTotal(filtered.length)
      })
      .catch(() => { setAllRuns([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [apiKey, statusFilter, search])

  const paged = allRuns.slice(offset, offset + limit)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Evaluations</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Browse and inspect all evaluation runs
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by run ID, model, environment…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0) }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Run ID</TableHead>
                <TableHead className="text-xs sm:text-sm">Model</TableHead>
                <TableHead className="text-center text-xs sm:text-sm">Items</TableHead>
                <TableHead className="text-xs sm:text-sm">Status</TableHead>
                <TableHead className="text-xs sm:text-sm">
                  <div className="flex items-center gap-1">Created <ArrowUpDown className="size-3" /></div>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                    Loading evaluation runs...
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                    No evaluation runs found
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((run) => (
                  <RunRow
                    key={run.run_id}
                    run={run}
                    onClick={() => onNavigate("evaluation-detail", run.run_id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
          {total > limit && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} runs
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface EvaluationDetailPageProps {
  runId: string
  onBack: () => void
}

export function EvaluationDetailPage({ runId, onBack }: EvaluationDetailPageProps) {
  const { apiKey } = useApi()
  const [detail, setDetail] = useState<EvaluationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    setLoading(true)
    fetchEvaluationDetail(runId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [apiKey, runId])

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit gap-1.5">
          <ChevronLeft className="size-4" /> Back
        </Button>
        <p className="text-muted-foreground">Loading run details...</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit gap-1.5">
          <ChevronLeft className="size-4" /> Back
        </Button>
        <p className="text-muted-foreground">{error ?? "Run not found."}</p>
      </div>
    )
  }

  const metricNames = Object.keys(detail.summary) ?? []
  console.log(detail.status)

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="size-4" /> Evaluations
        </button>
        <ChevronRight className="size-4 text-muted-foreground" />
        <span className="font-mono text-[10px] sm:text-xs">{runId.slice(0, 6)}…</span>
      </div>

      {/* Summary Scores */}
      {detail.summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(detail.summary).map(([metric, score]) => (
            <Card key={metric}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs capitalize">{metric.replace(/_/g, " ")}</CardDescription>
                <CardTitle
                  className={`text-lg sm:text-2xl font-bold ${score >= 0.85 ? "text-emerald-600 dark:text-emerald-400" : score >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}
                >
                  {(score * 100).toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress
                  value={score * 100}
                  className={`h-1.5 ${score >= 0.85 ? "[&>div]:bg-emerald-500" : score >= 0.7 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"}`}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run Info */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x">
            {/* Status */}
            <div className="flex-1 flex items-center gap-3 px-5 py-4">
              <div className={`size-2.5 rounded-full shrink-0 ${detail.status === "completed" ? "bg-emerald-500" : detail.status === "pending" ? "bg-amber-500" : "bg-destructive"}`} />
              <div>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                <p className="text-xs sm:text-sm font-semibold capitalize">{detail.status}</p>
              </div>
            </div>
            {/* Items */}
            <div className="flex-1 flex items-center gap-3 px-5 py-4">
              <Layers className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Items Evaluated</p>
                <p className="text-xs sm:text-sm font-semibold">{detail.items?.length ?? 0}</p>
              </div>
            </div>
            {/* Metrics */}
            <div className="flex-[2] flex items-center gap-3 px-5 py-4 min-w-0">
              <BarChart3 className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Metrics ({metricNames.length})</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {metricNames.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px] font-normal capitalize">
                      {m.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      {detail.items ? (
        <Card className="">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Evaluation Items</CardTitle>
            <CardDescription className="text-xs sm:text-sm">{detail.items.length} items evaluated</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-none">
              <div className="divide-y">
                {detail.items.map((item, idx) => (
                  <Collapsible
                    key={item.item_id}
                    open={openItems.has(item.item_id)}
                    onOpenChange={() => toggleItem(item.item_id)}
                  >
                    <CollapsibleTrigger className="w-full text-left hover:bg-muted/30 transition-colors px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex flex-wrap items-start gap-1.5 sm:gap-4">
                        <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 shrink-0 w-4 sm:w-5">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium line-clamp-1">{item.query}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.response}</p>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div className="flex gap-1 sm:gap-2">
                            {Object.entries(item.scores).map(([metric, score]) => (
                              <div key={metric} className="text-right">
                                <p className="text-[9px] sm:text-xs text-muted-foreground capitalize hidden sm:block">{metric.replace(/_/g, " ")}</p>
                                <p className={`text-[10px] sm:text-sm font-semibold ${score.value >= 0.85 ? "text-emerald-600 dark:text-emerald-400" : score.value >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                                  {(score.value * 100).toFixed(0)}%
                                </p>
                              </div>
                            ))}
                          </div>
                          <ChevronRight className={`size-3 sm:size-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${openItems.has(item.item_id) ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 sm:px-6 pb-3 sm:pb-4 pt-2 bg-muted/20 flex flex-col gap-2 sm:gap-3">
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Query</p>
                          <p className="text-xs sm:text-sm">{item.query}</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Response</p>
                          <p className="text-xs sm:text-sm">{item.response}</p>
                        </div>
                        {item.contexts && (
                          <div>
                            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Context</p>
                            <div className="rounded border bg-background p-2 sm:p-2.5">
                              <p className="text-[10px] sm:text-xs text-muted-foreground break-words">{item.contexts[0]}</p>
                            </div>
                          </div>
                        )}
                        {item.ground_truth && (
                          <div>
                            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-1">Ground Truth</p>
                            <p className="text-xs sm:text-sm font-medium">{item.ground_truth}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {Object.entries(item.scores).map(([metric, score]) => (
                            <div key={metric} className="rounded border bg-background p-2 sm:p-3 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] sm:text-xs font-medium capitalize">{metric.replace(/_/g, " ")}</p>
                                <span className={`text-[11px] sm:text-sm font-bold ${score.value >= 0.85 ? "text-emerald-600 dark:text-emerald-400" : score.value >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                                  {(score.value * 100).toFixed(1)}%
                                </span>
                              </div>
                              <Progress
                                value={score.value * 100}
                                className={`h-1 ${score.value >= 0.85 ? "[&>div]:bg-emerald-500" : score.value >= 0.7 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"}`}
                              />
                              {score.details.reason && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{score.details.reason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {detail.status === "pending" ? "Evaluation is still in progress…" : "No item details available for this run."}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
