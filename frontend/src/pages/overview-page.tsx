import { useState, useEffect } from "react"
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
  ArrowUpRight,
  Database,
  Cpu,
  BarChart3,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/lib/api-context"
import { fetchEvaluationRuns } from "@/lib/api"
import type { Page, RunStatus, EvaluationRun } from "@/lib/types"

const statusConfig = {
  completed: { label: "Completed", color: "var(--chart-1)" },
  pending: { label: "Pending", color: "var(--chart-2)" },
  failed: { label: "Failed", color: "var(--chart-3)" },
} satisfies ChartConfig

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "completed")
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px] sm:text-xs">Completed</Badge>
  if (status === "pending")
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-[10px] sm:text-xs">Pending</Badge>
  if (status === "processing")
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-[10px] sm:text-xs">Processing</Badge>
  return <Badge variant="destructive" className="text-[10px] sm:text-xs">Failed</Badge>
}

interface OverviewPageProps {
  onNavigate: (page: Page, runId?: string) => void
}

function getModelName(metadata: EvaluationRun["metadata"]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = metadata as any
  return m.model_tested || m.model || "llama-3.1-8b-instant"
}

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { health, apiKey } = useApi()
  const [runs, setRuns] = useState<EvaluationRun[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    if (!apiKey) {
      setLoadingRuns(false)
      return
    }
    setLoadingRuns(true)
    fetchEvaluationRuns({ limit: 30 })
      .then((res) => setRuns(res.items))
      .catch(() => setRuns([]))
      .finally(() => setLoadingRuns(false))
  }, [apiKey])

  const total = runs.length
  const completed = runs.filter((r) => r.status === "completed").length
  const pending = runs.filter((r) => r.status === "pending").length
  const processing = runs.filter((r) => r.status === "processing").length
  const failed = runs.filter((r) => r.status === "failed").length

  const completedPct = total ? Math.round((completed / total) * 100) : 0
  const pendingPct = total ? Math.round((pending / total) * 100) : 0
  const processingPct = total ? Math.round((processing / total) * 100) : 0
  const failedPct = total ? Math.round((failed / total) * 100) : 0

  const avgItems = total
    ? Math.round(runs.reduce((s, r) => s + r.item_count, 0) / total)
    : 0

  // Data untuk bar chart distribusi status
  const statusDistribution = [
    { status: "Completed", count: completed, pct: completedPct },
    { status: "Pending", count: pending, pct: pendingPct },
    { status: "Processing", count: processing, pct: processingPct },
    { status: "Failed", count: failed, pct: failedPct },
  ]

  console.log(runs)

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            RAG pipeline evaluation overview
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[11px] sm:text-sm">
              <Layers className="size-3 sm:size-3.5" />
              Total Runs
            </CardDescription>
            <CardTitle className="text-xl sm:text-3xl font-bold">{total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {completed} completed · {pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[11px] sm:text-sm">
              <CheckCircle2 className="size-3 sm:size-3.5" />
              Completion Rate
            </CardDescription>
            <CardTitle className="text-xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {completedPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={completedPct} className="h-1.5 flex-1 [&>div]:bg-emerald-500" />
              <span className="text-xs font-mono w-8 text-right text-muted-foreground">
                {completed}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[11px] sm:text-sm">
              <Activity className="size-3 sm:size-3.5" />
              Pending Rate
            </CardDescription>
            <CardTitle className="text-xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
              {pendingPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={pendingPct} className="h-1.5 flex-1 [&>div]:bg-amber-500" />
              <span className="text-xs font-mono w-8 text-right text-muted-foreground">
                {pending}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[11px] sm:text-sm">
              <AlertCircle className="size-3 sm:size-3.5" />
              Processing Rate
            </CardDescription>
            <CardTitle className="text-xl sm:text-3xl font-bold text-orange-500">
              {processingPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={processingPct} className="h-1.5 flex-1 [&>div]:bg-orange-500" />
              <span className="text-xs font-mono w-8 text-right text-muted-foreground">
                {processing}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-[11px] sm:text-sm">
              <AlertCircle className="size-3 sm:size-3.5" />
              Failure Rate
            </CardDescription>
            <CardTitle className="text-xl sm:text-3xl font-bold text-destructive">
              {failedPct}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={failedPct} className="h-1.5 flex-1 [&>div]:bg-destructive" />
              <span className="text-xs font-mono w-8 text-right text-muted-foreground">
                {failed}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Info */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
        {/* Status Distribution Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-4" />
              Run Status Distribution
            </CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">
              Breakdown of evaluation runs by status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRuns ? (
              <div className="h-[180px] sm:h-[220px] flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                Loading data...
              </div>
            ) : total > 0 ? (
              <ChartContainer config={statusConfig} className="h-[180px] sm:h-[220px] w-full">
                <BarChart data={statusDistribution} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="status"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-[10px] sm:text-xs"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    className="text-[10px] sm:text-xs"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [`${value} runs`, name as string]}
                      />
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] sm:h-[220px] flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                No evaluation runs yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base font-semibold">Quick Stats</CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">
              Summary metrics from recent runs
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xs sm:text-sm font-medium">Completed</span>
              </div>
              <span className="text-xs sm:text-sm font-bold">{completed} ({completedPct}%)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-amber-500" />
                <span className="text-xs sm:text-sm font-medium">Pending</span>
              </div>
              <span className="text-xs sm:text-sm font-bold">{pending} ({pendingPct}%)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-orange-500" />
                <span className="text-xs sm:text-sm font-medium">Processing</span>
              </div>
              <span className="text-xs sm:text-sm font-bold">{processing} ({processingPct}%)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="size-2 rounded-full bg-destructive" />
                <span className="text-xs sm:text-sm font-medium">Failed</span>
              </div>
              <span className="text-xs sm:text-sm font-bold">{failed} ({failedPct}%)</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Database className="size-3.5 sm:size-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm font-medium">Avg Items / Run</span>
              </div>
              <span className="text-xs sm:text-sm font-bold">{avgItems}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs + System Status */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm sm:text-base font-semibold">
                Recent Evaluations
              </CardTitle>
              <CardDescription className="text-[11px] sm:text-sm">
                Latest 5 evaluation runs
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("evaluations")}
              className="gap-1.5 text-xs sm:text-sm"
            >
              View all <ArrowUpRight className="size-3 sm:size-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] sm:text-xs">Model</TableHead>
                  <TableHead className="text-[11px] sm:text-xs">Items</TableHead>
                  <TableHead className="text-[11px] sm:text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 5).map((run) => (
                  <TableRow
                    key={run.run_id}
                    className="cursor-pointer"
                    onClick={() => onNavigate("evaluation-detail", run.run_id)}
                  >
                    <TableCell className="font-mono text-[10px] sm:text-xs">
                      {getModelName(run.metadata)}
                    </TableCell>
                    <TableCell className="text-[11px] sm:text-sm">{run.item_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-6 text-xs sm:text-sm text-muted-foreground"
                    >
                      {loadingRuns ? "Loading..." : "No evaluation runs found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base font-semibold">System Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 rounded-lg border px-2.5 sm:px-3 py-2 sm:py-2.5">
              <div
                className={`size-1.5 sm:size-2 rounded-full ${health?.status === "healthy" ? "bg-emerald-500" : "bg-destructive"}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium capitalize">
                  {health?.status ?? "unknown"}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Service status</p>
              </div>
              {health?.status === "healthy" && (
                <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 rounded-lg border px-2.5 sm:px-3 py-2 sm:py-2.5">
              <Database className="size-3.5 sm:size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium capitalize">
                  {health?.database ?? "unknown"}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Database</p>
              </div>
              {health?.database === "connected" && (
                <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 rounded-lg border px-2.5 sm:px-3 py-2 sm:py-2.5">
              <Cpu className="size-3.5 sm:size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium capitalize">
                  {health?.environment ?? "unknown"}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Environment</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 rounded-lg border px-2.5 sm:px-3 py-2 sm:py-2.5">
              <Clock className="size-3.5 sm:size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium">v{health?.version ?? "?"}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">API version</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}