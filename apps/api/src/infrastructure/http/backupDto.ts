import type { BackupItem } from '../../domain/backup/BackupItem';

export function toBackupDto(item: BackupItem) {
  const data = item.toJSON();
  return {
    id: data.id,
    ownerId: data.ownerId,
    kind: data.kind,
    title: data.title,
    body: data.body,
    metadata: data.metadata,
    source: data.source,
    deviceLabel: data.deviceLabel,
    clientUpdatedAt: data.clientUpdatedAt.toISOString(),
    createdAt: data.createdAt.toISOString(),
    updatedAt: data.updatedAt.toISOString(),
    deletedAt: data.deletedAt ? data.deletedAt.toISOString() : null,
  };
}
