import {
  LayoutDashboard,
  Layers,
  Gauge,
  Users,
  BarChart3,
  Settings,
  Activity,
  ChevronRight,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { Page } from "@/lib/types"

interface AppSidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems = [
  { id: "overview" as Page, label: "Overview", icon: LayoutDashboard },
  { id: "evaluations" as Page, label: "Evaluations", icon: Layers, badge: "2" },
  { id: "metrics" as Page, label: "Metrics", icon: Gauge },
  { id: "human-reviews" as Page, label: "Human Reviews", icon: Users, badge: "5" },
  { id: "calibration" as Page, label: "Calibration", icon: BarChart3 },
]

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <button onClick={() => onNavigate("overview")} className="w-full">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Activity className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none text-left">
                  <span className="font-semibold text-sm">RAG Eval Harness</span>
                  <span className="text-xs text-muted-foreground">Acme RAG Team</span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentPage === item.id || (currentPage === "evaluation-detail" && item.id === "evaluations")}
                    onClick={() => onNavigate(item.id)}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={currentPage === "settings"}
              onClick={() => onNavigate("settings")}
              tooltip="Settings"
            >
              <Settings />
              <span>Settings</span>
              <ChevronRight className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
