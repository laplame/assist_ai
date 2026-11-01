import type { BackupItemRepository } from '../ports/BackupItemRepository';
import type { Clock } from '../ports/Clock';
import type { BackupItem } from '../../domain/backup/BackupItem';
import { DomainError } from '../../domain/errors/DomainError';

export class ArchiveBackupItem {
  constructor(
    private readonly backupItems: BackupItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, id: string): Promise<BackupItem> {
    const existing = await this.backupItems.findById(ownerId, id);
    if (!existing) {
      throw new DomainError('No está en el respaldo', 'NOT_FOUND', 404);
    }
    const archived = existing.archive(this.clock.now());
    await this.backupItems.save(archived);
    return archived;
  }
}
