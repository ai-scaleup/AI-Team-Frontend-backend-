import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import {
  CreateUserDto,
  createUserSchema,
  ListUsersQueryDto,
  listUsersQuerySchema,
  UpdateUserDto,
  updateUserSchema,
} from '../schemas/user.schema';
import { ZodValidationPipe } from 'src/pipes/zod.validation.pipe';

@ApiTags('users')
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // Create a new user
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'oauthId'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        oauthId: { type: 'string', example: 'user_2abc123' },
        username: { type: 'string', example: 'Jane Doe' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'User created' })
  create(
    @Body(new ZodValidationPipe(createUserSchema))
    createUserDto: CreateUserDto,
  ) {
    return this.userService.createUser(createUserDto);
  }

  // Get all users
  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number, starting at 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Users per page, max 100',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by email, username, membership, group, or agent',
  })
  @ApiQuery({
    name: 'usageFrom',
    required: false,
    type: String,
    description: 'Inclusive ISO date/time lower bound for token usage totals',
  })
  @ApiQuery({
    name: 'usageTo',
    required: false,
    type: String,
    description: 'Inclusive ISO date/time upper bound for token usage totals',
  })
  @ApiQuery({
    name: 'membership',
    required: false,
    type: String,
    description:
      'Filter by membership template name, or "none" for users without an active membership',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'expiring', 'expired'],
    description: 'Filter by access status',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'duration', 'monthly', 'weekly', 'daily'],
    description: 'Field to sort the full result set by (default createdAt)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction (default desc)',
  })
  @ApiOkResponse({
    description: 'Users returned',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 42 },
            totalPages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPreviousPage: { type: 'boolean', example: false },
            summary: {
              type: 'object',
              properties: {
                monthlyTokens: { type: 'integer', example: 1100000 },
                monthlyInputTokens: { type: 'integer', example: 700000 },
                monthlyOutputTokens: { type: 'integer', example: 400000 },
                assignedLimitTokens: { type: 'integer', example: 5000000 },
              },
            },
          },
        },
      },
    },
  })
  async findAll(
    @Query(new ZodValidationPipe(listUsersQuerySchema))
    query: ListUsersQueryDto,
  ) {
    try {
      return await this.userService.findAllUsers(query);
    } catch (err: any) {
      this.logger.error('findAllUsers failed', err?.message, err?.stack);
      throw new InternalServerErrorException(
        err?.message ?? 'Failed to fetch users',
      );
    }
  }

  // Get a single user by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'User returned' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findUserById(id);
  }

  // Update a user by ID
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'Jane Doe' },
      },
    },
  })
  @ApiOkResponse({ description: 'User updated' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema))
    updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }

  // Delete a user by ID
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user by UUID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'User deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteUser(id);
  }

  // Sync user from Clerk (upsert): creates user if not exists, updates if exists
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync or upsert a Clerk user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['oauthId', 'email'],
      properties: {
        oauthId: { type: 'string', example: 'user_2abc123' },
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        username: { type: 'string', example: 'Jane Doe' },
      },
    },
  })
  @ApiOkResponse({ description: 'User synced' })
  sync(
    @Body(
      new ZodValidationPipe(
        z.object({
          oauthId: z.string().min(1),
          email: z.string().email(),
          username: z.string().optional(),
        }),
      ),
    )
    body: {
      oauthId: string;
      email: string;
      username?: string;
    },
  ) {
    return this.userService.syncUser(body.oauthId, body.email, body.username);
  }

  @Get(':oauthId/alerts')
  @ApiOperation({ summary: 'List alerts for a user by OAuth ID' })
  @ApiParam({ name: 'oauthId', example: 'user_2abc123' })
  @ApiOkResponse({ description: 'Alerts returned' })
  getAlerts(@Param('oauthId') oauthId: string) {
    return this.userService.getAlerts(oauthId);
  }

  @Patch('alerts/:alertId/dismiss')
  @ApiOperation({ summary: 'Dismiss a user alert' })
  @ApiParam({ name: 'alertId' })
  @ApiOkResponse({ description: 'Alert dismissed' })
  dismissAlert(@Param('alertId') alertId: string) {
    return this.userService.dismissAlert(alertId);
  }
}
