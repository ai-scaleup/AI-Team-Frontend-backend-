import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { hasValidDevToken } from '../auth/dev-token';

@Injectable()
export class PearlAdminAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // A development-token caller is trusted without a Pearl Admin assignment.
    if (hasValidDevToken(request)) {
      return true;
    }

    const emailHeader = request.headers['x-user-email'];
    const email = (Array.isArray(emailHeader) ? emailHeader[0] : emailHeader)
      ?.trim()
      .toLowerCase();

    if (!email) {
      throw new UnauthorizedException('A signed-in user email is required.');
    }

    const now = new Date();
    const userMatch = {
      email: { equals: email, mode: 'insensitive' as const },
    };
    const liveWindow = {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    // Access can come from a direct grant or from a team that bundles the
    // agent; the two are independent sources, so either one is enough.
    const [direct, viaTeam] = await Promise.all([
      this.prisma.singleAssignedAgent.findFirst({
        where: { agentName: 'PEARL_ADMIN', ...liveWindow, user: userMatch },
        select: { id: true },
      }),
      this.prisma.assignedTeam.findFirst({
        where: {
          ...liveWindow,
          user: userMatch,
          team: { isActive: true, agents: { some: { agentName: 'PEARL_ADMIN' } } },
        },
        select: { id: true },
      }),
    ]);

    if (!direct && !viaTeam) {
      throw new ForbiddenException('Pearl Admin is not assigned to this user.');
    }

    return true;
  }
}
