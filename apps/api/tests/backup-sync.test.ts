import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Clock } from '../src/application/ports/Clock';
import { ArchiveBackupItem } from '../src/application/backup/ArchiveBackupItem';
import { ListBackupItems } from '../src/application/backup/ListBackupItems';
import { SyncBackupItems, type SyncItemInput } from '../src/application/backup/SyncBackupItems';
import { DomainError } from '../src/domain/errors/DomainError';
import { MemoryBackupItemRepository } from '../src/infrastructure/persistence/memory/MemoryBackupItemRepository';

const clock: Clock = { now: () => new Date('2026-10-31T12:00:00.000Z') };
const noteId = '6f1b0b4e-6e3a-4c1d-9c2a-0d5a6b7c8d9e';
const taskId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const privateId = 'c3d4e5f6-a7b8-4901-8234-56789abcdef0';

function item(overrides: Partial<SyncItemInput> = {}): SyncItemInput {
  return {
    id: noteId,
    kind: 'note',
    title: 'Lista de la compra',
    body: 'leche',
    metadata: {},
    clientUpdatedAt: new Date('2026-10-31T11:00:00.000Z'),
    deleted: false,
    source: 'mobile',
    deviceLabel: 'pixel',
    ...overrides,
  };
}

describe('respaldo', () => {
  it('guarda lo que envía la app y no lo mezcla con otra cuenta', async () => {
    const repo = new MemoryBackupItemRepository();
    const sync = new SyncBackupItems(repo, clock);
    const list = new ListBackupItems(repo);

    await sync.execute('user-a', [item(), item({ id: taskId, kind: 'task', title: 'Llamar' })]);
    await sync.execute('user-b', [item({ id: privateId, title: 'Privado de B' })]);

    const page = await list.execute('user-a', { limit: 10, offset: 0 });
    assert.equal(page.total, 2);
    assert.deepEqual(
      page.items.map((entry) => entry.title).sort(),
      ['Lista de la compra', 'Llamar'],
    );

    await assert.rejects(
      () => sync.execute('user-b', [item({ id: taskId, title: 'Robado', clientUpdatedAt: new Date('2026-11-01T00:00:00.000Z') })]),
      (error: unknown) => error instanceof DomainError && error.code === 'ID_CONFLICT',
    );
  });

  it('ignora cambios viejos y aplica el más reciente, incluido el borrado', async () => {
    const repo = new MemoryBackupItemRepository();
    const sync = new SyncBackupItems(repo, clock);
    const list = new ListBackupItems(repo);

    await sync.execute('user-a', [item({ title: 'Versión nueva', clientUpdatedAt: new Date('2026-10-31T11:30:00.000Z') })]);
    const stale = await sync.execute('user-a', [item({ title: 'Versión vieja' })]);
    assert.deepEqual(stale, { applied: 0, skipped: 1 });

    const removed = await sync.execute('user-a', [
      item({
        title: 'Versión nueva',
        deleted: true,
        clientUpdatedAt: new Date('2026-10-31T11:45:00.000Z'),
      }),
    ]);
    assert.equal(removed.applied, 1);

    const visible = await list.execute('user-a', { limit: 10, offset: 0 });
    assert.equal(visible.total, 0);

    const archived = await list.execute('user-a', { limit: 10, offset: 0, includeDeleted: true });
    assert.equal(archived.items[0]?.isDeleted, true);
  });

  it('archivar desde la web deja un tombstone que la app puede respetar', async () => {
    const repo = new MemoryBackupItemRepository();
    const sync = new SyncBackupItems(repo, clock);
    const archive = new ArchiveBackupItem(repo, clock);
    await sync.execute('user-a', [item()]);

    const archived = await archive.execute('user-a', noteId);
    assert.equal(archived.isDeleted, true);
    assert.equal(archived.clientUpdatedAt.toISOString(), '2026-10-31T12:00:00.000Z');

    const replay = await sync.execute('user-a', [item()]);
    assert.deepEqual(replay, { applied: 0, skipped: 1 });
  });
});
