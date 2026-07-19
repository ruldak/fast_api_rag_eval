import { useState, useEffect } from "react"
import {
  Scatter,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { fetchCalibrationReport } from "@/lib/api"
import type { CalibrationStat } from "@/lib/types"
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react"

const scatterConfig = {
  delta: { label: "Delta", color: "var(--chart-1)" },
} satisfies ChartConfig

function MetricBiasIndicator({ biasDetected }: { biasDetected: boolean }) {
  if (biasDetected)
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 text-destructive">
        <AlertCircle className="size-3 sm:size-4" />
        <span className="text-[9px] sm:text-xs font-medium">Bias Detected</span>
      </div>
    )
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="size-3 sm:size-4" />
      <span className="text-[9px] sm:text-xs font-medium">No Bias</span>
    </div>
  )
}

function CorrelationBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[9px] sm:text-xs text-muted-foreground">N/A</span>
  const pct = Math.round(Math.abs(value) * 100)
  const colorClass =
    value >= 0.8
      ? "[&>div]:bg-emerald-500"
      : value >= 0.6
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <Progress value={pct} className={`h-1.5 flex-1 ${colorClass}`} />
      <span className="text-[9px] sm:text-xs font-mono w-8 sm:w-10 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

function MaeBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colorClass = value <= 0.05
    ? "[&>div]:bg-emerald-500"
    : value <= 0.1
      ? "[&>div]:bg-amber-500"
      : "[&>div]:bg-destructive"
  return (
    <div className="flex items-center gap-2">
      <Progress value={Math.min(pct * 5, 100)} className={`h-1.5 flex-1 ${colorClass}`} />
      <span className="text-[9px] sm:text-xs font-mono w-8 sm:w-10 text-right">{value.toFixed(3)}</span>
    </div>
  )
}

export function CalibrationPage() {
  const { apiKey } = useApi()
  const [stats, setStats] = useState<CalibrationStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    fetchCalibrationReport({ min_samples: 1 })
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false))
  }, [apiKey])

  if (!apiKey) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Calibration Report</h1>
        <Card>
          <CardContent className="py-10 sm:py-16 text-center text-muted-foreground text-xs sm:text-sm">
            Please set your API key in Settings to view calibration reports.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-lg sm:text-2xl font-semibold tracking-tight">Calibration Report</h1>
        <p className="text-[10px] sm:text-sm text-muted-foreground mt-0.5">
          {loading ? "Loading..." : `LLM vs human scoring comparison · ${stats.length} metrics analyzed`}
        </p>
      </div>

      {!loading && stats.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No calibration data available yet. Submit some human reviews first.
          </CardContent>
        </Card>
      )}

      {stats.map((stat) => {
        const scatterData = stat.samples.map((s, i) => ({
          x: s.llm,
          y: s.human,
          delta: s.delta,
          reason: s.reason,
          name: `Sample ${i + 1}`,
        }))

        console.log(`Pearson Correlation = ${JSON.stringify(stat.correlation_pearson)}`)

        return (
          <div key={stat.metric_name} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h2 className="text-sm sm:text-lg font-semibold capitalize">{stat.metric_name.replace(/_/g, " ")}</h2>
              <Badge variant="outline" className="capitalize text-[9px] sm:text-xs">{stat.metric_name}</Badge>
              <MetricBiasIndicator biasDetected={stat.bias_detected} />
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-1 sm:pb-2">
                  <CardDescription className="text-[9px] sm:text-xs">Total Reviewed</CardDescription>
                  <CardTitle className="text-lg sm:text-2xl font-bold">{stat.total_reviewed}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[9px] sm:text-xs text-muted-foreground">samples</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 sm:pb-2">
                  <CardDescription className="text-[9px] sm:text-xs">Mean Human Score</CardDescription>
                  <CardTitle className={`text-lg sm:text-2xl font-bold ${stat.mean_human_score >= 0.8 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {(stat.mean_human_score * 100).toFixed(1)}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 text-[9px] sm:text-xs text-muted-foreground">
                    <TrendingUp className="size-3" />
                    LLM: {(stat.mean_llm_score * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 sm:pb-2">
                  <CardDescription className="text-[9px] sm:text-xs">Mean Absolute Error</CardDescription>
                  <CardTitle className={`text-lg sm:text-2xl font-bold ${stat.mean_absolute_error <= 0.05 ? "text-emerald-600 dark:text-emerald-400" : stat.mean_absolute_error <= 0.1 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>
                    {stat.mean_absolute_error.toFixed(3)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MaeBar value={stat.mean_absolute_error} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 sm:pb-2">
                  <CardDescription className="text-[9px] sm:text-xs">Pearson Correlation</CardDescription>
                  <CardTitle className={`text-lg sm:text-2xl font-bold ${stat.correlation_pearson !== null && stat.correlation_pearson >= 0.8 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {stat.correlation_pearson !== null ? stat.correlation_pearson.toFixed(2) : "N/A"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CorrelationBar value={stat.correlation_pearson} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
              {/* Scatter Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-sm sm:text-base">Human vs LLM Scores</CardTitle>
                  <CardDescription className="text-[10px] sm:text-sm">Scatter plot — ideal alignment is along the diagonal</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={scatterConfig} className="h-[240px] w-full">
                    <ScatterChart accessibilityLayer margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0, 1]}
                        name="LLM Score"
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "LLM", position: "insideBottomRight", offset: -5, fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        domain={[0, 1]}
                        name="Human Score"
                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "Human", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                      />
                      <ReferenceLine
                        segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.5}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) =>
                              `${name}: ${((value as number) * 100).toFixed(0)}%`
                            }
                          />
                        }
                      />
                      <Scatter
                        data={scatterData}
                        fill="var(--chart-1)"
                        fillOpacity={0.7}
                      />
                    </ScatterChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Samples Table */}
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2 sm:pb-6">
                  <CardTitle className="text-sm sm:text-base">Sample Disagreements</CardTitle>
                  <CardDescription className="text-[10px] sm:text-sm">Top {stat.samples.length} reviewed samples</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-14 sm:w-20 text-[9px] sm:text-xs">Human</TableHead>
                        <TableHead className="text-center w-14 sm:w-20 text-[9px] sm:text-xs">LLM</TableHead>
                        <TableHead className="text-center w-12 sm:w-16 text-[9px] sm:text-xs">Delta</TableHead>
                        <TableHead className="text-[9px] sm:text-xs">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stat.samples.map((sample, idx) => {
                        const delta = sample.human - sample.llm
                        const sign = delta >= 0 ? "+" : ""
                        const deltaColor =
                          Math.abs(delta) <= 0.05
                            ? "text-emerald-600 dark:text-emerald-400"
                            : Math.abs(delta) <= 0.15
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-destructive"
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-center font-mono text-[10px] sm:text-sm">
                              {(sample.human * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-center font-mono text-[10px] sm:text-sm">
                              {(sample.llm * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className={`text-center font-mono text-[10px] sm:text-sm font-semibold ${deltaColor}`}>
                              {sign}{(delta * 100).toFixed(0)}%
                            </TableCell>
                            <TableCell className="text-[9px] sm:text-xs text-muted-foreground whitespace-normal break-words align-top">
                              {sample.reason}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })}
    </div>
  )
}
