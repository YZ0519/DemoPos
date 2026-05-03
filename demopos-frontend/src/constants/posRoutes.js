/** Route path constants for the POS terminal. */
export const POS_ROUTES = {
  BASE:     '/pos',
  TABLES:   '/pos/tables',
  TABLE:    (id) => `/pos/table/${id}`,
  WALK_IN:  '/pos/walk-in',
  TAKEAWAY: '/pos/takeaway',
  INVOICE:  (id) => `/pos/invoice/${id}`,
}
