export const rupee = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export const rupeeExact = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const groupByDay = (
  rows: Array<Record<string, unknown>>,
  dateKeys: string[],
  valueKeys: string[]
) => {
  const map = new Map<string, number>()
  for (const row of rows) {
    let dateValue: unknown
    for (const key of dateKeys) {
      if (row[key] != null && row[key] !== '') {
        dateValue = row[key]
        break
      }
    }
    const date = new Date(String(dateValue || ''))
    if (Number.isNaN(date.getTime())) continue
    const day = date.toISOString().slice(0, 10)
    let amount = 0
    for (const key of valueKeys) {
      const next = Number(row[key])
      if (Number.isFinite(next)) {
        amount = next
        break
      }
    }
    map.set(day, (map.get(day) || 0) + amount)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: Number(value.toFixed(2)) }))
}

export const topN = (rows: Array<{ name: string; value: number }>, n = 8) =>
  [...rows].sort((a, b) => b.value - a.value).slice(0, n)
