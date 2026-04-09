import { getPool } from "./infrastructure/database.js";
import { ActivitiesRepository } from "./repositories/activities.repository.js";
import { PlannedTasksRepository } from "./repositories/plannedTasks.repository.js";
import { ProjectsRepository } from "./repositories/projects.repository.js";
import { ReportsRepository } from "./repositories/reports.repository.js";
import { TimeLogsRepository } from "./repositories/timeLogs.repository.js";
import { UsersRepository } from "./repositories/users.repository.js";
import { ActivityService } from "./services/activity.service.js";
import { DashboardService } from "./services/dashboard.service.js";
import { PlannedTaskService } from "./services/plannedTask.service.js";
import { ProjectService } from "./services/project.service.js";
import { TimeLogService } from "./services/timeLog.service.js";
import { UserService } from "./services/user.service.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { ProjectsController } from "./controllers/projects.controller.js";
import { TimeLogsController } from "./controllers/timeLogs.controller.js";

export function createAppContainer() {
  const pool = getPool();
  const projectsRepo = new ProjectsRepository(pool);
  const timeLogsRepo = new TimeLogsRepository(pool);
  const activitiesRepo = new ActivitiesRepository(pool);
  const reportsRepo = new ReportsRepository(pool);
  const plannedTasksRepo = new PlannedTasksRepository(pool);
  const usersRepo = new UsersRepository(pool);

  const projectService = new ProjectService(projectsRepo);
  const timeLogService = new TimeLogService(timeLogsRepo, projectsRepo);
  const activityService = new ActivityService(activitiesRepo);
  const plannedTaskService = new PlannedTaskService(plannedTasksRepo);
  const userService = new UserService(usersRepo);
  const dashboardService = new DashboardService(
    projectsRepo,
    timeLogsRepo,
    reportsRepo,
    activitiesRepo,
    plannedTasksRepo,
  );

  return {
    pool,
    services: {
      projectService,
      timeLogService,
      activityService,
      plannedTaskService,
      userService,
      dashboardService,
    },
    controllers: {
      dashboard: new DashboardController(dashboardService),
      projects: new ProjectsController(projectService),
      timeLogs: new TimeLogsController(timeLogService),
    },
  };
}
