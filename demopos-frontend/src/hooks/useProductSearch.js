import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Shared hook for paginated product search with infinite scroll.
 * Used by PurchaseForm and OrderForm to avoid duplicating ~120 lines of search logic.
 *
 * @param {Function} searchFn — API call: (query, page, pageSize) => Promise<AxiosResponse>
 * @param {number} [pageSize=10] — items per page
 * @returns {{ productSearch, searchResults, searching, loadingMore, hasMore, dropdownOpen,
 *             handleProductSearchChange, handleSearchFocus, handleSearchBlur,
 *             handleDropdownScroll, resetSearch }}
 */
export default function useProductSearch(searchFn, pageSize = 10) {
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]         = useState(false)
  const [loadingMore, setLoadingMore]     = useState(false)
  const [hasMore, setHasMore]             = useState(false)
  const [dropdownOpen, setDropdownOpen]   = useState(false)

  const debounceRef  = useRef(null)
  const blurRef      = useRef(null)
  const abortRef     = useRef(null)
  const pageRef      = useRef(1)
  const loadingRef   = useRef(false)

  /** Fetches a page of products. `append` = scroll-to-load-more vs. new search. */
  const fetchProducts = useCallback((query, page, append = false) => {
    // Cancel any pending non-append request to prevent stale results
    if (!append && abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    if (!append) abortRef.current = controller

    const setLoadingFn = append ? setLoadingMore : setSearching
    setLoadingFn(true)
    if (append) loadingRef.current = true

    searchFn(query, page, pageSize)
      .then(res => {
        // Bail if this non-append request was superseded
        if (!append && controller.signal.aborted) return

        const d = res.data?.data
        const items = Array.isArray(d) ? d : (d?.items ?? [])
        setSearchResults(prev => append ? [...prev, ...items] : items)
        setHasMore(d?.hasMore ?? false)
        pageRef.current = page
        setDropdownOpen(true)
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
        if (!append) setSearchResults([])
        setHasMore(false)
      })
      .finally(() => {
        setLoadingFn(false)
        if (append) loadingRef.current = false
      })
  }, [searchFn, pageSize])

  /** Debounced handler for typing in the search input. */
  function handleProductSearchChange(val) {
    setProductSearch(val)
    clearTimeout(debounceRef.current)
    pageRef.current = 1
    setHasMore(false)

    debounceRef.current = setTimeout(() => {
      fetchProducts(val, 1, false)
    }, 400)
  }

  /** Called when the search input receives focus. */
  function handleSearchFocus() {
    clearTimeout(blurRef.current)
    if (searchResults.length === 0) {
      fetchProducts(productSearch, 1, false)
    } else {
      setDropdownOpen(true)
    }
  }

  /** Called on search input blur — closes dropdown after a short delay. */
  function handleSearchBlur() {
    blurRef.current = setTimeout(() => setDropdownOpen(false), 200)
  }

  /** Scroll handler on the dropdown container — loads next page near bottom. */
  function handleDropdownScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !loadingRef.current) {
      fetchProducts(productSearch, pageRef.current + 1, true)
    }
  }

  /** Resets all search state — call after selecting a product. */
  function resetSearch() {
    setProductSearch('')
    setSearchResults([])
    setDropdownOpen(false)
    pageRef.current = 1
    setHasMore(false)
  }

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(debounceRef.current)
    clearTimeout(blurRef.current)
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return {
    productSearch,
    searchResults,
    searching,
    loadingMore,
    hasMore,
    dropdownOpen,
    handleProductSearchChange,
    handleSearchFocus,
    handleSearchBlur,
    handleDropdownScroll,
    resetSearch,
  }
}
