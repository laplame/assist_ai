import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { AuthenticatedUser, AuthVerifier } from '../../application/ports/AuthVerifier';

export interface FirebaseCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export class FirebaseAuthVerifier implements AuthVerifier {
  constructor(credentials: FirebaseCredentials) {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async verify(idToken: string): Promise<AuthenticatedUser> {
    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
    };
  }
}
