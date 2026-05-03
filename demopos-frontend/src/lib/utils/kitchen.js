/**
 * Opens a kitchen ticket tab and stores the ticket data in sessionStorage
 * so the KitchenTicket page can read it on load.
 *
 * @param {object} ticketData  - KitchenTicketResponse object from the API
 * @param {number} orderId     - Sale ID
 * @param {string} [type]      - Optional type suffix, e.g. 'void'
 */
export function openKitchenTicket(ticketData, orderId, type = '') {
  sessionStorage.setItem('kitchen_ticket_pending', JSON.stringify(ticketData))
  const url = type
    ? `/pos/kitchen-ticket/${orderId}?type=${type}`
    : `/pos/kitchen-ticket/${orderId}`
  window.open(url, '_blank')
}
