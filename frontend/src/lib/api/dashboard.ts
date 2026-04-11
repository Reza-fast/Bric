export interface DashboardMetrics {
  activeProjects: number;
  totalHoursThisWeek: number;
  weekLabel: string;
  pendingReportsActionRequired: number;
}

export interface DashboardActivity {
  id: string;
  projectId: string;
  type: string;
  title: string;
  body: string | null;
  mediaUrls: string[];
  actorUserId: string | null;
  createdAt: string;
}

export interface ProjectHoursSummary {
  projectId: string;
  name: string;
  budgetedHours: number;
  actualHours: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface PlannedTask {
  id: string;
  projectId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPayload {
  metrics: DashboardMetrics;
  activities: DashboardActivity[];
  projectHours: ProjectHoursSummary[];
  weekTasks: PlannedTask[];
  weekRange: { start: string; end: string };
}

export async function fetchDashboard(): Promise<DashboardPayload | null> {
  try {
    const res = await fetch("/api/dashboard", {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as DashboardPayload;
  } catch {
    return null;
  }
}
