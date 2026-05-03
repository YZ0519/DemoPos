import { useState, useEffect } from 'react'
import { User, Lock, Eye, EyeOff, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import profileApi from '../../api/profile'
import demoApi from '../../api/demo'

export default function Profile() {
  const { user, updateUser } = useAuth()

  // ── Data loading ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [profileError, setProfileError] = useState('')
  const [profileSubmitting, setProfileSubmitting] = useState(false)

  // ── Password form ─────────────────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  // ── Password visibility toggles ───────────────────────────────────────────
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  // ── Demo reset (admin only) ───────────────────────────────────────────────
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  // ── Fetch profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchProfile()
  }, [])

  function fetchProfile() {
    setLoading(true)
    setLoadError('')
    profileApi.get()
      .then((res) => {
        const data = res.data?.data ?? {}
        setProfileForm({ name: data.name ?? '', email: data.email ?? '' })
      })
      .catch(() => {
        setLoadError('Failed to load profile. Please try again.')
      })
      .finally(() => setLoading(false))
  }

  // ── Profile submit ────────────────────────────────────────────────────────
  async function handleProfileSubmit(e) {
    e.preventDefault()
    setProfileError('')

    const name = profileForm.name.trim()
    const email = profileForm.email.trim()

    if (!name) {
      setProfileError('Name is required.')
      return
    }
    // Basic email format check
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError('A valid email address is required.')
      return
    }

    setProfileSubmitting(true)
    try {
      await profileApi.update({ name, email })
      updateUser({ name, email })
      toast.success('Profile updated successfully')
    } catch (err) {
      setProfileError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setProfileSubmitting(false)
    }
  }

  // ── Password submit ───────────────────────────────────────────────────────
  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setPasswordError('')

    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSubmitting(true)
    try {
      // Backend DTO requires name and email even when changing password.
      await profileApi.update({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        currentPassword,
        newPassword,
        newPasswordConfirmation: confirmPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password updated successfully')
    } catch (err) {
      setPasswordError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  // ── Demo reset ────────────────────────────────────────────────────────────
  async function handleReset() {
    setResetting(true)
    try {
      await demoApi.reset()
      setResetConfirm(false)
      toast.success('Demo data has been reset successfully.')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Reset failed. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading profile">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          onClick={fetchProfile}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Profile</h1>

      <div className="max-w-xl space-y-6">

        {/* Card 1 — Profile Information */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            Profile Information
          </h2>

          <form onSubmit={handleProfileSubmit} noValidate>
            {/* Name */}
            <div className="mb-4">
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={profileSubmitting}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={profileSubmitting}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                autoComplete="email"
              />
            </div>

            {profileError && (
              <p className="text-sm text-red-600 mt-2" role="alert">{profileError}</p>
            )}

            <div className="mt-5">
              <button
                type="submit"
                disabled={profileSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {profileSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Card 2 — Change Password */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Lock size={18} className="text-blue-600" />
            Change Password
          </h2>

          <form onSubmit={handlePasswordSubmit} noValidate>
            {/* Current Password */}
            <div className="mb-4">
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  type={showCurrentPw ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  disabled={passwordSubmitting}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="mb-4">
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPw ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  disabled={passwordSubmitting}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPw ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  disabled={passwordSubmitting}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 mt-2" role="alert">{passwordError}</p>
            )}

            <div className="mt-5">
              <button
                type="submit"
                disabled={passwordSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                {passwordSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Card 3 — Reset Demo Data (admin only) */}
        {user?.role === 'Admin' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/40 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <RotateCcw size={18} className="text-red-500" />
              Reset Demo Data
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Wipe all sales, purchases, customers, and showcase data, then re-seed a fresh 6-month dataset.
              This action cannot be undone and may take up to a minute to complete.
            </p>

            {!resetConfirm ? (
              <button
                onClick={() => setResetConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Reset Demo Data
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  This will permanently wipe all demo data. Continue?
                </span>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  {resetting ? 'Resetting…' : 'Yes, Reset'}
                </button>
                <button
                  onClick={() => setResetConfirm(false)}
                  disabled={resetting}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
