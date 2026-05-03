import { createContext, useContext, useState, useEffect } from 'react'
import { getActiveCurrency } from '../api/currencies'

const CurrencyContext = createContext({ symbol: '', code: 'BDT', precision: 2 })

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState({ symbol: '', code: 'BDT', precision: 2 })

  useEffect(() => {
    getActiveCurrency()
      .then(res => {
        const c = res.data?.data ?? res.data
        if (c) setCurrency({ symbol: c.symbol ?? '', code: c.code ?? 'BDT', precision: c.precision ?? 2 })
      })
      .catch(() => {}) // silent fail — default currency used
  }, [])

  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
