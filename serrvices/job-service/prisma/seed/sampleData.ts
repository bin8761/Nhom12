import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCandidates() {
  const candidates = [
    {
      id: 'candidate-alice-nguyen',
      email: 'alice@example.com',
      fullName: 'Alice Nguyễn',
      phoneNumber: '0908000111',
    },
    {
      id: 'candidate-bob-tran',
      email: 'bob@example.com',
      fullName: 'Bob Trần',
      phoneNumber: '0908333444',
    },
  ];

  for (const candidate of candidates) {
    await prisma.candidate.upsert({
      where: { id: candidate.id },
      update: candidate,
      create: candidate,
    });
  }
}

async function seedJobs() {
  const jobs = [
    {
      id: 'job-node-lead',
      employerId: 'emp-001',
      employerEmail: 'hr@bonenet.dev',
      title: 'Senior Node.js Engineer',
      slug: 'senior-nodejs-engineer',
      description: 'Thiết kế microservice Node.js cho ứng dụng Job Finder.',
      skills: ['nodejs', 'typescript', 'docker'],
      provinceCode: 'VN-HCM',
      districtCode: 'VN-HCM-Q1-TAN-DINH',
      provinceNameSnapshot: 'TP. Hồ Chí Minh',
      districtNameSnapshot: 'Phường Tân Định (Quận 1)',
      addressLine: '12 Nguyễn Đình Chiểu, Quận 1',
      salary: new Prisma.Decimal(2500),
      currency: 'VND',
      location: 'Quận 1, TP.HCM',
      jobType: 'FULL_TIME',
      status: 'APPROVED',
      publishedAt: new Date('2025-11-10T08:00:00Z'),
      images: [
        {
          id: 'job-node-lead-img-1',
          filePath: 'storage/job-images/job-node-lead/lead.png',
          slot: 0,
        },
      ],
    },
    {
      id: 'job-product-designer',
      employerId: 'emp-002',
      employerEmail: 'talent@designhub.vn',
      title: 'Product Designer (Mobile)',
      slug: 'product-designer-mobile',
      description: 'Tham gia thiết kế trải nghiệm cho ứng dụng tìm việc trên iOS/Android.',
      skills: ['figma', 'ux', 'mobile'],
      provinceCode: 'VN-HCM',
      districtCode: 'VN-HCM-THU-DUC-AN-KHANH',
      provinceNameSnapshot: 'TP. Hồ Chí Minh',
      districtNameSnapshot: 'Phường An Khánh (TP Thủ Đức)',
      addressLine: '21 Song Hành, TP Thủ Đức',
      salary: new Prisma.Decimal(1800),
      currency: 'VND',
      location: 'TP Thủ Đức, TP.HCM',
      jobType: 'FULL_TIME',
      status: 'APPROVED',
      publishedAt: new Date('2025-11-11T02:30:00Z'),
      images: [
        {
          id: 'job-product-designer-img-1',
          filePath: 'storage/job-images/job-product-designer/mock.png',
          slot: 0,
        },
      ],
    },
  ];

  for (const job of jobs) {
    const { images, ...jobData } = job;
    
    // Use raw query to bypass type checking
    await prisma.$executeRaw`
      INSERT INTO Job (id, employerId, employerEmail, title, slug, description, skills, provinceCode, districtCode, provinceNameSnapshot, districtNameSnapshot, addressLine, salary, currency, location, jobType, status, publishedAt, createdAt, updatedAt)
      VALUES (${jobData.id}, ${jobData.employerId}, ${jobData.employerEmail}, ${jobData.title}, ${jobData.slug}, ${jobData.description}, ${JSON.stringify(jobData.skills)}, ${jobData.provinceCode}, ${jobData.districtCode}, ${jobData.provinceNameSnapshot}, ${jobData.districtNameSnapshot}, ${jobData.addressLine}, ${jobData.salary}, ${jobData.currency}, ${jobData.location}, ${jobData.jobType}, ${jobData.status}, ${jobData.publishedAt}, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        salary = VALUES(salary),
        updatedAt = NOW()
    `;

    for (const image of images) {
      await prisma.jobimage.upsert({
        where: { id: image.id },
        update: { filePath: image.filePath, slot: image.slot },
        create: {
          ...image,
          jobId: jobData.id,
        },
      });
    }
  }
}

async function seedApplications() {
  const applications = [
    {
      id: 'app-alice-node',
      jobId: 'job-node-lead',
      candidateId: 'candidate-alice-nguyen',
      status: 'SUBMITTED' as const,
    },
    {
      id: 'app-bob-designer',
      jobId: 'job-product-designer',
      candidateId: 'candidate-bob-tran',
      status: 'INTERVIEW' as const,
    },
  ];

  for (const application of applications) {
    await prisma.application.upsert({
      where: { id: application.id },
      update: {
        status: application.status,
      },
      create: application,
    });
  }
}

async function seedCandidateCv() {
  const records = [
    {
      id: 'cv-alice',
      candidateId: 'candidate-alice-nguyen',
      filePath: 'storage/cv/alice.pdf',
      fileSize: 120000,
      mimeType: 'application/pdf',
      status: 'PARSED' as const,
    },
    {
      id: 'cv-bob',
      candidateId: 'candidate-bob-tran',
      filePath: 'storage/cv/bob.pdf',
      fileSize: 110000,
      mimeType: 'application/pdf',
      status: 'PARSED' as const,
    },
  ];

  for (const record of records) {
    await prisma.candidateCv.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    });
  }
}

async function main() {
  try {
    await seedCandidates();
    await seedJobs();
    await seedCandidateCv();
    await seedApplications();
    console.info('[seed:sampleData] Seed completed');
  } catch (error) {
    console.error('[seed:sampleData] Failed to seed sample data', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
