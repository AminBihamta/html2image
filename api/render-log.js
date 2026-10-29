const stages = new Set(['complete', 'validate', 'load-preview', 'capture']);
const errorCodes = new Set(['timeout', 'capture', 'other']);

module.exports = (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const event = request.body;
  if (!event || typeof event !== 'object' || JSON.stringify(event).length > 2048 || !stages.has(event.stage)) {
    return response.status(400).json({ error: 'Invalid render diagnostic.' });
  }
  const width = Number.isInteger(event.width) && event.width >= 1 && event.width <= 4096 ? event.width : undefined;
  const durationMs = Number.isInteger(event.durationMs) && event.durationMs >= 0 && event.durationMs <= 120000 ? event.durationMs : undefined;
  const errorCode = errorCodes.has(event.errorCode) ? event.errorCode : undefined;
  const outputBytes = Number.isInteger(event.outputBytes) && event.outputBytes >= 0 ? event.outputBytes : undefined;
  const entry = { stage: event.stage, ...(width && { width }), ...(durationMs !== undefined && { durationMs }), ...(errorCode && { errorCode }), ...(outputBytes !== undefined && { outputBytes }) };
  console[errorCode ? 'error' : 'info']('[render-debug]', JSON.stringify(entry));
  return response.status(204).end();
};
