import type { BackupKind, BackupSource } from '../../../domain/backup/BackupItem';
import { BackupItem } from '../../../domain/backup/BackupItem';
import { DomainError } from '../../../domain/errors/DomainError';
import type { BackupItemRepository, BackupListQuery, BackupPage } from '../../../application/ports/BackupItemRepository';
import { BackupItemModel } from './BackupItemModel';

interface BackupItemRecord {
  _id: string;
  ownerId: string;
  kind: string;
  title: string;
  body: string;
  metadata?: unknown;
  source: string;
  deviceLabel?: string | null;
  clientUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class MongooseBackupItemRepository implements BackupItemRepository {
  async list(ownerId: string, query: BackupListQuery): Promise<BackupPage> {
    const filter = this.filter(ownerId, query);
    const [docs, total] = await Promise.all([
      BackupItemModel.find(filter)
        .sort({ clientUpdatedAt: -1 })
        .skip(query.offset)
        .limit(query.limit)
        .lean<BackupItemRecord[]>(),
      BackupItemModel.countDocuments(filter),
    ]);
    return { items: docs.map((doc) => toDomain(doc)), total };
  }

  async listAll(ownerId: string): Promise<BackupItem[]> {
    const docs = await BackupItemModel.find(this.filter(ownerId, { includeDeleted: false }))
      .sort({ clientUpdatedAt: -1 })
      .lean<BackupItemRecord[]>();
    return docs.map((doc) => toDomain(doc));
  }

  async findById(ownerId: string, id: string): Promise<BackupItem | null> {
    const doc = await BackupItemModel.findOne({ _id: id, ownerId }).lean<BackupItemRecord | null>();
    return doc ? toDomain(doc) : null;
  }

  async save(item: BackupItem): Promise<void> {
    const data = item.toJSON();
    const existing = await BackupItemModel.findById(data.id).select('ownerId').lean<{ ownerId: string } | null>();
    if (existing && existing.ownerId !== data.ownerId) {
      throw new DomainError('Ese id ya pertenece a otra cuenta', 'ID_CONFLICT', 409);
    }

    await BackupItemModel.updateOne(
      { _id: data.id },
      {
        $set: {
          ownerId: data.ownerId,
          kind: data.kind,
          title: data.title,
          body: data.body,
          metadata: data.metadata,
          source: data.source,
          deviceLabel: data.deviceLabel,
          clientUpdatedAt: data.clientUpdatedAt,
          updatedAt: data.updatedAt,
          deletedAt: data.deletedAt,
        },
        $setOnInsert: { createdAt: data.createdAt },
      },
      { upsert: true },
    );
  }

  private filter(ownerId: string, query: Pick<BackupListQuery, 'kind' | 'search' | 'includeDeleted'>) {
    const filter: Record<string, unknown> = { ownerId };
    if (!query.includeDeleted) filter.deletedAt = null;
    if (query.kind) filter.kind = query.kind;
    const search = query.search?.trim();
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: { $regex: safe, $options: 'i' } }, { body: { $regex: safe, $options: 'i' } }];
    }
    return filter;
  }
}

function toDomain(doc: BackupItemRecord): BackupItem {
  return BackupItem.create({
    id: doc._id,
    ownerId: doc.ownerId,
    kind: asKind(doc.kind),
    title: doc.title,
    body: doc.body ?? '',
    metadata: readMetadata(doc.metadata),
    source: asSource(doc.source),
    deviceLabel: doc.deviceLabel ?? null,
    clientUpdatedAt: new Date(doc.clientUpdatedAt),
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
  });
}

function asKind(value: string): BackupKind {
  if (value === 'note' || value === 'task' || value === 'contact') return value;
  throw new DomainError('Tipo de respaldo desconocido', 'INVALID_KIND', 500);
}

function asSource(value: string): BackupSource {
  if (value === 'mobile' || value === 'web') return value;
  throw new DomainError('Origen de respaldo desconocido', 'INVALID_SOURCE', 500);
}

function readMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
