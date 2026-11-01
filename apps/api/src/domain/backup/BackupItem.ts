import { DomainError } from '../errors/DomainError';

export const BACKUP_KINDS = ['note', 'task', 'contact'] as const;
export type BackupKind = (typeof BACKUP_KINDS)[number];
export type BackupSource = 'mobile' | 'web';

export interface BackupItemProps {
  id: string;
  ownerId: string;
  kind: BackupKind;
  title: string;
  body: string;
  metadata: Record<string, string>;
  source: BackupSource;
  deviceLabel: string | null;
  clientUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class BackupItem {
  private constructor(private readonly props: BackupItemProps) {}

  static create(props: BackupItemProps): BackupItem {
    const id = props.id.trim();
    const title = props.title.trim();
    if (!id) {
      throw new DomainError('El id es obligatorio', 'ID_REQUIRED', 400);
    }
    if (!title) {
      throw new DomainError('El título es obligatorio', 'TITLE_REQUIRED', 400);
    }
    if (Number.isNaN(props.clientUpdatedAt.getTime())) {
      throw new DomainError('Fecha de cambio inválida', 'INVALID_DATE', 400);
    }

    return new BackupItem({
      ...props,
      id,
      title,
      body: props.body,
      metadata: { ...props.metadata },
      deviceLabel: props.deviceLabel?.trim() || null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get kind(): BackupKind {
    return this.props.kind;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string {
    return this.props.body;
  }

  get metadata(): Record<string, string> {
    return { ...this.props.metadata };
  }

  get source(): BackupSource {
    return this.props.source;
  }

  get deviceLabel(): string | null {
    return this.props.deviceLabel;
  }

  get clientUpdatedAt(): Date {
    return this.props.clientUpdatedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  isNewerThan(other: BackupItem): boolean {
    return this.props.clientUpdatedAt.getTime() > other.clientUpdatedAt.getTime();
  }

  archive(now: Date): BackupItem {
    return BackupItem.create({
      ...this.props,
      metadata: { ...this.props.metadata },
      deletedAt: now,
      clientUpdatedAt: now,
      updatedAt: now,
    });
  }

  toJSON(): BackupItemProps {
    return {
      ...this.props,
      metadata: { ...this.props.metadata },
    };
  }
}
