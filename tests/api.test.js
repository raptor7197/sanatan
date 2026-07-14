import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Message", "Consultation", "DoctorProfile", "User" RESTART IDENTITY CASCADE',
  );
}

async function registerAndLogin(overrides) {
  const body = {
    name: 'Test User',
    email: 'x@example.com',
    password: 'password123',
    role: 'PATIENT',
    ...overrides,
  };
  await request(app).post('/auth/register').send(body).expect(201);
  const res = await request(app)
    .post('/auth/login')
    .send({ email: body.email, password: body.password })
    .expect(200);
  return { token: res.body.data.token, user: res.body.data.user };
}

let doctor1, doctor2, patient1, patient2;

before(async () => {
  await resetDb();
  doctor1 = await registerAndLogin({
    name: 'Dr One',
    email: 'doctor1@example.com',
    role: 'DOCTOR',
    specialization: 'Cardiology',
    yearsOfExperience: 5,
  });
  doctor2 = await registerAndLogin({
    name: 'Dr Two',
    email: 'doctor2@example.com',
    role: 'DOCTOR',
    specialization: 'Neurology',
    yearsOfExperience: 8,
  });
  patient1 = await registerAndLogin({
    name: 'Pat One',
    email: 'patient1@example.com',
    role: 'PATIENT',
  });
  patient2 = await registerAndLogin({
    name: 'Pat Two',
    email: 'patient2@example.com',
    role: 'PATIENT',
  });
});

after(async () => {
  await prisma.$disconnect();
});

test('duplicate email registration (case-variant) is rejected with 409', async () => {
  const res = await request(app).post('/auth/register').send({
    name: 'Dupe',
    email: 'Patient1@Example.com',
    password: 'password123',
    role: 'PATIENT',
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DUPLICATE_EMAIL');
});

test('a doctor cannot create a consultation', async () => {
  const res = await request(app)
    .post('/consultations')
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ doctorId: doctor1.user.id });
  assert.equal(res.status, 403);
});

test('a patient can create a consultation with a doctor', async () => {
  const res = await request(app)
    .post('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`)
    .send({ doctorId: doctor1.user.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, 'PENDING');
});

test('creating a second open consultation with the same doctor is rejected with 409', async () => {
  const res = await request(app)
    .post('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`)
    .send({ doctorId: doctor1.user.id });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'DUPLICATE_CONSULTATION');
});

test('only the assigned doctor can change consultation status', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  const res = await request(app)
    .patch(`/consultations/${consultationId}/status`)
    .set('Authorization', `Bearer ${doctor2.token}`)
    .send({ status: 'ACTIVE' });
  assert.equal(res.status, 403);
});

test('an illegal status transition is rejected with 409', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  const res = await request(app)
    .patch(`/consultations/${consultationId}/status`)
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ status: 'COMPLETED' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INVALID_TRANSITION');
});

test('setting the same status again is an idempotent 200 no-op', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  const res = await request(app)
    .patch(`/consultations/${consultationId}/status`)
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ status: 'PENDING' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'PENDING');
});

test('messages can be sent while a consultation is still PENDING', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  const res = await request(app)
    .post(`/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${patient1.token}`)
    .send({ content: 'hello doctor' });
  assert.equal(res.status, 201);
});

test('a non-participant cannot read messages on a consultation', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  const res = await request(app)
    .get(`/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${patient2.token}`);
  assert.equal(res.status, 403);
});

test('messages are returned in chronological order', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  await request(app)
    .patch(`/consultations/${consultationId}/status`)
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ status: 'ACTIVE' })
    .expect(200);

  await request(app)
    .post(`/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ content: 'second message' })
    .expect(201);

  const res = await request(app)
    .get(`/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${patient1.token}`);
  assert.equal(res.status, 200);
  const timestamps = res.body.data.map((m) => new Date(m.createdAt).getTime());
  assert.deepEqual(
    timestamps,
    [...timestamps].sort((a, b) => a - b),
  );
  assert.equal(res.body.data.at(-1).content, 'second message');
});

test('messages cannot be sent once a consultation is completed', async () => {
  const list = await request(app)
    .get('/consultations')
    .set('Authorization', `Bearer ${patient1.token}`);
  const consultationId = list.body.data[0].id;

  await request(app)
    .patch(`/consultations/${consultationId}/status`)
    .set('Authorization', `Bearer ${doctor1.token}`)
    .send({ status: 'COMPLETED' })
    .expect(200);

  const res = await request(app)
    .post(`/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${patient1.token}`)
    .send({ content: 'too late' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'CONSULTATION_COMPLETED');
});
