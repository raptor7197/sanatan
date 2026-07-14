import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PASSWORD = 'password123';

async function user(name, email, role) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({ data: { name, email, passwordHash, role } });
}

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Message", "Consultation", "DoctorProfile", "User" RESTART IDENTITY CASCADE',
  );

  const doctor1 = await user('Dr. Alice Cardio', 'doctor1@example.com', 'DOCTOR');
  await prisma.doctorProfile.create({
    data: { userId: doctor1.id, specialization: 'Cardiology', yearsOfExperience: 12 },
  });

  const doctor2 = await user('Dr. Bob Neuro', 'doctor2@example.com', 'DOCTOR');
  await prisma.doctorProfile.create({
    data: { userId: doctor2.id, specialization: 'Neurology', yearsOfExperience: 7 },
  });

  const patient1 = await user('Pat One', 'patient1@example.com', 'PATIENT');
  const patient2 = await user('Pat Two', 'patient2@example.com', 'PATIENT');

  // patient1 <-> doctor1: ACTIVE, with a back-and-forth chat — the happy path
  const active = await prisma.consultation.create({
    data: { patientId: patient1.id, doctorId: doctor1.id, status: 'ACTIVE' },
  });
  await prisma.message.createMany({
    data: [
      {
        consultationId: active.id,
        senderId: patient1.id,
        content: "I've had chest tightness since yesterday.",
      },
      {
        consultationId: active.id,
        senderId: doctor1.id,
        content: 'Any shortness of breath or pain radiating to the arm?',
      },
      {
        consultationId: active.id,
        senderId: patient1.id,
        content: 'A little shortness of breath, no arm pain.',
      },
      {
        consultationId: active.id,
        senderId: doctor1.id,
        content: "Let's get an ECG done — I'll send a referral.",
      },
    ],
  });

  // patient2 <-> doctor1: COMPLETED — demonstrates immutability and the message-after-completion 409
  const completed = await prisma.consultation.create({
    data: { patientId: patient2.id, doctorId: doctor1.id, status: 'COMPLETED' },
  });
  await prisma.message.createMany({
    data: [
      {
        consultationId: completed.id,
        senderId: patient2.id,
        content: 'Follow-up on my last checkup, all good?',
      },
      {
        consultationId: completed.id,
        senderId: doctor1.id,
        content: 'Yes, your latest results are normal.',
      },
    ],
  });

  // patient2 <-> doctor2: PENDING, no messages yet — demonstrates the PENDING -> ACTIVE transition
  await prisma.consultation.create({
    data: { patientId: patient2.id, doctorId: doctor2.id, status: 'PENDING' },
  });

  console.log('Seed complete. Login with any of these (password: "password123"):');
  console.log('  doctor1@example.com  (Dr. Alice Cardio, Cardiology)');
  console.log('  doctor2@example.com  (Dr. Bob Neuro, Neurology)');
  console.log('  patient1@example.com (Pat One)');
  console.log('  patient2@example.com (Pat Two)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
