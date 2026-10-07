// Bekende leden met hun KNLTB lidnummer. Wordt eenmalig in de ledenlijst gemerged
// (zie api/members.js) — daarna is de lijst in Redis leidend, zodat een bewust
// verwijderd lid niet terugkomt.
//
// clubMemberId (de club-member UUID die KNLTB bij boeken nodig heeft) is nog
// onbekend voor nieuwe leden: koppel die via Leden → "Koppel via KNLTB".
export const ROSTER = [
  { name: 'Sander van Dijk', memberNumber: '37987208' },
  { name: 'Lerau Seyben',    memberNumber: '39717607' },
  { name: 'Sabien Douven',   memberNumber: '37987259' },
  { name: 'Joris Douven',    memberNumber: '38884909' },
]

const norm = s => s.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Merge de roster in een bestaande ledenlijst.
 * - bestaand lid (op naam): alleen een leeg lidnummer wordt aangevuld
 * - onbekend lid: toegevoegd zonder clubMemberId
 * Geeft { members, changed } terug; muteert de invoer niet.
 */
export function applyRoster(existing, roster = ROSTER, makeId = () => crypto.randomUUID()) {
  const members = existing.map(m => ({ ...m }))
  let changed = false

  for (const r of roster) {
    const match = members.find(m => norm(m.name) === norm(r.name))
    if (match) {
      if (!match.memberNumber) { match.memberNumber = r.memberNumber; changed = true }
    } else {
      members.push({ id: makeId(), name: r.name, memberNumber: r.memberNumber, clubMemberId: '' })
      changed = true
    }
  }
  return { members, changed }
}
