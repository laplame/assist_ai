import type { BackupItem, BackupKind } from '../../domain/backup/BackupItem';

export interface BackupListQuery {
  kind?: BackupKind;
  search?: string;
  includeDeleted?: boolean;
  limit: number;
  offset: number;
}

export interface BackupPage {
  items: BackupItem[];
  total: number;
}

export interface BackupItemRepository {
  list(ownerId: string, query: BackupListQuery): Promise<BackupPage>;
  listAll(ownerId: string): Promise<BackupItem[]>;
  findById(ownerId: string, id: string): Promise<BackupItem | null>;
  save(item: BackupItem): Promise<void>;
}
