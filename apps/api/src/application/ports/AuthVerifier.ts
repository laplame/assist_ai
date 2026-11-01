export interface AuthenticatedUser {
  uid: string;
  email: string | null;
}

export interface AuthVerifier {
  verify(idToken: string): Promise<AuthenticatedUser>;
}
