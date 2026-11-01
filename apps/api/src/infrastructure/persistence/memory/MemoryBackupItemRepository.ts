import type { BackupItem } from '../../../domain/backup/BackupItem';
import { DomainError } from '../../../domain/errors/DomainError';
import type { BackupItemRepository, BackupListQuery, BackupPage } from '../../../application/ports/BackupItemRepository';

export class MemoryBackupItemRepository implements BackupItemRepository {
  private readonly items = new Map<string, BackupItem>();

  async list(ownerId: string, query: BackupListQuery): Promise<BackupPage> {
    const filtered = this.filtered(ownerId, query);
    return {
      items: filtered.slice(query.offset, query.offset + query.limit),
      total: filtered.length,
    };
  }

  async listAll(ownerId: string): Promise<BackupItem[]> {
    return this.filtered(ownerId, { includeDeleted: false });
  }

  async findById(ownerId: string, id: string): Promise<BackupItem | null> {
    const item = this.items.get(id);
    if (!item || item.ownerId !== ownerId) return null;
    return item;
  }

  async save(item: BackupItem): Promise<void> {
    const current = this.items.get(item.id);
    if (current && current.ownerId !== item.ownerId) {
      throw new DomainError('Ese id ya pertenece a otra cuenta', 'ID_CONFLICT', 409);
    }
    this.items.set(item.id, item);
  }

  private filtered(
    ownerId: string,
    query: { kind?: BackupListQuery['kind']; search?: string; includeDeleted?: boolean },
  ): BackupItem[] {
    const search = query.search?.trim().toLowerCase();
    return [...this.items.values()]
      .filter((item) => item.ownerId === ownerId)
      .filter((item) => query.includeDeleted || !item.isDeleted)
      .filter((item) => !query.kind || item.kind === query.kind)
      .filter((item) => {
        if (!search) return true;
        return item.title.toLowerCase().includes(search) || item.body.toLowerCase().includes(search);
      })
      .sort((a, b) => b.clientUpdatedAt.getTime() - a.clientUpdatedAt.getTime());
  }
}
