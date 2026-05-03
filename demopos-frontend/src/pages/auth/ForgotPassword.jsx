import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import authApi from '../../api/auth'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) { toast.error('Email is required'); return }
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      toast.success('OTP sent to your email')
      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot password?</h2>
      <p className="text-gray-500 text-sm mb-6">
        Enter your email and we'll send you a one-time code.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Send OTP
        </button>
      </form>

      <Link
        to="/login"
        className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-6"
      >
        <ArrowLeft size={14} /> Back to login
      </Link>
    </>
  )
}
