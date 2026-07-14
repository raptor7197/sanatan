import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

function toDto(profile) {
  return {
    id: profile.userId,
    name: profile.user.name,
    specialization: profile.specialization,
    yearsOfExperience: profile.yearsOfExperience,
  };
}

export async function listDoctors({ specialization }) {
  const profiles = await prisma.doctorProfile.findMany({
    where: specialization ? { specialization } : undefined,
    include: { user: true },
    orderBy: { id: 'asc' },
  });
  return profiles.map(toDto);
}

export async function getDoctor(userId) {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile) throw new ApiError(404, 'Doctor not found', 'NOT_FOUND');
  return toDto(profile);
}
