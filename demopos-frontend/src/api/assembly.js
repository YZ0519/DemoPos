import api from './axios'

// ─── Product lookup for assembly forms ────────────────────────────────────
//
// Uses /products/assembly-lookup which is gated on assembly_view OR
// assembly_create — NOT product_view.  This means assembly users can populate
// ingredient dropdowns even when they lack the product management permission.

/**
 * Fetch all products for use in assembly ingredient SearchableSelects.
 * Returns ProductDto[] including id, name, quantity, and purchasePrice.
 */
export function getAssemblyProducts() {
  return api.get('/products/assembly-lookup')
}

// ─── Assembly Templates ────────────────────────────────────────────────────

/**
 * List all assembly templates (active + inactive).
 * @param {number} [page=1]
 * @param {number} [pageSize=50]
 */
export function getTemplates(page = 1, pageSize = 50) {
  return api.get('/assembly-templates', { params: { page, pageSize } })
}

/**
 * Get a single template with its items.
 * @param {number} id
 */
export function getTemplateById(id) {
  return api.get(`/assembly-templates/${id}`)
}

/**
 * Create a new assembly template.
 * @param {object} data  CreateAssemblyTemplateRequest
 */
export function createTemplate(data) {
  return api.post('/assembly-templates', data)
}

/**
 * Replace an existing assembly template and its items.
 * @param {number} id
 * @param {object} data  CreateAssemblyTemplateRequest
 */
export function updateTemplate(id, data) {
  return api.put(`/assembly-templates/${id}`, data)
}

/**
 * Delete (or deactivate) an assembly template.
 * @param {number} id
 */
export function deleteTemplate(id) {
  return api.delete(`/assembly-templates/${id}`)
}

// ─── Stock Assemblies ──────────────────────────────────────────────────────

/**
 * List paginated stock assemblies with optional filters.
 * @param {{ page?: number, pageSize?: number, dateFrom?: string, dateTo?: string, type?: string, productId?: number }} params
 */
export function getAssemblies(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null) query.append(k, v)
  })
  return api.get(`/stock-assemblies?${query.toString()}`)
}

/**
 * Get a single stock assembly with all its items.
 * @param {number} id
 */
export function getAssemblyById(id) {
  return api.get(`/stock-assemblies/${id}`)
}

/**
 * Execute a manual assembly run.
 * @param {object} data  CreateStockAssemblyRequest
 */
export function createAssembly(data) {
  return api.post('/stock-assemblies', data)
}

/**
 * Delete an assembly record — fully reverses all stock changes.
 * @param {number} id
 */
export function deleteAssembly(id) {
  return api.delete(`/stock-assemblies/${id}`)
}
