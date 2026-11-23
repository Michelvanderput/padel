/**
 * Eenvoudig Redis-slot voor lees-wijzig-schrijf-acties op één grote JSON-waarde (zoals de ledenlijst).
 * Zonder slot lezen twee gelijktijdige requests dezelfde lijst, passen elk hun eigen deel aan en
 * schrijven alles terug: de laatste wint en de wijziging van de ander is weg.
 *
 * SET NX PX = hooguit één houder tegelijk; de TTL zorgt dat een gecrashte functie het slot niet
 * eeuwig vasthoudt. Het slot wordt alleen losgelaten als het nog van ons is.
 */
export async function withLock(redis, key, fn, { ttlMs = 8000, waitMs = 4000 } = {}) {
  const token = crypto.randomUUID()
  const deadline = Date.now() + waitMs

  while (!(await redis.set(key, token, { nx: true, px: ttlMs }))) {
    if (Date.now() > deadline) throw new Error('Even druk: probeer het zo nog eens.')
    await new Promise(r => setTimeout(r, 40 + Math.random() * 60))
  }

  try {
    return await fn()
  } finally {
    try { if ((await redis.get(key)) === token) await redis.del(key) } catch (_) { /* TTL ruimt het op */ }
  }
}
