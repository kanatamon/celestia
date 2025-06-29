import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDatabase() {
  try {
    console.log('Starting database cleanup...');

    // Use a transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete all WebcastMemberMessage records
      console.log('Deleting all WebcastMemberMessage records...');
      const deletedMemberMessages = await tx.webcastMemberMessage.deleteMany();
      console.log(`Deleted ${deletedMemberMessages.count} WebcastMemberMessage records`);

      // Step 2: Find users who have no chat, like, or gift messages
      console.log('Finding users with no activity...');
      const inactiveUsers = await tx.user.findMany({
        where: {
          AND: [
            { chatMessages: { none: {} } },
            { likeMessages: { none: {} } },
            { giftMessages: { none: {} } }
          ]
        },
        select: {
          userId: true,
          nickname: true,
          uniqueId: true
        }
      });

      console.log(`Found ${inactiveUsers.length} inactive users`);

      if (inactiveUsers.length > 0) {
        // Log the users that will be deleted (optional, for verification)
        console.log('Users to be deleted:');
        inactiveUsers.forEach((user, index) => {
          console.log(`${index + 1}. ID: ${user.userId}, Nickname: ${user.nickname || 'N/A'}, UniqueId: ${user.uniqueId || 'N/A'}`);
        });

        // Step 3: Delete inactive users
        // Note: FollowInfo will be cascade deleted due to the onDelete: Cascade relation
        const userIds = inactiveUsers.map(user => user.userId);
        
        const deletedUsers = await tx.user.deleteMany({
          where: {
            userId: {
              in: userIds
            }
          }
        });

        console.log(`Deleted ${deletedUsers.count} inactive users and their related FollowInfo records`);
      } else {
        console.log('No inactive users found to delete');
      }
    });

    console.log('Database cleanup completed successfully!');

  } catch (error) {
    console.error('Error during database cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Add a confirmation prompt before running the cleanup
async function runCleanupWithConfirmation() {
  // Get counts before cleanup for reference
  const memberMessageCount = await prisma.webcastMemberMessage.count();
  const totalUserCount = await prisma.user.count();
  
  const inactiveUserCount = await prisma.user.count({
    where: {
      AND: [
        { chatMessages: { none: {} } },
        { likeMessages: { none: {} } },
        { giftMessages: { none: {} } }
      ]
    }
  });

  console.log('\n=== DATABASE CLEANUP PREVIEW ===');
  console.log(`WebcastMemberMessage records to delete: ${memberMessageCount}`);
  console.log(`Total users in database: ${totalUserCount}`);
  console.log(`Inactive users to delete: ${inactiveUserCount}`);
  console.log(`Users that will remain: ${totalUserCount - inactiveUserCount}`);

  // In a real application, you might want to add a confirmation prompt here
  // For this script, we'll proceed automatically
  console.log('\nProceeding with cleanup...\n');
  
  await cleanupDatabase();
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  runCleanupWithConfirmation()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { cleanupDatabase, runCleanupWithConfirmation };