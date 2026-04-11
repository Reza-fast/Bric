import type { PlannedTask, PlannedTaskCreateInput } from "../domain/index.js";
import { PlannedTasksRepository } from "../repositories/plannedTasks.repository.js";

export class PlannedTaskService {
  constructor(private readonly tasks: PlannedTasksRepository) {}

  listInRange(start: Date, end: Date): Promise<PlannedTask[]> {
    return this.tasks.listInRange(start, end);
  }

  create(input: PlannedTaskCreateInput): Promise<PlannedTask> {
    return this.tasks.create(input);
  }
}
