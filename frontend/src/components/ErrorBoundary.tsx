import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Copy, MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Critical Error Captured:', error, errorInfo);
  }

  private getFullErrorDetails = () => {
    const { error, errorInfo } = this.state;
    return `--- ERROR REPORT ---
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
Message: ${error?.message || 'Unknown Error'}
Stack Trace:
${error?.stack || 'No stack trace available'}
Component Stack:
${errorInfo?.componentStack || 'No component stack available'}
--------------------`;
  };

  private handleCopy = () => {
    const details = this.getFullErrorDetails();
    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    });
  };

  private handleWhatsApp = () => {
    const details = this.getFullErrorDetails();
    const message = encodeURIComponent(`Hola Soporte, mi aplicación ha tenido un error:\n\n${details}`);
    const wpUrl = `https://wa.me/595994516360?text=${message}`;
    window.open(wpUrl, '_blank');
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#020617', color: 'white', padding: '1rem', textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{ 
            maxWidth: '500px', width: '100%', padding: '2.5rem', 
            background: 'rgba(255,255,255,0.03)', borderRadius: '24px', 
            border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ 
              width: '64px', height: '64px', background: 'rgba(239,68,68,0.1)', 
              borderRadius: '16px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', margin: '0 auto 1.5rem', color: '#EF4444' 
            }}>
              <AlertTriangle size={32} />
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '0.75rem' }}>Incidencia Técnica</h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Se ha producido un error crítico que impide continuar. Por favor, informa a soporte para que podamos resolverlo de inmediato.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={this.handleWhatsApp}
                style={{
                  background: '#25D366', color: 'white', border: 'none',
                  padding: '1rem', borderRadius: '14px', fontWeight: 800, 
                  cursor: 'pointer', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem'
                }}
              >
                <MessageSquare size={18} /> REPORTAR POR WHATSAPP
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button 
                  onClick={this.handleCopy}
                  style={{
                    background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0.8rem', borderRadius: '12px', fontWeight: 700, 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem'
                  }}
                >
                  <Copy size={16} /> {this.state.copied ? 'COPIADO' : 'COPIAR ERROR'}
                </button>

                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    background: 'var(--plra-500)', color: 'white', border: 'none',
                    padding: '0.8rem', borderRadius: '12px', fontWeight: 700, 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem'
                  }}
                >
                  <RefreshCw size={16} /> REINTENTAR
                </button>
              </div>
            </div>

            <button 
              onClick={() => this.setState({ showDetails: !this.state.showDetails })}
              style={{ 
                marginTop: '1.5rem', background: 'none', border: 'none', 
                color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', 
                cursor: 'pointer', display: 'flex', alignItems: 'center', 
                gap: '0.4rem', margin: '1.5rem auto 0' 
              }}
            >
              {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {this.state.showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
            </button>

            {this.state.showDetails && (
              <div style={{ 
                marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', 
                borderRadius: '12px', fontSize: '0.7rem', color: '#FCA5A5', 
                overflowX: 'auto', textAlign: 'left', border: '1px solid rgba(239,68,68,0.1)',
                maxHeight: '200px', overflowY: 'auto'
              }}>
                <div style={{ fontWeight: 800, marginBottom: '0.5rem', color: '#EF4444' }}>DETALLES DEL ERROR:</div>
                <pre style={{ margin: 0 }}>{this.getFullErrorDetails()}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
