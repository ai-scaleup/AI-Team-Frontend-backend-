import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * The signed-in caller's email. A Clerk JWT carries the Clerk user id as
 * `sub`, which is User.oauthId; a development-token caller may name an email
 * in x-user-email (the dev token is trusted anyway). Returns null when there
 * is no way to tell — never a header value from a Clerk caller.
 */
export async function callerEmail(
  req: Request,
  prisma: PrismaService,
): Promise<string | null> {
  const auth = (req.auth ?? {}) as {
    sub?: string;
    email?: string;
    isDevToken?: boolean;
  };
  if (auth.isDevToken) return auth.email?.toLowerCase() || null;
  if (!auth.sub) return null;
  const user = await prisma.user.findUnique({
    where: { oauthId: auth.sub },
    select: { email: true },
  });
  return user?.email.toLowerCase() ?? null;
}
