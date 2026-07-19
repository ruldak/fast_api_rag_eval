import { useState, useEffect } from "react"
import { CheckCircle2, Bot, User, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { useApi } from "@/lib/api-context"
import { fetchHumanReviewSamples, submitHumanReview, fetchMetrics } from "@/lib/api"
import type { HumanReviewSample, Metric } from "@/lib/types"
import { toast } from "sonner"

interface ReviewState {
  score: number
  reason: string
  submitted: boolean
}

function getSampleKey(sample: HumanReviewSample) {
  return `${sample.item_id}::${sample.metric_name}`
}

function ScoreBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colorClass =
    value >= 0.85
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      : value >= 0.7
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border-0 ${colorClass}`}>
      {pct}%
    </span>
  )
}

function AgreementDelta({ human, llm }: { human: number; llm: number }) {
  const delta = human - llm
  const sign = delta >= 0 ? "+" : ""
  const colorClass =
    Math.abs(delta) <= 0.05
      ? "text-emerald-600 dark:text-emerald-400"
      : Math.abs(delta) <= 0.15
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive"
  return (
    <span className={`text-xs font-mono font-semibold ${colorClass}`}>
      {sign}{(delta * 100).toFixed(0)}%
    </span>
  )
}

export function HumanReviewsPage() {
  const { apiKey } = useApi()
  const [samples, setSamples] = useState<HumanReviewSample[]>([])
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Metric[]>([])

  useEffect(() => {
    if (!apiKey) { setLoading(false); return }
    Promise.all([
      fetchHumanReviewSamples().catch(() => []),
      fetchMetrics().catch(() => []),
    ]).then(([s, m]) => {
      setSamples(s)
      setMetrics(m)
      if (s.length > 0) setActiveKey(getSampleKey(s[0]))
    }).finally(() => setLoading(false))
  }, [apiKey])

  const initReview = (sampleKey: string) => {
    if (!reviews[sampleKey]) {
      const sample = samples.find((s) => getSampleKey(s) === sampleKey)
      setReviews((prev) => ({
        ...prev,
        [sampleKey]: { score: sample?.llm_score ?? 0.5, reason: "", submitted: false },
      }))
    }
  }

  const setScore = (sampleKey: string, score: number) => {
    setReviews((prev) => ({ ...prev, [sampleKey]: { ...prev[sampleKey], score } }))
  }

  const setReason = (sampleKey: string, reason: string) => {
    setReviews((prev) => ({ ...prev, [sampleKey]: { ...prev[sampleKey], reason } }))
  }

  const submit = async (sampleKey: string) => {
    const sample = samples.find((s) => getSampleKey(s) === sampleKey)
    const review = reviews[sampleKey]
    if (!sample || !review) return

    const metric = metrics.find((m) => m.name === sample.metric_name)
    if (!metric) {
      toast.error("Metric not found. Cannot submit review.")
      return
    }

    try {
      await submitHumanReview({
        item_id: sample.item_id,
        metric_id: metric.id,
        human_score: review.score,
        human_reason: review.reason || undefined,
        reviewer_id: "dashboard_user",
      })
      setReviews((prev) => ({ ...prev, [sampleKey]: { ...prev[sampleKey], submitted: true } }))
      toast.success("Review submitted!")
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit review")
    }
  }

  const pending = samples.filter((s) => !reviews[getSampleKey(s)]?.submitted)
  const done = samples.filter((s) => reviews[getSampleKey(s)]?.submitted)

  if (!apiKey) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Human Reviews</h1>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Please set your API key in Settings to access human reviews.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Human Reviews</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading ? "Loading..." : `${pending.length} items pending review · ${done.length} completed`}
        </p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Review Progress</span>
            <span className="text-sm text-muted-foreground">{done.length} / {samples.length}</span>
          </div>
          <Progress
            value={samples.length > 0 ? (done.length / samples.length) * 100 : 0}
            className="h-2 [&>div]:bg-emerald-500"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Queue */}
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Queue</h2>
          <div className="flex flex-col gap-1.5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading samples...</p>
            ) : samples.length === 0 ? (
              <p className="text-sm text-muted-foreground">No samples to review.</p>
            ) : (
              samples.map((sample) => {
                const sampleKey = getSampleKey(sample)
                const isDone = reviews[sampleKey]?.submitted
                const isActive = activeKey === sampleKey
                return (
                  <button
                    key={sampleKey}
                    onClick={() => { setActiveKey(sampleKey); initReview(sampleKey) }}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${isActive ? "border-ring bg-accent" : "hover:bg-muted/50"} ${isDone ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">{sample.metric_name.replace(/_/g, " ")}</Badge>
                      {isDone ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 ml-auto" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{sample.query}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Bot className="size-3 text-muted-foreground" />
                      <ScoreBadge value={sample.llm_score} />
                      {isDone && reviews[sampleKey] && (
                        <>
                          <User className="size-3 text-muted-foreground ml-1" />
                          <ScoreBadge value={reviews[sampleKey].score} />
                        </>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Review Panel */}
        <div className="lg:col-span-2">
          {activeKey ? (
            <ReviewPanel
              sample={samples.find((s) => getSampleKey(s) === activeKey)!}
              review={reviews[activeKey] ?? { score: 0.5, reason: "", submitted: false }}
              onScoreChange={(s) => setScore(activeKey, s)}
              onReasonChange={(r) => setReason(activeKey, r)}
              onSubmit={() => submit(activeKey)}
              onInit={() => initReview(activeKey)}
            />
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                {loading ? "Loading..." : "Select an item from the queue to review"}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

interface ReviewPanelProps {
  sample: HumanReviewSample
  review: ReviewState
  onScoreChange: (score: number) => void
  onReasonChange: (reason: string) => void
  onSubmit: () => void
  onInit: () => void
}

function ReviewPanel({ sample, review, onScoreChange, onReasonChange, onSubmit, onInit }: ReviewPanelProps) {
  if (!review) { onInit(); return null }

  const delta = review.score - sample.llm_score
  const sign = delta >= 0 ? "+" : ""
  const deltaColor =
    Math.abs(delta) <= 0.05
      ? "text-emerald-600 dark:text-emerald-400"
      : Math.abs(delta) <= 0.15
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Review Item</CardTitle>
          <Badge variant="outline" className="capitalize">{sample.metric_name.replace(/_/g, " ")}</Badge>
        </div>
        <CardDescription className="font-mono text-xs">{sample.item_id}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Content */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Query</p>
            <p className="text-sm">{sample.query}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm">{sample.response}</p>
            </div>
          </div>
          {sample.contexts?.[0] && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Context</p>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{sample.contexts[0]}</p>
              </div>
            </div>
          )}
          {sample.ground_truth && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Ground Truth</p>
              <p className="text-sm font-medium">{sample.ground_truth}</p>
            </div>
          )}
        </div>

        {/* LLM Score */}
        <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">LLM Evaluation</span>
            <ScoreBadge value={sample.llm_score} />
          </div>
          <p className="text-xs text-muted-foreground">{sample.llm_reason}</p>
        </div>

        {/* Human Score Input */}
        {review.submitted ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Review submitted</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Your score: </span>
                <span className="font-semibold">{(review.score * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Agreement delta: </span>
                <AgreementDelta human={review.score} llm={sample.llm_score} />
              </div>
            </div>
            {review.reason && (
              <p className="text-xs text-muted-foreground mt-2">{review.reason}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  <Label className="text-sm">Your Score</Label>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-bold ${review.score >= 0.85 ? "text-emerald-600 dark:text-emerald-400" : review.score >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}
                  >
                    {(review.score * 100).toFixed(0)}%
                  </span>
                  <span className={`text-xs font-mono ${deltaColor}`}>
                    ({sign}{(delta * 100).toFixed(0)}% vs LLM)
                  </span>
                </div>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[review.score]}
                onValueChange={([v]) => onScoreChange(v)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Reason (optional)</Label>
              <Textarea
                value={review.reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Explain your score…"
                className="min-h-[70px] text-sm"
              />
            </div>
            <Button onClick={onSubmit} className="w-full gap-1.5">
              <CheckCircle2 className="size-4" /> Submit Review
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}