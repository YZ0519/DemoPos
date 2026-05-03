/**
 * Displays a Paid / Due badge based on order status.
 * status === 1 → Paid (green)
 * anything else → Due (yellow)
 */
export default function StatusBadge({ status }) {
  if (status === 1) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        Paid
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
      Due
    </span>
  )
}
