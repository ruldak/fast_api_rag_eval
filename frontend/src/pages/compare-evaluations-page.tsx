import { useState, useEffect, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { fetchEvaluationRuns, compareEvaluations } from "@/lib/api"
import type { EvaluationRun } from "@/lib/types"
import { toast } from "sonner"
import { Loader2, GitCompare } from "lucide-react"
import { format } from "date-fns"
import { Label } from "@/components/ui/label"

export function CompareEvaluationsPage() {
  const [runs, setRuns] = useState<EvaluationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<Record<string, any> | null>(null)

  useEffect(() => {
    fetchEvaluationRuns({ status: "completed" })
      .then((res) => setRuns(res.items))
      .catch((err) => toast.error("Failed to load evaluation runs", { description: err.message }))
      .finally(() => setLoading(false))
  }, [])

  const toggleRun = (runId: string) => {
    setSelectedRunIds((prev) => 
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    )
  }

  const handleCompare = async () => {
    if (selectedRunIds.length < 2) {
      toast.error("Selection Error", { description: "Please select at least two runs to compare." })
      return
    }

    setComparing(true)
    setComparisonResult(null)
    try {
      const res = await compareEvaluations({ run_ids: selectedRunIds })
      setComparisonResult(res.comparison)
    } catch (err: any) {
      toast.error("Comparison Failed", { description: err.humanMessage?.() || err.message })
    } finally {
      setComparing(false)
    }
  }

  // Transform comparison data into a table format
  // Rows = metrics, Columns = runs
  const tableData = useMemo(() => {
    if (!comparisonResult) return null

    const runIds = Object.keys(comparisonResult)
    const metricsSet = new Set<string>()

    runIds.forEach((id) => {
      const scores = comparisonResult[id].scores || {}
      Object.keys(scores).forEach((metric) => metricsSet.add(metric))
    })

    const metrics = Array.from(metricsSet).sort()

    return {
      runIds,
      metrics,
      rows: metrics.map((metric) => {
        const rowData: Record<string, any> = { metric }
        runIds.forEach((id) => {
          rowData[id] = comparisonResult[id].scores?.[metric] ?? null
        })
        return rowData
      })
    }
  }, [comparisonResult])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Compare Evaluations</h1>
        <p className="text-sm md:text-base text-muted-foreground">Select multiple completed evaluation runs to compare their metric scores side-by-side.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 flex flex-col h-[400px] md:h-[600px]">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Select Runs</CardTitle>
            <CardDescription className="text-xs md:text-sm">Choose at least two runs</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
              </div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No completed runs found.</div>
            ) : (
              runs.map((run) => (
                <div key={run.run_id} className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent">
                  <Checkbox 
                    id={`run-${run.run_id}`} 
                    checked={selectedRunIds.includes(run.run_id)}
                    onCheckedChange={() => toggleRun(run.run_id)}
                    className="mt-1"
                  />
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor={`run-${run.run_id}`} className="font-medium cursor-pointer text-xs md:text-sm">
                      {format(new Date(run.created_at), "MMM d, yyyy HH:mm")}
                    </Label>
                    <div className="text-[10px] md:text-xs text-muted-foreground truncate w-[140px]" title={run.run_id}>
                      {run.run_id}
                    </div>
                    {run.metadata?.model_tested && (
                      <Badge variant="secondary" className="w-fit text-[10px] px-1 py-0 h-4">
                        {String(run.metadata.model_tested)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
          <div className="p-4 border-t">
            <Button className="w-full" onClick={handleCompare} disabled={selectedRunIds.length < 2 || comparing}>
              {comparing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comparing...</> : <><GitCompare className="mr-2 h-4 w-4" /> Compare Selected</>}
            </Button>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Comparison Results</CardTitle>
            <CardDescription className="text-xs md:text-sm">Side-by-side metric score comparison</CardDescription>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            {!tableData ? (
              <div className="text-center p-10 text-muted-foreground border border-dashed rounded-lg">
                Select runs and click Compare to see results here.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[100px] sm:min-w-[200px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[0px] md:w-[0px] sm:p-2 md:p-1 text-xs md:text-sm">Metric</TableHead>
                      {tableData.runIds.map((id) => {
                        const r = runs.find((x) => x.run_id === id)
                        const model = r?.metadata?.model_tested
                        return (
                          <TableHead key={id} className="text-center p-1 md:p-1">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-normal text-muted-foreground truncate w-[60px]" title={id}>
                                {id.split('-')[0]}...
                              </span>
                              {model && <Badge variant="outline" className="text-[10px]">{String(model)}</Badge>}
                            </div>
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tableData.runIds.length + 1} className="text-center py-6 text-muted-foreground">
                          No metric scores found for the selected runs.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableData.rows.map((row) => (
                        <TableRow key={row.metric}>
                          <TableCell className="font-medium text-xs md:text-sm sm:p-1 md:p-1">{row.metric}</TableCell>
                          {tableData.runIds.map((id) => {
                            const val = row[id]
                            return (
                              <TableCell key={id} className="text-center font-mono text-xs md:text-sm p-1 md:p-3">
                                {val !== null && val !== undefined ? Number(val).toFixed(3) : "-"}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
