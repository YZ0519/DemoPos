import { Component } from 'react'

/**
 * Top-level error boundary — catches any unhandled render errors and
 * displays a user-friendly fallback instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to console so developers can still see the stack trace
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-4">
              <span className="text-red-600 text-2xl font-bold">!</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. Please reload the page and try again.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 mb-6 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
