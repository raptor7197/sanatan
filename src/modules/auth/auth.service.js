import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const BCRYPT_COST = 10;
const TOKEN_EXPIRY = '24h';

export async function register({ name, email, password, role, specialization, yearsOfExperience }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role },
      });

      if (role === 'DOCTOR') {
        await tx.doctorProfile.create({
          data: { userId: user.id, specialization, yearsOfExperience },
        });
      }

      return { id: user.id, name: user.name, email: user.email, role: user.role };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'Email already registered', 'DUPLICATE_EMAIL');
    }
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const invalid = () => new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  if (!user) throw invalid();

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw invalid();

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { doctorProfile: true },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.doctorProfile && {
      doctorProfile: {
        specialization: user.doctorProfile.specialization,
        yearsOfExperience: user.doctorProfile.yearsOfExperience,
      },
    }),
  };
}
