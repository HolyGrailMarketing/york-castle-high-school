import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Resolve a seed password from an env var, or generate a strong random one.
// Never hardcode credentials in source. The generated value is returned so it
// can be printed once for a fresh database.
function resolveSeedPassword(envVar) {
  const fromEnv = process.env[envVar];
  if (fromEnv) return { value: fromEnv, generated: false };
  const generated = crypto.randomBytes(18).toString('base64url');
  return { value: generated, generated: true };
}

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminCred = resolveSeedPassword('SEED_ADMIN_PASSWORD');
  const adminPassword = await bcrypt.hash(adminCred.value, 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@yorkcastle.edu.jm' },
    update: {},
    create: {
      email: 'admin@yorkcastle.edu.jm',
      password: adminPassword,
      name: 'System Administrator',
      role: 'ADMIN',
      phone: '+18769752217',
    },
  });

  // Create staff user
  const staffCred = resolveSeedPassword('SEED_STAFF_PASSWORD');
  const staffPassword = await bcrypt.hash(staffCred.value, 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@yorkcastle.edu.jm' },
    update: {},
    create: {
      email: 'staff@yorkcastle.edu.jm',
      password: staffPassword,
      name: 'Staff Member',
      role: 'STAFF',
      phone: '+18769752217',
    },
  });

  // Create sample courses
  const courses = [
    {
      name: 'Communication Studies',
      code: 'COMM001',
      pool: 1,
      description: 'Introduction to communication studies',
      capacity: 30,
    },
    {
      name: 'Caribbean Studies',
      code: 'CARB001',
      pool: 1,
      description: 'Caribbean history and culture',
      capacity: 30,
    },
    {
      name: 'Mathematics',
      code: 'MATH001',
      pool: 2,
      description: 'Advanced mathematics',
      capacity: 25,
    },
    {
      name: 'Physics',
      code: 'PHYS001',
      pool: 3,
      description: 'Physics principles and applications',
      capacity: 20,
    },
    {
      name: 'Chemistry',
      code: 'CHEM001',
      pool: 3,
      description: 'Chemistry fundamentals',
      capacity: 20,
    },
    {
      name: 'Biology',
      code: 'BIOL001',
      pool: 3,
      description: 'Biological sciences',
      capacity: 20,
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: course,
    });
  }

  // Create sample teachers
  const teachers = [
    {
      firstName: 'Raymon',
      lastName: 'Treasure',
      email: 'principal@yorkcastle.edu.jm',
      department: 'Administration',
      subjects: ['Administration'],
    },
    {
      firstName: 'D.',
      lastName: 'Robinson',
      department: 'Languages',
      subjects: ['Communication Studies'],
    },
    {
      firstName: 'D.',
      lastName: 'Hardware',
      department: 'Languages',
      subjects: ['Caribbean Studies'],
    },
  ];

  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { email: teacher.email || `teacher-${teacher.firstName}-${teacher.lastName}@yorkcastle.edu.jm` },
      update: {},
      create: teacher,
    });
  }

  console.log('Database seeded successfully!');
  console.log('Admin email: admin@yorkcastle.edu.jm');
  if (adminCred.generated) {
    console.log(`Admin password (generated - save this now): ${adminCred.value}`);
    console.log('Tip: set SEED_ADMIN_PASSWORD in the environment to choose your own.');
  } else {
    console.log('Admin password: set via SEED_ADMIN_PASSWORD environment variable.');
  }
  console.log('Staff email: staff@yorkcastle.edu.jm');
  if (staffCred.generated) {
    console.log(`Staff password (generated - save this now): ${staffCred.value}`);
    console.log('Tip: set SEED_STAFF_PASSWORD in the environment to choose your own.');
  } else {
    console.log('Staff password: set via SEED_STAFF_PASSWORD environment variable.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





