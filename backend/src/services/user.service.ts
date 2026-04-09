import type { User, UserCreateInput, UserUpdateInput } from "../domain/index.js";
import { UsersRepository } from "../repositories/users.repository.js";

export class UserService {
  constructor(private readonly users: UsersRepository) {}

  getById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  create(input: UserCreateInput): Promise<User> {
    return this.users.create(input);
  }

  update(id: string, input: UserUpdateInput): Promise<User | null> {
    return this.users.update(id, input);
  }
}
