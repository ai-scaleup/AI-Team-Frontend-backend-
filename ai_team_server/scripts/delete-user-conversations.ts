import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUserConversations() {
    const email = 'digitalcoachai@gmail.com';

    console.log(`Looking for user with email: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            conversations: {
                include: { messages: true },
            },
        },
    });

    if (!user) {
        console.log(`User with email "${email}" not found.`);
        return;
    }

    console.log(`Found user: ${user.id} (${user.email})`);
    console.log(`Total conversations: ${user.conversations.length}`);

    const totalMessages = user.conversations.reduce(
        (acc, conv) => acc + conv.messages.length,
        0
    );
    console.log(`Total messages: ${totalMessages}`);

    // Delete all conversations (messages will cascade delete)
    const deleteResult = await prisma.conversation.deleteMany({
        where: { userId: user.id },
    });

    console.log(`\n✅ Deleted ${deleteResult.count} conversations`);
    console.log(`✅ Messages were cascade deleted automatically`);
}

deleteUserConversations()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
