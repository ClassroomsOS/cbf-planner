/**
 * ErrorBoundary.jsx — Catches React render crashes
 * 
 * Prevents the entire app from going white when a component throws.
 * Logs the error to Supabase via logError() and shows a friendly recovery screen.
 * 
 * Usage in App.jsx:
 *   import ErrorBoundary from './components/ErrorBoundary'
 *   <ErrorBoundary><BrowserRouter>...</BrowserRouter></ErrorBoundary>
 */

import { Component } from 'react'
import { logError } from '../utils/logger'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to Supabase — fire and forget
    logError(error, {
      page: 'ErrorBoundary',
      action: 'react_crash',
      componentStack: errorInfo?.componentStack || null,
    })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/cbf-planner/'
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Algo salió mal</h2>
          <p style={styles.message}>
            Ocurrió un error inesperado. Tu trabajo guardado no se ha perdido.
          </p>

          {/* Show error in dev mode */}
          {import.meta.env.DEV && this.state.error && (
            <pre style={styles.errorDetail}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
            </pre>
          )}

          <div style={styles.actions}>
            <button onClick={this.handleReload} style={styles.btnPrimary}>
              🔄 Recargar página
            </button>
            <button onClick={this.handleGoHome} style={styles.btnSecondary}>
              🏠 Ir al inicio
            </button>
          </div>

          <p style={styles.hint}>
            Si el error persiste, intenta cerrar sesión y volver a entrar.
            El equipo técnico ha sido notificado automáticamente.
          </p>
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
    background: '#f5f7fb',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  card: {
    background: 'white',
    borderRadius: 16,
    padding: '48px 40px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#1a1a2e',
    margin: '0 0 12px',
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 1.5,
    margin: '0 0 24px',
  },
  errorDetail: {
    textAlign: 'left',
    background: '#FFF5F5',
    border: '1px solid #FED7D7',
    borderRadius: 8,
    padding: 12,
    fontSize: 11,
    color: '#C53030',
    overflow: 'auto',
    maxHeight: 160,
    marginBottom: 24,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  btnPrimary: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: 10,
    background: '#1A3A8F',
    color: 'white',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 24px',
    border: '1.5px solid #ddd',
    borderRadius: 10,
    background: 'white',
    color: '#555',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  hint: {
    fontSize: 11,
    color: '#aaa',
    lineHeight: 1.4,
    margin: 0,
  },
}
