import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'digitalcoachai@gmail.com';
  const groupName = 'ai_team';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found: ${email}`);

  const group = await prisma.agentGroup.findUnique({ where: { name: groupName } });
  if (!group) throw new Error(`Group not found: ${groupName}`);

  console.log(`User: ${user.id} (${user.email})`);
  console.log(`Group: ${group.id} (${group.name})`);

  const existing = await prisma.assignedGroup.findFirst({
    where: { userId: user.id, groupId: group.id, isActive: true },
  });

  const assignment = existing
    ? existing
    : await prisma.assignedGroup.create({
        data: { userId: user.id, groupId: group.id, isActive: true },
      });

  console.log(`\nAssigned! AssignedGroup ID: ${assignment.id}`);
  console.log(`${email} now has full access to the ai_team group.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
