import { useState } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { OverviewPage } from "@/pages/overview-page"
import { EvaluationsPage, EvaluationDetailPage } from "@/pages/evaluations-page"
import { MetricsPage } from "@/pages/metrics-page"
import { HumanReviewsPage } from "@/pages/human-reviews-page"
import { CalibrationPage } from "@/pages/calibration-page"
import { SettingsPage } from "@/pages/settings-page"
import { NewEvaluationPage } from "@/pages/new-evaluation-page"
import { CompareEvaluationsPage } from "@/pages/compare-evaluations-page"
import { ApiProvider } from "@/lib/api-context"
import { Toaster } from "@/components/ui/sonner"
import type { Page } from "@/lib/types"

const pageTitles: Record<Page, string> = {
  overview: "Overview",
  evaluations: "Evaluations",
  "evaluation-detail": "Run Details",
  "new-evaluation": "New Evaluation",
  "compare-evaluations": "Compare Evaluations",
  metrics: "Metrics",
  "human-reviews": "Human Reviews",
  calibration: "Calibration",
  settings: "Settings",
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("overview")
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const navigate = (page: Page, runId?: string) => {
    setCurrentPage(page)
    if (runId) setSelectedRunId(runId)
  }

  return (
    <ApiProvider>
      <Toaster position="top-right" richColors />
      <SidebarProvider>
        <AppSidebar currentPage={currentPage} onNavigate={navigate} />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-medium flex-1">{pageTitles[currentPage]}</span>
            <ModeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {currentPage === "overview" && <OverviewPage onNavigate={navigate} />}
            {currentPage === "evaluations" && <EvaluationsPage onNavigate={navigate} />}
            {currentPage === "evaluation-detail" && selectedRunId && (
              <EvaluationDetailPage runId={selectedRunId} onBack={() => setCurrentPage("evaluations")} />
            )}
            {currentPage === "new-evaluation" && <NewEvaluationPage onNavigate={navigate} />}
            {currentPage === "compare-evaluations" && <CompareEvaluationsPage />}
            {currentPage === "metrics" && <MetricsPage />}
            {currentPage === "human-reviews" && <HumanReviewsPage />}
            {currentPage === "calibration" && <CalibrationPage />}
            {currentPage === "settings" && <SettingsPage />}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ApiProvider>
  )
}
