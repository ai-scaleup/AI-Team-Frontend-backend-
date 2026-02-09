// scripts/verify-agent-team.ts
// Verifies the agent team setup for john.smith@example.com

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'john.smith@example.com';

    console.log(`\n🔍 Verifying setup for "${email}"...\n`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            agents: { where: { isActive: true } },
            groups: {
                where: { isActive: true },
                include: {
                    group: {
                        include: { items: true },
                    },
                },
            },
        },
    });

    if (!user) {
        console.log(`❌ User not found.`);
        return;
    }

    console.log(`✅ User: ${user.email}`);
    console.log(`\n📋 Active Agent Assignments (${user.agents.length}):`);
    user.agents.forEach((a) => console.log(`   - ${a.agentName}`));

    console.log(`\n📋 Active Group Assignments (${user.groups.length}):`);
    user.groups.forEach((g) => {
        console.log(`   - Group: ${g.group.name}`);
        console.log(`     Agents in group: ${g.group.items.map((i) => i.agentName).join(', ')}`);
    });
}

main()
    .catch((e) => console.error('Error:', e))
    .finally(() => prisma.$disconnect());
