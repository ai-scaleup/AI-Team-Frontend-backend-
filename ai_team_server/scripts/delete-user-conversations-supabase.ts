import { PrismaClient } from '@prisma/client';

// Use the Test Supabase database
const databaseUrl = "postgresql://postgres.suzvcnveeszxbjylcuih:*%hn2Jt3ut2Y9FwB@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

async function deleteUserConversations() {
    const email = 'digitalcoachai@gmail.com';

    console.log(`Database: Test Supabase`);
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
