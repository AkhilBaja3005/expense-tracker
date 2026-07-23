import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'inherit',
          color: '#f8fafc',
          background: '#070a13'
        }}>
          <span style={{ fontSize: '32px' }}>⚠️</span>
          <h2 style={{ fontSize: '16px', fontWeight: '700' }}>Something went wrong</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '360px' }}>
            The app hit an unexpected error and couldn't continue. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#06b6d4',
              border: 'none',
              color: '#030712',
              padding: '10px 20px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
