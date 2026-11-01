import type { User } from '../../../domain/user/User';
import type { UserRepository } from '../../../application/ports/UserRepository';
import { UserModel } from './UserModel';

export class MongooseUserRepository implements UserRepository {
  async upsert(user: User): Promise<User> {
    await UserModel.updateOne(
      { _id: user.id },
      { $set: { email: user.email, lastSeenAt: user.lastSeenAt } },
      { upsert: true },
    );
    return user;
  }
}
