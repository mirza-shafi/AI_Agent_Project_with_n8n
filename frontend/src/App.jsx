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

/* ---- Inline icons (no icon library needed) ---- */
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
)
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2zM19 14l.9 2.6L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.4L19 14zM5 14l.9 2.6L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.4L5 14z" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
)

function App() {
  const [email, setEmail] = useState('')
  const [articleUrl, setArticleUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null) // holds { session_id }
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)

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
      const response = await axios.post(`${API_URL}/process`, {
        email,
        article_url: articleUrl,
      })
      setSuccess({ session_id: response.data?.session_id ?? 'unknown' })
    } catch (err) {
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

  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(success.session_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard not available; ignore */
    }
  }

  const reset = () => {
    setSuccess(null)
    setError('')
    setEmail('')
    setArticleUrl('')
  }

  return (
    <div className="page">
      {/* Animated background blobs */}
      <div className="bg">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
      </div>

      <main className="card">
        <div className="badge">
          <SparkIcon />
          <span>AI Powered</span>
        </div>

        <h1 className="title">AI Article Agent</h1>
        <p className="subtitle">
          Drop in any article link and we&apos;ll read it, summarize it, pull the
          key insights, and email them straight to you.
        </p>

        {!success ? (
          <form className="form" onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span className="label">Your Email</span>
              <span className="input-wrap">
                <span className="input-icon"><MailIcon /></span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </span>
            </label>

            <label className="field">
              <span className="label">Article URL</span>
              <span className="input-wrap">
                <span className="input-icon"><LinkIcon /></span>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/article"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  disabled={loading}
                />
              </span>
            </label>

            <button type="submit" className="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Processing…
                </>
              ) : (
                <>
                  <SparkIcon />
                  Process Article
                </>
              )}
            </button>

            {error && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon"><AlertIcon /></span>
                <div>
                  <strong>Couldn&apos;t submit</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </form>
        ) : (
          <div className="result" role="status">
            <div className="result-check"><CheckIcon /></div>
            <h2 className="result-title">You&apos;re all set!</h2>
            <p className="result-text">
              Your summary and key insights are being generated and will land in
              your inbox shortly.
            </p>

            <div className="session">
              <span className="session-label">Session ID</span>
              <div className="session-row">
                <code>{success.session_id}</code>
                <button type="button" className="copy" onClick={copySession}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <button type="button" className="ghost" onClick={reset}>
              Process another article
            </button>
          </div>
        )}
      </main>

      <p className="footer">Built with React · FastAPI · n8n · Gemini</p>
    </div>
  )
}

export default App
