import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { getComboItems, addComboItem, removeComboItem } from '../../api/combos'
import productsApi from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import SearchableSelect from '../../components/SearchableSelect'
import usePageTitle from '../../hooks/usePageTitle'

export default function ProductComboItems() {
  usePageTitle('Combo Items')
  const { id: productId } = useParams()
  const navigate          = useNavigate()
  const { user }          = useAuth()

  const perms     = user?.permissions ?? []
  const canUpdate = perms.includes('product_update')

  const [comboItems, setComboItems]   = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading]         = useState(true)
  const [addForm, setAddForm]         = useState({ productId: '', quantity: 1, sortOrder: 0 })
  const [adding, setAdding]           = useState(false)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState(null)

  // ── Fetch combo items ───────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getComboItems(productId)
      const data = res.data?.data ?? res.data ?? []
      setComboItems(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load combo items')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // ── Fetch all products for the selector ────────────────────────────────────
  const fetchAllProducts = useCallback(async () => {
    try {
      const res  = await productsApi.searchAll('')
      const data = res.data?.data ?? res.data ?? []
      setAllProducts(Array.isArray(data) ? data : [])
    } catch {
      // Non-critical — selector will be empty
    }
  }, [])

  useEffect(() => {
    fetchItems()
    fetchAllProducts()
  }, [fetchItems, fetchAllProducts])

  // ── Add component ───────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault()
    if (!addForm.productId) { toast.error('Please select a product'); return }
    const qty = Number(addForm.quantity) || 1
    if (qty < 1) { toast.error('Quantity must be at least 1'); return }
    setAdding(true)
    try {
      const res = await addComboItem(productId, {
        componentProductId: Number(addForm.productId),
        quantity: qty,
        sortOrder: Number(addForm.sortOrder) || 0,
      })
      const created = res.data?.data ?? res.data
      // If the API returns the full updated list, use it; otherwise append
      if (Array.isArray(created)) {
        setComboItems(created)
      } else {
        setComboItems(prev => [...prev, created])
      }
      setAddForm({ productId: '', quantity: 1, sortOrder: 0 })
      toast.success('Component added')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to add component')
    } finally {
      setAdding(false)
    }
  }

  // ── Remove component ────────────────────────────────────────────────────────
  async function handleRemove(componentId) {
    try {
      await removeComboItem(productId, componentId)
      setComboItems(prev => prev.filter(i => (i.id ?? i.componentId) !== componentId))
      toast.success('Component removed')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to remove component')
    } finally {
      setConfirmingRemoveId(null)
    }
  }

  // Product options for SearchableSelect — filter out the parent product itself
  const productOptions = allProducts
    .filter(p => String(p.id) !== String(productId))
    .map(p => ({ id: p.id, name: `${p.name} (${p.sku})` }))

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Back to products"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Package size={20} className="text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Combo Components — Product #{productId}
          </h1>
        </div>
      </div>

      {/* Add component form */}
      {canUpdate && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-4">Add Component</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Component Product *
              </label>
              <SearchableSelect
                options={productOptions}
                value={addForm.productId}
                onChange={(val) => setAddForm(f => ({ ...f, productId: val }))}
                placeholder="Search and select product..."
                disabled={adding}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={addForm.quantity}
                onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                disabled={adding}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                value={addForm.sortOrder}
                onChange={e => setAddForm(f => ({ ...f, sortOrder: e.target.value }))}
                disabled={adding}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-start-4 sm:row-start-2 flex justify-end">
              <button
                type="submit"
                disabled={adding || !addForm.productId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                {adding ? 'Adding...' : 'Add Component'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Components list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-gray-800 dark:text-slate-200 mb-4">
          Components ({comboItems.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comboItems.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">No components yet</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              Add products that make up this combo meal
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Component Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Quantity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sort Order</th>
                  {canUpdate && (
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {comboItems.map((item, index) => {
                  const itemId = item.id ?? item.componentId
                  return (
                    <tr key={itemId ?? index} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4">
                        <p className="text-gray-700 dark:text-slate-300 font-medium">
                          {item.componentProductName ?? item.productName ?? `Product #${item.componentProductId}`}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{item.sku}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{item.quantity}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{item.sortOrder ?? 0}</td>
                      {canUpdate && (
                        <td className="py-3 px-4">
                          {confirmingRemoveId === itemId ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400">Remove?</span>
                              <button onClick={() => handleRemove(itemId)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                              <button onClick={() => setConfirmingRemoveId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingRemoveId(itemId)}
                              className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
