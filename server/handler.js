// Vangt fouten in een API-handler af en geeft ze als JSON terug (i.p.v. Vercel's
// anonieme FUNCTION_INVOCATION_FAILED), zodat je in de browser en in de logs ziet wat er misgaat.
export function withErrors(fn) {
  return async function handler(req, res) {
    try {
      return await fn(req, res)
    } catch (e) {
      console.error(`[api] ${req.method} ${req.url}`, e)
      if (!res.headersSent) res.status(500).json({ error: e?.message ?? String(e) })
    }
  }
}
