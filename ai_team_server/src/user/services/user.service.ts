import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from '../schemas/user.schema';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Create a new user
  async createUser(data: CreateUserDto): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // Get all users
  async findAllUsers(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get a single user by ID
  async findUserById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ 
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    return user;
  }

  // Update a user by ID
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    await this.findUserById(id); // Ensure user exists
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Delete a user by ID
  async deleteUser(id: string): Promise<void> {
    await this.findUserById(id); // Ensure user exists
    
    // This will cascade delete all related userData due to Prisma's referential actions
    await this.prisma.user.delete({
      where: { id },
    });
  }



  // Additional helper methods for OAuth-based operations
  async findUserByOauthId(oauthId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ 
      where: { oauthId },
    });
    if (!user) {
      throw new NotFoundException(`User with OAuth ID "${oauthId}" not found.`);
    }
    return user;
  }

  async updateUserByOauthId(oauthId: string, data: UpdateUserDto): Promise<User> {
    const user = await this.findUserByOauthId(oauthId);
    return this.prisma.user.update({
      where: { id: user.id },
      data,
    });
  }

  async deleteUserByOauthId(oauthId: string): Promise<void> {
    const user = await this.findUserByOauthId(oauthId);
    await this.prisma.user.delete({
      where: { id: user.id },
    });
  }
}