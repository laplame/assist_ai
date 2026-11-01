import type { BackupItemRepository, BackupListQuery, BackupPage } from '../ports/BackupItemRepository';

export class ListBackupItems {
  constructor(private readonly backupItems: BackupItemRepository) {}

  execute(ownerId: string, query: BackupListQuery): Promise<BackupPage> {
    return this.backupItems.list(ownerId, query);
  }
}
