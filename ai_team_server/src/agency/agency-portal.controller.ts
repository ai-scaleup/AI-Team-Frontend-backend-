import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { isAdminEmail } from 'src/common/admin-emails';
import { AgencyStaffRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ActivateCustomerDto,
  AgencyDetailView,
  AgencyService,
  InviteStaffDto,
  SubstituteCustomerDto,
} from './agency.service';
import { callerEmail } from './caller-email';
import { AgencyWhiteLabelService } from './agency-white-label.service';

const { OWNER, MANAGER, OPERATOR, VIEWER } = AgencyStaffRole;
const EVERYONE: AgencyStaffRole[] = [OWNER, MANAGER, OPERATOR, VIEWER];
const MANAGERS: AgencyStaffRole[] = [OWNER, MANAGER];

type Member = { name: string; email: string; role: AgencyStaffRole };

/**
 * The agency portal: what an agency's own staff can see and do. Every route
 * checks that the signed-in user is on the agency's staff with a role that
 * allows the action. Platform admins may open any agency as owner.
 *
 *   owner    everything, plus inviting staff
 *   manager  customers and seat requests
 *   operator read only (opens workspaces once seats grant chat access)
 *   viewer   read only
 */
@ApiTags('Agency portal')
@Controller('agency-portal')
export class AgencyPortalController {
  constructor(
    private readonly service: AgencyService,
    private readonly prisma: PrismaService,
    private readonly whiteLabel: AgencyWhiteLabelService,
  ) {}

  private async email(req: Request): Promise<string> {
    const email = await callerEmail(req, this.prisma);
    if (!email)
      throw new UnauthorizedException('Sign in to use the agency portal.');
    return email;
  }

  private async member(
    req: Request,
    agencyId: string,
    allowed: AgencyStaffRole[],
  ): Promise<Member> {
    const email = await this.email(req);
    const member = await this.service.portalMember(
      agencyId,
      email,
      isAdminEmail(email),
    );
    if (!member)
      throw new ForbiddenException('You are not on this agency’s staff.');
    if (!allowed.includes(member.role))
      throw new ForbiddenException(
        `Your role (${member.role.toLowerCase()}) cannot do this.`,
      );
    return member;
  }

  /** The seat ledger is for owners and managers only. */
  private view(detail: AgencyDetailView, me: Member) {
    return {
      ...detail,
      ledger: MANAGERS.includes(me.role) ? detail.ledger : [],
      me,
    };
  }

  @Get('me')
  @ApiOperation({
    summary: 'The agencies the signed-in user can open, with their role',
  })
  async me(@Req() req: Request) {
    const email = await this.email(req);
    return {
      email,
      agencies: await this.service.portalAgencies(email, isAdminEmail(email)),
    };
  }

  @Get(':agencyId')
  @ApiOperation({ summary: 'One agency as its staff sees it' })
  @ApiParam({ name: 'agencyId', format: 'uuid' })
  async get(@Param('agencyId') agencyId: string, @Req() req: Request) {
    const me = await this.member(req, agencyId, EVERYONE);
    return this.view(await this.service.get(agencyId), me);
  }

  @Post(':agencyId/customers')
  @ApiOperation({ summary: 'Put a customer on a free seat (owner, manager)' })
  @ApiParam({ name: 'agencyId', format: 'uuid' })
  async activate(
    @Param('agencyId') agencyId: string,
    @Body() body: ActivateCustomerDto,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.view(
      await this.service.activateCustomer(agencyId, body, me.email),
      me,
    );
  }

  @Post(':agencyId/customers/:customerId/deactivate')
  @ApiOperation({
    summary: 'Archive a customer and free the seat (owner, manager)',
  })
  async deactivate(
    @Param('agencyId') agencyId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.view(
      await this.service.deactivateCustomer(agencyId, customerId, me.email),
      me,
    );
  }

  @Post(':agencyId/customers/:customerId/restore')
  @ApiOperation({ summary: 'Restore an archived customer (owner, manager)' })
  async restore(
    @Param('agencyId') agencyId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.view(
      await this.service.restoreCustomer(agencyId, customerId, me.email),
      me,
    );
  }

  @Post(':agencyId/customers/:customerId/substitute')
  @ApiOperation({
    summary: 'Swap the customer on a seat (owner, manager)',
    description: 'One swap per seat per cycle; only AI Team can override that.',
  })
  async substitute(
    @Param('agencyId') agencyId: string,
    @Param('customerId') customerId: string,
    @Body() body: SubstituteCustomerDto,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.view(
      await this.service.substituteCustomer(
        agencyId,
        customerId,
        { company: body?.company, email: body?.email, override: false },
        me.email,
      ),
      me,
    );
  }

  @Post(':agencyId/staff')
  @ApiOperation({ summary: 'Add a manager, operator or viewer (owner)' })
  async inviteStaff(
    @Param('agencyId') agencyId: string,
    @Body() body: InviteStaffDto,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, [OWNER]);
    return this.view(
      await this.service.inviteStaff(agencyId, body, me.email),
      me,
    );
  }

  @Post(':agencyId/seat-requests')
  @ApiOperation({ summary: 'Ask AI Team for more seats (owner, manager)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['poolId', 'seats'],
      properties: {
        poolId: { type: 'string', format: 'uuid' },
        seats: { type: 'integer', minimum: 1 },
        message: { type: 'string' },
      },
    },
  })
  async requestSeats(
    @Param('agencyId') agencyId: string,
    @Body() body: { poolId?: string; seats?: number; message?: string },
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.view(
      await this.service.requestSeats(agencyId, body, me.email),
      me,
    );
  }

  @Put(':agencyId/branding')
  @ApiOperation({ summary: 'Set your product name, logo and colour (owner)' })
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
    @Param('agencyId') agencyId: string,
    @Body()
    body: {
      productName?: string;
      logoDataUrl?: string | null;
      primaryColor?: string;
    },
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, [OWNER]);
    await this.whiteLabel.setBranding(agencyId, body, me.email);
    return this.view(await this.service.get(agencyId), me);
  }

  @Post(':agencyId/customers/:customerId/login-link')
  @ApiOperation({
    summary:
      'One-time link for a customer to set their password (owner, manager)',
  })
  async loginLink(
    @Param('agencyId') agencyId: string,
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const me = await this.member(req, agencyId, MANAGERS);
    return this.whiteLabel.createLoginLink(agencyId, customerId, me.email);
  }
}
