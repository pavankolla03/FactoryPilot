import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
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
    return this.authService.signup(parsed.email, parsed.displayName, parsed.password);
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
}
