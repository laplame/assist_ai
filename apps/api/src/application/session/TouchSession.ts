import type { Clock } from '../ports/Clock';
import type { UserRepository } from '../ports/UserRepository';
import type { User } from '../../domain/user/User';

export class TouchSession {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: { id: string; email: string | null }): Promise<User> {
    return this.users.upsert({
      id: input.id,
      email: input.email,
      lastSeenAt: this.clock.now(),
    });
  }
}
