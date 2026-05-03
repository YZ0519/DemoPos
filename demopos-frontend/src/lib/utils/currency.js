/**
 * Format a number as a currency string using the active currency symbol.
 * @param {number|string} amount
 * @param {string} symbol - e.g. "৳", "$"
 * @param {number} precision - decimal places (default 2)
 * @returns {string} e.g. "৳ 1,234.50"
 */
export function formatCurrency(amount, symbol = '', precision = 2) {
  const n = Number(amount) || 0
  const formatted = n.toFixed(precision)
  return symbol ? `${symbol} ${formatted}` : formatted
}
