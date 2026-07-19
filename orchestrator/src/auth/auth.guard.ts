import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { RequestWithUser } from '../common/types';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    // Programmatic access: an x-api-key header authenticates as its owner.
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const user = apiKey
      ? await this.authService.validateApiKey(apiKey)
      : await this.authService.validateBearerToken(request.headers.authorization);
    if (!user) {
      throw new UnauthorizedException();
    }
    request.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestWithUser>();
  return req.user;
});
