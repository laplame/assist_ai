import type { BackupItemRepository } from '../ports/BackupItemRepository';
import type { Clock } from '../ports/Clock';
import type { BackupItem } from '../../domain/backup/BackupItem';

export interface BackupExport {
  exportedAt: Date;
  items: BackupItem[];
}

export class ExportBackup {
  constructor(
    private readonly backupItems: BackupItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string): Promise<BackupExport> {
    const items = await this.backupItems.listAll(ownerId);
    return { exportedAt: this.clock.now(), items };
  }
}
