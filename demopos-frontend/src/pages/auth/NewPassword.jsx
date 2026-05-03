import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import authApi from '../../api/auth'

export default function NewPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email ?? ''
  const resetToken = location.state?.resetToken ?? ''
  const [form, setForm] = useState({ password: '', passwordConfirmation: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!email || !resetToken) navigate('/forgot-password')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, resetToken, navigate])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.passwordConfirmation) {
      toast.error('Passwords do not match')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(email, resetToken, form.password, form.passwordConfirmation)
      toast.success('Password reset successfully!')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h2>
      <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input
            type="password"
            value={form.passwordConfirmation}
            onChange={(e) => set('passwordConfirmation', e.target.value)}
            placeholder="Repeat your password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Reset Password
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
