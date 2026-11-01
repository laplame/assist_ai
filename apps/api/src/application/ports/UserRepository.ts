import type { User } from '../../domain/user/User';

export interface UserRepository {
  upsert(user: User): Promise<User>;
}
