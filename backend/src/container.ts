import { AuthController } from "./controllers/auth.controller.js";
import { DashboardController } from "./controllers/dashboard.controller.js";
import { PlannedTasksController } from "./controllers/plannedTasks.controller.js";
import { ProjectsController } from "./controllers/projects.controller.js";
import { TimeLogsController } from "./controllers/timeLogs.controller.js";
import { getPool } from "./infrastructure/database.js";
import { ActivitiesRepository } from "./repositories/activities.repository.js";
import { PlannedTasksRepository } from "./repositories/plannedTasks.repository.js";
import { ProjectMembersRepository } from "./repositories/projectMembers.repository.js";
import { ProjectsRepository } from "./repositories/projects.repository.js";
import { ReportsRepository } from "./repositories/reports.repository.js";
import { TimeLogsRepository } from "./repositories/timeLogs.repository.js";
import { UsersRepository } from "./repositories/users.repository.js";
import { ActivityService } from "./services/activity.service.js";
import { AuthService } from "./services/auth.service.js";
import { ProfileService } from "./services/profile.service.js";
import { DashboardService } from "./services/dashboard.service.js";
import { PlannedTaskService } from "./services/plannedTask.service.js";
import { ProjectService } from "./services/project.service.js";
import { TimeLogService } from "./services/timeLog.service.js";
import { UserService } from "./services/user.service.js";

export function createAppContainer() {
  const pool = getPool();
  const projectsRepo = new ProjectsRepository(pool);
  const timeLogsRepo = new TimeLogsRepository(pool);
  const activitiesRepo = new ActivitiesRepository(pool);
  const reportsRepo = new ReportsRepository(pool);
  const plannedTasksRepo = new PlannedTasksRepository(pool);
  const usersRepo = new UsersRepository(pool);
  const membersRepo = new ProjectMembersRepository(pool);

  const projectService = new ProjectService(projectsRepo, membersRepo);
  const timeLogService = new TimeLogService(timeLogsRepo, projectsRepo, membersRepo);
  const activityService = new ActivityService(activitiesRepo);
  const plannedTaskService = new PlannedTaskService(plannedTasksRepo, projectsRepo);
  const userService = new UserService(usersRepo);
  const profileService = new ProfileService(usersRepo);
  const authService = new AuthService(usersRepo, membersRepo);
  const dashboardService = new DashboardService(
    projectsRepo,
    timeLogsRepo,
    reportsRepo,
    activitiesRepo,
    plannedTasksRepo,
    membersRepo,
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
      authService,
      profileService,
    },
    controllers: {
      dashboard: new DashboardController(dashboardService),
      projects: new ProjectsController(projectService),
      plannedTasks: new PlannedTasksController(plannedTaskService),
      timeLogs: new TimeLogsController(timeLogService),
      auth: new AuthController(authService, profileService),
    },
  };
}
