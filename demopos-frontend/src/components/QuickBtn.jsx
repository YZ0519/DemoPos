export default function QuickBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'
      }`}
    >
      {label}
    </button>
  )
}
