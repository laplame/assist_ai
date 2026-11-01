import type { BackupItemRepository } from '../ports/BackupItemRepository';
import type { Clock } from '../ports/Clock';
import { BackupItem, type BackupKind, type BackupSource } from '../../domain/backup/BackupItem';

export interface SyncItemInput {
  id: string;
  kind: BackupKind;
  title: string;
  body: string;
  metadata: Record<string, string>;
  clientUpdatedAt: Date;
  deleted: boolean;
  source: BackupSource;
  deviceLabel: string | null;
}

export interface SyncBackupResult {
  applied: number;
  skipped: number;
}

export class SyncBackupItems {
  constructor(
    private readonly backupItems: BackupItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, items: SyncItemInput[]): Promise<SyncBackupResult> {
    const now = this.clock.now();
    let applied = 0;
    let skipped = 0;

    for (const input of items) {
      const existing = await this.backupItems.findById(ownerId, input.id);
      const incoming = BackupItem.create({
        id: input.id,
        ownerId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        metadata: input.metadata,
        source: input.source,
        deviceLabel: input.deviceLabel,
        clientUpdatedAt: input.clientUpdatedAt,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: input.deleted ? (existing?.deletedAt ?? input.clientUpdatedAt) : null,
      });

      if (existing && !incoming.isNewerThan(existing)) {
        skipped += 1;
        continue;
      }

      await this.backupItems.save(incoming);
      applied += 1;
    }

    return { applied, skipped };
  }
}
