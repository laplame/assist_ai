export class DomainError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}
