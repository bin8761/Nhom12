// Test MySQL connection
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('Testing connection to MySQL...');
    await prisma.$connect();
    console.log('✅ Connected successfully!');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query test:', result);
    
    await prisma.$disconnect();
    console.log('✅ Disconnected successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
