import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  useEffect(() => {
    // Set theme for landing
    document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');
    
    // Add landing specific scripts if needed
    const script = document.createElement('script');
    script.innerHTML = `
      console.log('Landing Logic Initialized');
      // Any specific JS from the old index.html can go here
    `;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="landing-wrapper">
       <style>{`
          /* Estilos embebidos de la landing para asegurar paridad visual */
          :root {
            --blue: #2E84F0; --blue-lt: #5AACFF; --green: #25C882; --bg: #060C1A;
          }
          .landing-wrapper { background: var(--bg); color: #fff; min-height: 100vh; font-family: 'Inter', sans-serif; }
          .hero-landing { padding: 8rem 0; text-align: center; background: radial-gradient(circle at top, rgba(46,132,240,0.15), transparent); }
          .landing-btn-primary { 
            background: linear-gradient(135deg, #2E84F0, #1558B0); color: white; 
            padding: 1rem 2.5rem; border-radius: 12px; font-weight: 700; text-decoration: none;
            display: inline-block; box-shadow: 0 10px 20px rgba(46,132,240,0.3);
          }
          /* ... Más estilos se pueden añadir aquí ... */
       `}</style>
       
       <nav style={{ position: 'fixed', top: 0, width: '100%', padding: '1.5rem', background: 'rgba(6,12,26,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#5AACFF' }}>Intelecciones</div>
            <Link to="/login" className="landing-btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>Ingresar</Link>
          </div>
       </nav>

       <section className="hero-landing">
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.5rem' }}>
              La Inteligencia Electoral <span style={{ color: '#5AACFF' }}>en tus manos.</span>
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2.5rem', lineHeight: 1.6 }}>
              Gestiona campañas masivas, coordina equipos de campo y visualiza resultados en tiempo real con la plataforma SaaS líder en Paraguay.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/login" className="landing-btn-primary">Comenzar Ahora →</Link>
            </div>
          </div>
       </section>

       {/* Sección de Módulos Simplificada para el MVP de esta transición */}
       <section style={{ padding: '5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
             <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ marginBottom: '1rem', color: '#5AACFF' }}>Centro de Comando</h3>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Visualización geoespacial y métricas críticas en tiempo real.</p>
             </div>
             <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ marginBottom: '1rem', color: '#25C882' }}>Coordinación de Campo</h3>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>App móvil para padrones offline y sincronización inteligente.</p>
             </div>
             <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ marginBottom: '1rem', color: '#F59E0B' }}>Veeduría Digital</h3>
                <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>Control de actas y monitoreo de mesas de votación.</p>
             </div>
          </div>
       </section>
       
       <footer style={{ padding: '3rem 1rem', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
          © 2026 Intelecciones — Desarrollado por IntelliHouse
       </footer>
    </div>
  );
};

export default LandingPage;
