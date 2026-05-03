/**
 * Groups bundle sub-items by their step label for display.
 * Returns null if no sub-items have step labels (flat bundle).
 * Returns [[label, items[]], ...] preserving insertion order.
 */
export function groupSubItemsByStep(subItems) {
  if (!subItems.some(si => si.bundleStepLabel)) return null
  const groupMap = new Map()
  for (const si of subItems) {
    const label = si.bundleStepLabel ?? 'Other'
    if (!groupMap.has(label)) groupMap.set(label, [])
    groupMap.get(label).push(si)
  }
  return [...groupMap.entries()]
}
