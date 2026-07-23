import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchMetrics, evaluateSingle } from "@/lib/api"
import type { Metric, Page } from "@/lib/types"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface NewEvaluationPageProps {
  onNavigate: (page: Page) => void
}

export function NewEvaluationPage({ onNavigate }: NewEvaluationPageProps) {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [query, setQuery] = useState("")
  const [response, setResponse] = useState("")
  const [contexts, setContexts] = useState("")
  const [groundTruth, setGroundTruth] = useState("")
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .catch((err) => toast.error("Failed to load metrics", { description: err.message }))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query || !response) {
      toast.error("Validation Error", { description: "Query and Response are required." })
      return
    }
    if (selectedMetrics.length === 0) {
      toast.error("Validation Error", { description: "Please select at least one metric." })
      return
    }

    setSubmitting(true)
    try {
      const contextList = contexts.split("\n").map((c) => c.trim()).filter((c) => c.length > 0)
      
      await evaluateSingle({
        metrics: selectedMetrics,
        item: {
          query,
          response,
          contexts: contextList,
          ground_truth: groundTruth || undefined,
        }
      })
      
      toast.success("Evaluation Started", { description: "The evaluation is running in the background." })
      onNavigate("evaluations")
    } catch (err: any) {
      toast.error("Evaluation Failed", { description: err.humanMessage?.() || err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMetric = (name: string) => {
    setSelectedMetrics((prev) => 
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">New Evaluation</h1>
        <p className="text-sm md:text-base text-muted-foreground">Run a single evaluation item against your metrics.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Evaluation Item</CardTitle>
            <CardDescription className="text-xs md:text-sm">Provide the query, model response, and context to evaluate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="query" className="text-sm md:text-base">Query <span className="text-red-500">*</span></Label>
              <Input 
                id="query" 
                placeholder="What is the user's question?" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="response" className="text-sm md:text-base">Model Response <span className="text-red-500">*</span></Label>
              <Textarea 
                id="response" 
                placeholder="The answer provided by your LLM" 
                className="min-h-[100px]"
                value={response} 
                onChange={(e) => setResponse(e.target.value)} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contexts" className="text-sm md:text-base">Contexts (One per line)</Label>
              <Textarea 
                id="contexts" 
                placeholder="Retrieved context chunks (optional)" 
                className="min-h-[100px]"
                value={contexts} 
                onChange={(e) => setContexts(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groundTruth" className="text-sm md:text-base">Ground Truth (Optional)</Label>
              <Textarea 
                id="groundTruth" 
                placeholder="The ideal or expected answer" 
                value={groundTruth} 
                onChange={(e) => setGroundTruth(e.target.value)} 
              />
            </div>

            <div className="space-y-2 pt-4">
              <Label className="text-sm md:text-base">Metrics to Evaluate <span className="text-red-500">*</span></Label>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading metrics...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`metric-${metric.id}`} 
                        checked={selectedMetrics.includes(metric.name)}
                        onCheckedChange={() => toggleMetric(metric.name)}
                      />
                      <Label htmlFor={`metric-${metric.id}`} className="font-normal cursor-pointer text-sm md:text-base">
                        {metric.name}
                        {metric.type === 'predefined' && <span className="ml-2 text-xs text-muted-foreground">(Predefined)</span>}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col-reverse sm:flex-row mt-4 justify-between gap-4 sm:gap-0">
            <Button variant="outline" type="button" className="w-full sm:w-auto" onClick={() => onNavigate("evaluations")}>Cancel</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting || loading}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating...</> : "Run Evaluation"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
