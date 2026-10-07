import { withErrors } from '../../server/handler.js'
import { readReservations, writeReservations } from '../../server/store.js'

export default withErrors(async function handler(req, res) {
  const { id } = req.query
  const reservations = await readReservations()
  const idx = reservations.findIndex(r => r.id === id)

  if (req.method === 'PATCH') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    Object.assign(reservations[idx], req.body)
    const { list } = await writeReservations(reservations)
    return res.json(list.find(r => r.id === id) ?? reservations[idx])
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    reservations.splice(idx, 1)
    await writeReservations(reservations)
    return res.status(204).end()
  }

  res.status(405).end()
})
