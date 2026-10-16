import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActivateCustomerDto,
  AddPoolDto,
  AdjustSeatsDto,
  AgencyService,
  CreateAgencyDto,
  InviteStaffDto,
  SubstituteCustomerDto,
  UpdateAgencyDto,
  UpdatePoolDto,
} from './agency.service';
import { callerEmail } from './caller-email';
import { AgencyWhiteLabelService } from './agency-white-label.service';

const dateField = { type: 'string', format: 'date', example: '2027-10-14' };

/**
 * Agencies (superadmin). Records only: a customer on a seat does not get
 * chat access from these routes yet. There is no delete anywhere — agencies
 * and customers are archived, the seat ledger and activity log only grow.
 */
@ApiTags('Agencies')
@Controller('admin/agencies')
export class AgencyController {
  constructor(
    private readonly service: AgencyService,
    private readonly prisma: PrismaService,
    private readonly whiteLabel: AgencyWhiteLabelService,
  ) {}

  /** Who is acting, for the ledger and activity log. */
  private async actor(req: Request): Promise<string> {
    const email = await callerEmail(req, this.prisma);
    if (email) return email;
    return (req.auth as { isDevToken?: boolean } | undefined)?.isDevToken
      ? 'dev-token'
      : 'unknown';
  }

  @Get()
  @ApiOperation({ summary: 'List agencies that are not archived' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'One agency with its seat ledger and activity log' })
  @ApiParam({ name: 'id', format: 'uuid' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an agency, its owner and a first seat pool',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'ownerName',
        'ownerEmail',
        'agencyMembershipId',
        'seats',
        'validUntil',
      ],
      properties: {
        name: { type: 'string', example: 'Studio Zeta Digital' },
        ownerName: { type: 'string', example: 'Marco Bellini' },
        ownerEmail: { type: 'string', example: 'marco@studiozeta.it' },
        country: { type: 'string', example: 'Italy' },
        agencyMembershipId: { type: 'string', format: 'uuid' },
        seats: { type: 'integer', minimum: 1, example: 10 },
        validFrom: { ...dateField, description: 'Defaults to today.' },
        validUntil: { ...dateField, description: 'Inclusive.' },
        note: { type: 'string', example: 'INV-2026-0450' },
      },
    },
  })
  async create(@Body() body: CreateAgencyDto, @Req() req: Request) {
    return this.service.create(body, await this.actor(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agency (name, owner, country, status)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ownerName: { type: 'string' },
        ownerEmail: { type: 'string' },
        country: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['ACTIVE', 'GRACE', 'SUSPENDED'] },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAgencyDto,
    @Req() req: Request,
  ) {
    return this.service.update(id, body, await this.actor(req));
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archive an agency',
    description:
      'Hides it. Refused while customers hold seats. Nothing is deleted.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async archive(@Param('id') id: string, @Req() req: Request) {
    return this.service.archive(id, await this.actor(req));
  }

  @Post(':id/pools')
  @ApiOperation({ summary: 'Add a seat pool to an agency' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agencyMembershipId', 'seats', 'validUntil'],
      properties: {
        agencyMembershipId: { type: 'string', format: 'uuid' },
        seats: { type: 'integer', minimum: 1 },
        validFrom: dateField,
        validUntil: dateField,
        note: { type: 'string' },
      },
    },
  })
  async addPool(
    @Param('id') id: string,
    @Body() body: AddPoolDto,
    @Req() req: Request,
  ) {
    return this.service.addPool(id, body, await this.actor(req));
  }

  @Patch(':id/pools/:poolId')
  @ApiOperation({ summary: "Change a seat pool's end date (renew or shorten)" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'poolId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['validUntil'],
      properties: { validUntil: dateField },
    },
  })
  async updatePool(
    @Param('id') id: string,
    @Param('poolId') poolId: string,
    @Body() body: UpdatePoolDto,
    @Req() req: Request,
  ) {
    return this.service.updatePool(id, poolId, body, await this.actor(req));
  }

  @Post(':id/pools/:poolId/seats')
  @ApiOperation({
    summary: 'Grant or remove seats (one ledger line)',
    description: 'A reduction below the seats in use is refused.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'poolId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['change', 'reason'],
      properties: {
        change: {
          type: 'integer',
          example: 3,
          description: 'Negative removes seats.',
        },
        reason: { type: 'string', example: 'Agency bought more seats' },
        note: { type: 'string', example: 'INV-2026-0431' },
      },
    },
  })
  async adjustSeats(
    @Param('id') id: string,
    @Param('poolId') poolId: string,
    @Body() body: AdjustSeatsDto,
    @Req() req: Request,
  ) {
    return this.service.adjustSeats(id, poolId, body, await this.actor(req));
  }

  @Post(':id/customers')
  @ApiOperation({ summary: 'Put a customer on a free seat' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['company', 'email', 'poolId'],
      properties: {
        company: { type: 'string', example: 'Rossi Dental Clinic' },
        email: { type: 'string', example: 'info@rossidental.it' },
        poolId: { type: 'string', format: 'uuid' },
        invite: {
          type: 'boolean',
          description: 'true = INVITED, false = ACTIVE',
        },
      },
    },
  })
  async activateCustomer(
    @Param('id') id: string,
    @Body() body: ActivateCustomerDto,
    @Req() req: Request,
  ) {
    return this.service.activateCustomer(id, body, await this.actor(req));
  }

  @Post(':id/customers/:customerId/deactivate')
  @ApiOperation({ summary: 'Archive a customer and free the seat' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'customerId', format: 'uuid' })
  async deactivateCustomer(
    @Param('id') id: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    return this.service.deactivateCustomer(
      id,
      customerId,
      await this.actor(req),
    );
  }

  @Post(':id/customers/:customerId/restore')
  @ApiOperation({ summary: 'Restore an archived customer onto a free seat' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'customerId', format: 'uuid' })
  async restoreCustomer(
    @Param('id') id: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    return this.service.restoreCustomer(id, customerId, await this.actor(req));
  }

  @Post(':id/customers/:customerId/substitute')
  @ApiOperation({ summary: 'Swap the customer on a seat for another one' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'customerId', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['company', 'email'],
      properties: {
        company: { type: 'string' },
        email: { type: 'string' },
        override: {
          type: 'boolean',
          description: 'Allow a second swap this cycle.',
        },
      },
    },
  })
  async substituteCustomer(
    @Param('id') id: string,
    @Param('customerId') customerId: string,
    @Body() body: SubstituteCustomerDto,
    @Req() req: Request,
  ) {
    return this.service.substituteCustomer(
      id,
      customerId,
      body,
      await this.actor(req),
    );
  }

  @Post(':id/staff')
  @ApiOperation({ summary: 'Add a staff member (manager, operator or viewer)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'role'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string', enum: ['MANAGER', 'OPERATOR', 'VIEWER'] },
      },
    },
  })
  async inviteStaff(
    @Param('id') id: string,
    @Body() body: InviteStaffDto,
    @Req() req: Request,
  ) {
    return this.service.inviteStaff(id, body, await this.actor(req));
  }

  /* ── white label ── */

  @Put(':id/branding')
  @ApiOperation({ summary: "Set the agency's product name, logo and colour" })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['productName'],
      properties: {
        productName: { type: 'string', example: 'Zeta AI' },
        logoDataUrl: {
          type: 'string',
          nullable: true,
          description: 'data:image/png;base64,… (≤ 200 KB)',
        },
        primaryColor: { type: 'string', example: '#0ea5e9' },
      },
    },
  })
  async setBranding(
    @Param('id') id: string,
    @Body()
    body: {
      productName?: string;
      logoDataUrl?: string | null;
      primaryColor?: string;
    },
    @Req() req: Request,
  ) {
    await this.whiteLabel.setBranding(id, body, await this.actor(req));
    return this.service.get(id);
  }

  @Post(':id/domains')
  @ApiOperation({
    summary: 'Add an address that serves this agency (e.g. app.youragency.com)',
    description: 'The address must also point at the frontend (DNS + Vercel).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['hostname'],
      properties: { hostname: { type: 'string' } },
    },
  })
  async addDomain(
    @Param('id') id: string,
    @Body() body: { hostname?: string },
    @Req() req: Request,
  ) {
    await this.whiteLabel.addDomain(id, body?.hostname, await this.actor(req));
    return this.service.get(id);
  }

  @Post(':id/domains/:domainId/archive')
  @ApiOperation({
    summary: 'Stop serving the agency on an address (kept, not deleted)',
  })
  async archiveDomain(
    @Param('id') id: string,
    @Param('domainId') domainId: string,
    @Req() req: Request,
  ) {
    await this.whiteLabel.archiveDomain(id, domainId, await this.actor(req));
    return this.service.get(id);
  }

  @Post(':id/customers/:customerId/login-link')
  @ApiOperation({
    summary: 'Create a one-time link for a customer to set their password',
    description:
      'Returns the code once; older links for the customer stop working.',
  })
  async loginLink(
    @Param('id') id: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    return this.whiteLabel.createLoginLink(
      id,
      customerId,
      await this.actor(req),
    );
  }
}
