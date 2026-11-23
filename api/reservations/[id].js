import { withErrors } from '../../server/handler.js'
import { mutateReservations } from '../../server/store.js'
import { notifyOutcome } from '../../server/notify.js'

export default withErrors(async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PATCH') {
    const { value, list } = await mutateReservations(reservations => {
      const current = reservations.find(r => r.id === id)
      if (!current) return { write: false, value: null }
      const previousStatus = current.status
      const patch = { ...req.body }
      // Een geannuleerde reservering blijft geannuleerd: een tab of cron-tick die nog een oude status
      // wegschrijft (bv. 'active' of 'pending') mag dat niet terugdraaien. Logs mogen nog wel.
      if (previousStatus === 'cancelled' && patch.status && patch.status !== 'cancelled') delete patch.status
      Object.assign(current, patch)
      return { value: { previousStatus, reservation: current } }
    })
    if (!value) return res.status(404).json({ error: 'Not found' })
    const saved = list.find(r => r.id === id) ?? value.reservation
    await notifyOutcome(saved, value.previousStatus)   // buiten het slot: dit is een netwerkaanroep
    return res.json(saved)
  }

  if (req.method === 'DELETE') {
    const { value } = await mutateReservations(reservations => {
      const idx = reservations.findIndex(r => r.id === id)
      if (idx === -1) return { write: false, value: false }
      reservations.splice(idx, 1)
      return { value: true }
    })
    return value ? res.status(204).end() : res.status(404).json({ error: 'Not found' })
  }

  res.status(405).end()
})
