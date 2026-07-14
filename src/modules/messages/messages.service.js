import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { getOwnedConsultation } from '../consultations/consultations.service.js';

export async function sendMessage(consultationId, senderId, content) {
  const consultation = await getOwnedConsultation(consultationId, senderId);

  if (consultation.status === 'COMPLETED') {
    throw new ApiError(
      409,
      'Cannot send messages on a completed consultation',
      'CONSULTATION_COMPLETED',
    );
  }

  return prisma.message.create({
    data: { consultationId, senderId, content },
  });
}

export async function listMessages(consultationId, userId, { page, limit }) {
  await getOwnedConsultation(consultationId, userId);

  const [data, total] = await Promise.all([
    prisma.message.findMany({
      where: { consultationId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.message.count({ where: { consultationId } }),
  ]);

  return { data, meta: { page, limit, total } };
}
