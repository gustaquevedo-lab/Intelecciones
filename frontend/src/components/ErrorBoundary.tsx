import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#020C1E', color: 'white', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ maxWidth: '400px' }}>
            <h1 style={{ fontSize: '1.5rem', color: '#EF4444', marginBottom: '1rem' }}>Algo salió mal</h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem' }}>
              La aplicación ha encontrado un error inesperado. Por favor, intenta recargar la página.
            </p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--plra-500)', color: 'white', border: 'none',
                padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              RECARGAR APLICACIÓN
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre style={{ 
                marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px', fontSize: '0.7rem', color: '#FCA5A5', overflowX: 'auto', textAlign: 'left'
              }}>
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
