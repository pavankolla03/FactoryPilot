import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestWithUser } from '../common/types';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException({
        error: { code: 'SCOPE_DENIED', message: 'Admin role required' },
      });
    }
    return true;
  }
}
