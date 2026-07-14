import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const TRANSITIONS = {
  PENDING: ['ACTIVE'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: [],
};

const WITH_NAMES = {
  patient: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
};

function toDto(c) {
  return {
    id: c.id,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    patient: c.patient,
    doctor: c.doctor,
  };
}

export async function createConsultation(patientId, doctorId) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
  if (!doctorProfile) throw new ApiError(404, 'Doctor not found', 'NOT_FOUND');

  const existingOpen = await prisma.consultation.findFirst({
    where: { patientId, doctorId, status: { not: 'COMPLETED' } },
  });
  if (existingOpen) {
    throw new ApiError(
      409,
      'An open consultation with this doctor already exists',
      'DUPLICATE_CONSULTATION',
    );
  }

  try {
    const consultation = await prisma.consultation.create({
      data: { patientId, doctorId },
      include: WITH_NAMES,
    });
    return toDto(consultation);
  } catch (err) {
    // backstop for the partial unique index, in case of a concurrent create racing the check above
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(
        409,
        'An open consultation with this doctor already exists',
        'DUPLICATE_CONSULTATION',
      );
    }
    throw err;
  }
}

export async function listConsultations(userId, { page, limit }) {
  const where = { OR: [{ patientId: userId }, { doctorId: userId }] };

  const [rows, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      include: WITH_NAMES,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.consultation.count({ where }),
  ]);

  return { data: rows.map(toDto), meta: { page, limit, total } };
}

// shared with messages.service — the participant check is identical there.
// Deliberately no `include`: this is an internal ownership/status check, not a display read.
export async function getOwnedConsultation(id, userId) {
  const consultation = await prisma.consultation.findUnique({ where: { id } });
  if (!consultation) throw new ApiError(404, 'Consultation not found', 'NOT_FOUND');
  if (consultation.patientId !== userId && consultation.doctorId !== userId) {
    throw new ApiError(403, 'Not a participant in this consultation', 'FORBIDDEN');
  }
  return consultation;
}

export async function getConsultation(id, userId) {
  await getOwnedConsultation(id, userId); // 404/403 checks
  const consultation = await prisma.consultation.findUnique({ where: { id }, include: WITH_NAMES });
  return toDto(consultation);
}

export async function updateStatus(id, doctorUserId, nextStatus) {
  const consultation = await prisma.consultation.findUnique({ where: { id } });
  if (!consultation) throw new ApiError(404, 'Consultation not found', 'NOT_FOUND');
  if (consultation.doctorId !== doctorUserId) {
    throw new ApiError(403, 'Only the assigned doctor can change this consultation', 'FORBIDDEN');
  }

  if (consultation.status === nextStatus) {
    return toDto(await prisma.consultation.findUnique({ where: { id }, include: WITH_NAMES }));
  }

  if (!TRANSITIONS[consultation.status].includes(nextStatus)) {
    throw new ApiError(
      409,
      `Cannot move consultation from ${consultation.status} to ${nextStatus}`,
      'INVALID_TRANSITION',
    );
  }

  const updated = await prisma.consultation.update({
    where: { id },
    data: { status: nextStatus },
    include: WITH_NAMES,
  });
  return toDto(updated);
}
