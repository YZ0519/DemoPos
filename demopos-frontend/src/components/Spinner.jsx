/**
 * Standard loading spinner.
 * @param {string} [className='h-64'] - className applied to the flex wrapper.
 *   Use 'h-64' (default) for full-page guards, 'py-4' for inline loading sections.
 */
export default function Spinner({ className = 'h-64' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
