import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';

const bodySchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(['admin', 'viewer']).default('viewer'),
});

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/mock-login')
  async mockLogin(@Body() body: unknown) {
    const parsed = bodySchema.parse(body);
    const { token, user } = await this.authService.createMockToken(
      parsed.email,
      parsed.displayName,
      parsed.role,
    );
    return { token, user };
  }
}
