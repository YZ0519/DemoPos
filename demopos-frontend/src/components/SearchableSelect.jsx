import { useState, useEffect, useRef } from 'react'

/**
 * SearchableSelect — a typeahead combobox that replaces plain <select> elements.
 *
 * Props:
 *   options        {Array<{ id: number|string, name: string }>}
 *   value          {number|string|''} — the selected id; '' means nothing selected
 *   onChange       {(id: number|string|'') => void}
 *   placeholder    {string}
 *   disabled       {boolean}
 *   className      {string}
 *   inputClassName {string}
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  inputClassName = '',
}) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const wrapperRef          = useRef(null)

  const selectedOption = options.find(o => String(o.id) === String(value)) ?? null

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  function handleInputChange(e) {
    setQuery(e.target.value)
    setOpen(true)
  }

  function handleFocus() {
    if (disabled) return
    setQuery('')
    setOpen(true)
  }

  function handleSelect(option) {
    onChange(option.id)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const inputValue = open ? query : (selectedOption?.name ?? '')

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-700 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 ${inputClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
      />

      {open && (
        <div
          className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto"
          role="listbox"
        >
          {filtered.length > 0 ? (
            filtered.map(option => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={String(option.id) === String(value)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors
                  ${String(option.id) === String(value)
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
              >
                {option.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">No results found.</p>
          )}
        </div>
      )}
    </div>
  )
}
