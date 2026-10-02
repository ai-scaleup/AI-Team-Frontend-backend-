// src/admin/admin.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdminService } from './admin.service';

const toBool = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

class GetAgentsByEmailQuery {
  @IsEmail()
  email!: string;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  activeOnly?: boolean;
}

/**
 * User-level admin reads. Assignment CRUD lives in the tier that owns it:
 * /admin/single-agent-assignments, /admin/teams + /admin/team-assignments, and
 * /memberships. None of those tiers is reachable from here.
 */
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Directly assigned agents (single-agent tier) for a user by email. */
  @Get('agents-by-email')
  @ApiOperation({ summary: 'Get directly assigned agents for a user by email' })
  @ApiQuery({ name: 'email', required: true, example: 'user@example.com' })
  @ApiQuery({ name: 'activeOnly', required: false, example: true })
  @ApiOkResponse({ description: 'Assigned agents returned' })
  getAgentsByEmail(@Query() q: GetAgentsByEmailQuery) {
    return this.admin.getAgentsByEmail(q.email, q.activeOnly ?? true);
  }

  @Get('emails')
  @ApiOperation({ summary: 'List all user emails' })
  @ApiOkResponse({ description: 'Emails returned' })
  async listAllEmails(): Promise<{ email: string; name: string | null }[]> {
    return this.admin.listAllEmails();
  }

  /** List all registered users (admin panel) */
  @Get('users')
  @ApiOperation({ summary: 'List all registered users' })
  @ApiOkResponse({ description: 'Users returned' })
  async listAllUsers() {
    return this.admin.listAllUsers();
  }

  /** Get token/usage stats for a single user */
  @Get('users/:id/token-stats')
  @ApiOperation({ summary: 'Get token usage stats for a user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Token stats returned' })
  async getUserTokenStats(@Param('id') id: string) {
    return this.admin.getUserTokenStats(id);
  }
}
