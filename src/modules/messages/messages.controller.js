import * as messagesService from './messages.service.js';

export async function sendHandler(req, res) {
  const data = await messagesService.sendMessage(req.params.id, req.user.id, req.body.content);
  res.status(201).json({ data });
}

export async function listHandler(req, res) {
  const { data, meta } = await messagesService.listMessages(req.params.id, req.user.id, req.query);
  res.json({ data, meta });
}
