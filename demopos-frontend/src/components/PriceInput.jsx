import { useState, useEffect, useRef } from 'react'

/**
 * PriceInput — text input that enforces valid decimal price entry.
 *
 * - Accepts only digits and a single decimal point while typing.
 * - On blur: formats to 2 decimal places (e.g., "5" → "5.00", "" → "0.00").
 * - On focus: strips trailing zeros for easier editing ("5.00" → "5").
 * - Prevents leading zeros ("007" → "7").
 * - onChange is called with the raw string so parent state stays in sync.
 */
export default function PriceInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = '0.00',
  className = '',
  min = 0,
}) {
  const [display, setDisplay] = useState(formatForDisplay(value))
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) {
      setDisplay(formatForDisplay(value))
    }
  }, [value])

  function handleFocus(e) {
    isFocused.current = true
    const num = parseFloat(String(value))
    if (!isNaN(num) && num !== 0) {
      const stripped = String(parseFloat(num.toFixed(10)))
      setDisplay(stripped)
      e.target.value = stripped
    } else {
      setDisplay('')
      e.target.value = ''
    }
    setTimeout(() => {
      e.target.selectionStart = e.target.value.length
      e.target.selectionEnd   = e.target.value.length
    }, 0)
  }

  function handleChange(e) {
    let raw = e.target.value
    raw = raw.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
    if (raw.length > 1 && raw[0] === '0' && raw[1] !== '.') {
      raw = raw.replace(/^0+/, '') || '0'
    }
    setDisplay(raw)
    onChange(raw)
  }

  function handleBlur() {
    isFocused.current = false
    const num = parseFloat(display)
    const clamped = isNaN(num) ? 0 : Math.max(min, num)
    const formatted = clamped.toFixed(2)
    setDisplay(formatted)
    onChange(formatted)
    onBlur?.()
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  )
}

function formatForDisplay(val) {
  const num = parseFloat(String(val ?? ''))
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}
