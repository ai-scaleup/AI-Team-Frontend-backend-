import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PearlAdminAccessGuard } from './pearl-admin-access.guard';
import { PearlAdminService } from './pearl-admin.service';

type CreateByEmailBody = {
  email: string;
  campaignName: string;
  outboundId: string;
  bearerToken: string;
};

type CreateByIdBody = Omit<CreateByEmailBody, 'email'> & { userId: string };

type UpdateUserDataBody = Partial<
  Pick<CreateByEmailBody, 'campaignName' | 'outboundId' | 'bearerToken'>
>;

@Controller('pearl-admin')
@UseGuards(PearlAdminAccessGuard)
export class PearlAdminController {
  constructor(private readonly pearlAdmin: PearlAdminService) {}

  @Get('users')
  listUsers(
    @Query()
    query: {
      page?: string;
      limit?: string;
      search?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    return this.pearlAdmin.listUsers(query);
  }

  @Get('users/count')
  countUsers() {
    return this.pearlAdmin.request('/admin/users/count');
  }

  @Get('users/:userId/user-data')
  listUserRecords(@Param('userId') userId: string) {
    return this.pearlAdmin.request(
      `/admin/users/${encodeURIComponent(userId)}/user-data`,
    );
  }

  @Get('user-data/:id')
  getUserData(@Param('id') id: string) {
    return this.pearlAdmin.request(
      `/admin/user-data/${encodeURIComponent(id)}`,
    );
  }

  @Post('user-data')
  createUserData(@Body() body: CreateByIdBody) {
    return this.pearlAdmin.request('/admin/user-data', {
      method: 'POST',
      body,
    });
  }

  @Post('user-data/by-email')
  createUserDataByEmail(@Body() body: CreateByEmailBody) {
    return this.pearlAdmin.request('/admin/user-data/by-email', {
      method: 'POST',
      body,
    });
  }

  @Patch('user-data/:id')
  updateUserData(@Param('id') id: string, @Body() body: UpdateUserDataBody) {
    return this.pearlAdmin.request(
      `/admin/user-data/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body,
      },
    );
  }

  @Delete('user-data/:id')
  deleteUserData(@Param('id') id: string) {
    return this.pearlAdmin.request(
      `/admin/user-data/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
  }
}
