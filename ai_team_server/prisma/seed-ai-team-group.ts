import { PrismaClient, AgentName } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_AGENTS: AgentName[] = [
  AgentName.JIM,
  AgentName.ALEX,
  AgentName.MIKE,
  AgentName.TONY,
  AgentName.LARA,
  AgentName.VALENTINA,
  AgentName.DANIELE,
  AgentName.SIMONE,
  AgentName.NIKO,
  AgentName.ALADINO,
  AgentName.LAURA,
  AgentName.DAN,
  AgentName.MAX,
  AgentName.SOFIA,
  AgentName.ROBERTA,
  AgentName.SARA_AI,
  AgentName.JENNIFER_AI,
  AgentName.CHIARA_AI,
];

async function main() {
  console.log('Creating ai_team group with all agents...');

  const group = await prisma.agentGroup.upsert({
    where: { name: 'ai_team' },
    update: { description: 'Full AI Team - all agents access', isActive: true },
    create: {
      name: 'ai_team',
      description: 'Full AI Team - all agents access',
      isActive: true,
    },
  });

  console.log(`Group created/updated: ${group.id} (${group.name})`);

  // Upsert each agent into the group
  for (const agentName of ALL_AGENTS) {
    const existing = await prisma.agentGroupItem.findFirst({
      where: { groupId: group.id, agentName },
    });

    if (!existing) {
      await prisma.agentGroupItem.create({
        data: { groupId: group.id, agentName },
      });
      console.log(`  + Added agent: ${agentName}`);
    } else {
      console.log(`  ~ Already exists: ${agentName}`);
    }
  }

  console.log('\nDone! ai_team group now has all agents.');
  console.log(`Group ID: ${group.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
