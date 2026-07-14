import * as consultationsService from './consultations.service.js';

export async function createHandler(req, res) {
  const data = await consultationsService.createConsultation(req.user.id, req.body.doctorId);
  res.status(201).json({ data });
}

export async function listHandler(req, res) {
  const { data, meta } = await consultationsService.listConsultations(req.user.id, req.query);
  res.json({ data, meta });
}

export async function getHandler(req, res) {
  const data = await consultationsService.getConsultation(req.params.id, req.user.id);
  res.json({ data });
}

export async function updateStatusHandler(req, res) {
  const data = await consultationsService.updateStatus(req.params.id, req.user.id, req.body.status);
  res.json({ data });
}
