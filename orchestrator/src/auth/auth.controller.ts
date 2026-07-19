import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { AuthUser } from '../common/types';
import { throwApiError } from '../common/errors';

const mockSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(['admin', 'viewer']).default('viewer'),
});

const signupSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  orgName: z.string().min(1).max(80).optional(),
  joinCode: z.string().min(1).max(16).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  async signup(@Body() body: unknown) {
    const parsed = signupSchema.parse(body);
    return this.authService.signup(parsed.email, parsed.displayName, parsed.password, parsed.orgName, parsed.joinCode);
  }

  @Post('/login')
  async login(@Body() body: unknown) {
    const parsed = loginSchema.parse(body);
    return this.authService.login(parsed.email, parsed.password);
  }

  @Post('/mock-login')
  async mockLogin(@Body() body: unknown) {
    if ((process.env.AUTH_MODE || 'xsuaa') !== 'mock') {
      throwApiError(404, 'VALIDATION_ERROR', 'mock login is disabled in this environment');
    }
    const parsed = mockSchema.parse(body);
    const { token, user } = await this.authService.createMockToken(
      parsed.email,
      parsed.displayName,
      parsed.role,
    );
    return { token, user };
  }

  // ---------- API keys (programmatic Otto access, Phase B) ----------

  @Get('/api-keys')
  @UseGuards(AuthGuard)
  listKeys(@CurrentUser() user: AuthUser) {
    return this.authService.listApiKeys(user.id);
  }

  @Post('/api-keys')
  @UseGuards(AuthGuard)
  createKey(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = z.object({ name: z.string().min(1).max(60) }).parse(body);
    return this.authService.createApiKey(user.id, parsed.name);
  }

  @Delete('/api-keys/:id')
  @UseGuards(AuthGuard)
  revokeKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.authService.revokeApiKey(user.id, id);
  }
}
