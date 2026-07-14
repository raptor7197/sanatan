import * as doctorsService from './doctors.service.js';

export async function listHandler(req, res) {
  const data = await doctorsService.listDoctors(req.query);
  res.json({ data });
}

export async function getHandler(req, res) {
  const data = await doctorsService.getDoctor(req.params.id);
  res.json({ data });
}
