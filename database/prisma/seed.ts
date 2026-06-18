import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed Nexus Banking data.');
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  await prisma.branch.upsert({
    where: { code: 'HQ001' },
    update: {
      name: 'Nexus Banking Head Office',
      city: 'Hyderabad',
      state: 'Telangana',
      active: true,
    },
    create: {
      code: 'HQ001',
      name: 'Nexus Banking Head Office',
      city: 'Hyderabad',
      state: 'Telangana',
      active: true,
    },
  });

  await prisma.employee.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      employeeCode: 'ADM-0001',
      fullName: 'System Administrator',
      role: 'IT_ADMINISTRATOR',
      passwordHash,
      emailVerified: true,
      active: true,
    },
    create: {
      employeeCode: 'ADM-0001',
      fullName: 'System Administrator',
      email: 'admin@gmail.com',
      role: 'IT_ADMINISTRATOR',
      passwordHash,
      emailVerified: true,
      active: true,
    },
  });

  const employeeRoles = [
    { email: 'ceo@gmail.com', code: 'EMP-CEO', name: 'Chief Executive Officer', role: 'CEO' },
    { email: 'kyc@gmail.com', code: 'EMP-KYC', name: 'KYC Operations Officer', role: 'KYC_OFFICER' },
    { email: 'compliance@gmail.com', code: 'EMP-CMP', name: 'Compliance Officer', role: 'COMPLIANCE_OFFICER' },
    { email: 'risk@gmail.com', code: 'EMP-RSK', name: 'Risk Assessment Officer', role: 'RISK_OFFICER' },
    { email: 'manager@gmail.com', code: 'EMP-MGR', name: 'Branch Manager', role: 'BRANCH_MANAGER' },
  ];

  for (const emp of employeeRoles) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: {
        employeeCode: emp.code,
        fullName: emp.name,
        role: emp.role as any,
        passwordHash,
        emailVerified: true,
        active: true,
      },
      create: {
        employeeCode: emp.code,
        fullName: emp.name,
        email: emp.email,
        role: emp.role as any,
        passwordHash,
        emailVerified: true,
        active: true,
      },
    });
  }

  console.log('Database seeded successfully with roles.');
}

void main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exitCode = 1;
  });
