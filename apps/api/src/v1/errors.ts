export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function salarioBajoMinimo(minimoCentavos: number): ApiError {
  const pesos = (minimoCentavos / 100).toFixed(2);
  return new ApiError(`El salario pactado no puede ser menor al mínimo vigente ($${pesos})`, 'BAJO_MINIMO', 422);
}
