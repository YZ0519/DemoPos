import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <p className="text-7xl font-bold text-blue-600 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-500 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
