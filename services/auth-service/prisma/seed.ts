import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  const password = 'AdminPassword123!';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  try {
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        verifiedAt: new Date(),
        fullName: 'System Administrator',
        dateOfBirth: new Date('1990-01-01'),
        address: '123 Admin Street, District 1, Ho Chi Minh City',
        phoneNumber: '+84901234567',
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    console.log('Admin user created:', adminUser);
  } catch (e) {
    console.error('Failed to seed admin user:', e);
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

