import { ApiError } from '../utils/ApiError.js';

// ponytail: validates body/query/params against one schema each; skips a
// generic "schema bag" abstraction since every route only ever needs body+query+params.
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = parse(body, req.body);
      // Express 5: req.query is a getter with no setter, so replace the property descriptor instead of assigning.
      if (query)
        Object.defineProperty(req, 'query', { value: parse(query, req.query), configurable: true });
      if (params) req.params = parse(params, req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
  return result.data;
}
