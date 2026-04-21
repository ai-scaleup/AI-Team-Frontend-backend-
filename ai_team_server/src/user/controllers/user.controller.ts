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
} from '@nestjs/common';
import { z } from 'zod';
import { UserService } from '../services/user.service';
import {
  CreateUserDto,
  createUserSchema,
  UpdateUserDto,
  updateUserSchema,
} from '../schemas/user.schema';
import { ZodValidationPipe } from 'src/pipes/zod.validation.pipe';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // Create a new user
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createUserSchema))
    createUserDto: CreateUserDto,
  ) {
    return this.userService.createUser(createUserDto);
  }

  // Get all users
  @Get()
  async findAll() {
    try {
      return await this.userService.findAllUsers();
    } catch (err: any) {
      this.logger.error('findAllUsers failed', err?.message, err?.stack);
      throw new InternalServerErrorException(err?.message ?? 'Failed to fetch users');
    }
  }

  // Get a single user by ID
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findUserById(id);
  }

  // Update a user by ID
  @Patch(':id')
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
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteUser(id);
  }

  // Sync user from Clerk (upsert): creates user if not exists, updates if exists
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  sync(
    @Body(new ZodValidationPipe(z.object({
      oauthId: z.string().min(1),
      email: z.string().email(),
      username: z.string().optional(),
    })))
    body: { oauthId: string; email: string; username?: string },
  ) {
    return this.userService.syncUser(body.oauthId, body.email, body.username);
  }
}



