import { PrismaPg } from "@prisma/adapter-pg";
import { EmployeeRole, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import bcrypt from "bcrypt";

const databaseUrl = process.env.DATABASE_URL;
const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL ?? "admin@gmail.com";
const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed Nexus Banking data.");
}

if (!demoAdminPassword) {
  throw new Error("DEMO_ADMIN_PASSWORD is required to seed demo employees.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(demoAdminPassword, 12);

  await prisma.branch.upsert({
    where: { code: "HQ001" },
    update: {
      name: "Nexus Banking Head Office",
      city: "Hyderabad",
      state: "Telangana",
      active: true,
    },
    create: {
      code: "HQ001",
      name: "Nexus Banking Head Office",
      city: "Hyderabad",
      state: "Telangana",
      active: true,
    },
  });

  await prisma.employee.upsert({
    where: { email: demoAdminEmail },
    update: {
      employeeCode: "ADM-0001",
      fullName: "System Administrator",
      role: "IT_ADMINISTRATOR",
      passwordHash,
      emailVerified: true,
      active: true,
    },
    create: {
      employeeCode: "ADM-0001",
      fullName: "System Administrator",
      email: demoAdminEmail,
      role: "IT_ADMINISTRATOR",
      passwordHash,
      emailVerified: true,
      active: true,
    },
  });

  const employeeRoles = [
    {
      email: "ceo@gmail.com",
      code: "EMP-CEO",
      name: "Chief Executive Officer",
      role: EmployeeRole.CEO,
    },
    {
      email: "kyc@gmail.com",
      code: "EMP-KYC",
      name: "KYC Operations Officer",
      role: EmployeeRole.KYC_OFFICER,
    },
    {
      email: "compliance@gmail.com",
      code: "EMP-CMP",
      name: "Compliance Officer",
      role: EmployeeRole.COMPLIANCE_OFFICER,
    },
    {
      email: "risk@gmail.com",
      code: "EMP-RSK",
      name: "Risk Assessment Officer",
      role: EmployeeRole.RISK_OFFICER,
    },
    {
      email: "manager@gmail.com",
      code: "EMP-MGR",
      name: "Branch Manager",
      role: EmployeeRole.BRANCH_MANAGER,
    },
  ] satisfies Array<{
    email: string;
    code: string;
    name: string;
    role: EmployeeRole;
  }>;

  for (const emp of employeeRoles) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: {
        employeeCode: emp.code,
        fullName: emp.name,
        role: emp.role,
        passwordHash,
        emailVerified: true,
        active: true,
      },
      create: {
        employeeCode: emp.code,
        fullName: emp.name,
        email: emp.email,
        role: emp.role,
        passwordHash,
        emailVerified: true,
        active: true,
      },
    });
  }

  console.log("Database seeded successfully with roles.");
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
