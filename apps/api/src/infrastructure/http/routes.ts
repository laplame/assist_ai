import { Router, type Request } from 'express';
import type { Container } from '../../composition/container';
import { DomainError } from '../../domain/errors/DomainError';
import type { AuthenticatedUser } from '../../application/ports/AuthVerifier';
import { asyncHandler } from './asyncHandler';
import { requireAuth } from './requireAuth';
import { idParamSchema, listQuerySchema, syncBodySchema } from './schemas';
import { toBackupDto } from './backupDto';

export function apiRouter(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.auth));

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const user = await container.touchSession.execute({ id: authUser.uid, email: authUser.email });
      res.json({
        id: user.id,
        email: user.email,
        lastSeenAt: user.lastSeenAt.toISOString(),
      });
    }),
  );

  router.get(
    '/backup',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const query = listQuerySchema.parse(req.query);
      const page = await container.listBackup.execute(authUser.uid, {
        kind: query.kind,
        search: query.search,
        includeDeleted: query.includeDeleted === 'true',
        limit: query.limit,
        offset: query.offset,
      });
      res.json({
        items: page.items.map(toBackupDto),
        total: page.total,
        limit: query.limit,
        offset: query.offset,
      });
    }),
  );

  router.get(
    '/backup/export',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const exported = await container.exportBackup.execute(authUser.uid);
      res.json({
        exportedAt: exported.exportedAt.toISOString(),
        count: exported.items.length,
        items: exported.items.map(toBackupDto),
      });
    }),
  );

  router.get(
    '/backup/:id',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const { id } = idParamSchema.parse(req.params);
      const item = await container.getBackup.execute(authUser.uid, id);
      res.json(toBackupDto(item));
    }),
  );

  router.post(
    '/backup/sync',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const body = syncBodySchema.parse(req.body);
      const result = await container.syncBackup.execute(
        authUser.uid,
        body.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          body: item.body,
          metadata: item.metadata,
          clientUpdatedAt: new Date(item.clientUpdatedAt),
          deleted: item.deleted,
          source: 'mobile',
          deviceLabel: body.deviceLabel ?? null,
        })),
      );
      res.json(result);
    }),
  );

  router.delete(
    '/backup/:id',
    asyncHandler(async (req, res) => {
      const authUser = currentUser(req);
      const { id } = idParamSchema.parse(req.params);
      const item = await container.archiveBackup.execute(authUser.uid, id);
      res.json(toBackupDto(item));
    }),
  );

  return router;
}

function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new DomainError('Token requerido', 'UNAUTHENTICATED', 401);
  }
  return req.user;
}
