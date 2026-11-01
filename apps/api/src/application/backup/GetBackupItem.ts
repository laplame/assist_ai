import type { BackupItemRepository } from '../ports/BackupItemRepository';
import type { BackupItem } from '../../domain/backup/BackupItem';
import { DomainError } from '../../domain/errors/DomainError';

export class GetBackupItem {
  constructor(private readonly backupItems: BackupItemRepository) {}

  async execute(ownerId: string, id: string): Promise<BackupItem> {
    const item = await this.backupItems.findById(ownerId, id);
    if (!item) {
      throw new DomainError('No está en el respaldo', 'NOT_FOUND', 404);
    }
    return item;
  }
}
