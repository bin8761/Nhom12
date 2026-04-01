const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  const job = await prisma.job.findFirst({
    where: { status: 'APPROVED' },
  });
  
  if (job) {
    console.log('publishedAt type:', typeof job.publishedAt);
    console.log('publishedAt value:', job.publishedAt);
    console.log('Is Date?', job.publishedAt instanceof Date);
    console.log('createdAt type:', typeof job.createdAt);
    console.log('createdAt Is Date?', job.createdAt instanceof Date);
  } else {
    console.log('No approved job found');
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
