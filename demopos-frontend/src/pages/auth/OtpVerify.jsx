import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import authApi from '../../api/auth'

export default function OtpVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email ?? ''
  const [digits, setDigits] = useState(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef()]

  useEffect(() => {
    if (!email) navigate('/forgot-password')
    refs[0].current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < 4) refs[i + 1].current?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus()
    }
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5)
    if (text.length === 5) {
      setDigits(text.split(''))
      refs[4].current?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length < 5) { toast.error('Enter all 5 digits'); return }
    setLoading(true)
    try {
      const res = await authApi.verifyOtp(email, otp)
      const { resetToken } = res.data.data ?? res.data
      toast.success('OTP verified!')
      navigate('/reset-password', { state: { email, resetToken } })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await authApi.resendOtp(email)
      toast.success('OTP resent')
      setResendCooldown(60)
      setDigits(['', '', '', '', ''])
      refs[0].current?.focus()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to resend OTP')
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Verify OTP</h2>
      <p className="text-gray-500 text-sm mb-6">
        Enter the 5-digit code sent to <strong>{email}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Verify OTP
        </button>
      </form>

      <div className="text-center mt-4">
        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
        </button>
      </div>

      <Link
        to="/forgot-password"
        className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700 mt-4"
      >
        <ArrowLeft size={14} /> Go back
      </Link>
    </>
  )
}
