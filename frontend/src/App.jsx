import { useState } from 'react'
import axios from 'axios'

// Resolve the API base URL from the Vite env, falling back to localhost.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Simple client-side validators.
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isValidUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function App() {
  const [email, setEmail] = useState('')
  const [articleUrl, setArticleUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null) // holds { session_id }
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Reset any previous feedback before validating/submitting.
    setError('')
    setSuccess(null)

    // Client-side validation for email and URL format.
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!isValidUrl(articleUrl)) {
      setError('Please enter a valid article URL (http or https).')
      return
    }

    setLoading(true)
    try {
      // POST the email + article URL to the backend /process endpoint.
      const response = await axios.post(`${API_URL}/process`, {
        email,
        article_url: articleUrl,
      })

      setSuccess({ session_id: response.data?.session_id ?? 'unknown' })
    } catch (err) {
      // Surface a useful message from the server, or a generic fallback.
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">AI Article Agent</h1>
        <p className="subtitle">
          Submit an article and we&apos;ll email you a summary plus key insights.
        </p>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="label">Your Email</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="field">
            <span className="label">Article URL</span>
            <input
              type="url"
              required
              placeholder="https://example.com/article"
              value={articleUrl}
              onChange={(e) => setArticleUrl(e.target.value)}
              disabled={loading}
            />
          </label>

          <button type="submit" className="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Processing…
              </>
            ) : (
              'Process Article'
            )}
          </button>
        </form>

        {/* Success feedback */}
        {success && (
          <div className="alert alert-success" role="status">
            <strong>Success!</strong>
            <p>
              Session ID: <code>{success.session_id}</code>
            </p>
            <p>Your summary and insights will be emailed to you shortly.</p>
          </div>
        )}

        {/* Error feedback */}
        {error && (
          <div className="alert alert-error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
