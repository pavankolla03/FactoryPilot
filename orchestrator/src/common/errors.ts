import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError } from '@manufacturing-agent/shared';

export function throwApiError(
  status: number,
  code: ApiError['error']['code'],
  message: string,
): never {
  throw new HttpException({ error: { code, message } }, status);
}

export function scopeDenied(message = 'Warehouse scope denied'): never {
  return throwApiError(HttpStatus.FORBIDDEN, 'SCOPE_DENIED', message);
}

export function quotaExceeded(resetDate: string): never {
  return throwApiError(
    HttpStatus.TOO_MANY_REQUESTS,
    'QUOTA_EXCEEDED',
    `quota exceeded, resets on ${resetDate}`,
  );
}

export function actionExpired(): never {
  return throwApiError(HttpStatus.GONE, 'ACTION_EXPIRED', 'pending action expired or already consumed');
}

export function validationError(message: string): never {
  return throwApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);
}
