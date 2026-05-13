import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    // ─── Intersection Observer for Animations ───
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        el.classList.add('visible');
        
        let delay = 0;
        el.querySelectorAll('.fade-in').forEach(child => {
          const childEl = child as HTMLElement;
          if (!childEl.classList.contains('visible')) {
            childEl.style.transitionDelay = delay + 'ms';
            childEl.classList.add('visible');
            delay += 90;
          }
        });
        io.unobserve(el);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => io.observe(el));

    // ─── Scroll Active State ───
    const sections = document.querySelectorAll('section[id]');
    const onScroll = () => {
      let cur = '';
      sections.forEach(s => {
        const section = s as HTMLElement;
        if (window.scrollY >= section.offsetTop - 120) cur = section.id;
      });
      
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(l => {
        const link = l as HTMLElement;
        const href = link.getAttribute('href');
        if (href === `#${cur}`) {
          link.style.color = '#5AACFF';
          link.style.background = 'rgba(90,172,255,0.08)';
        } else {
          link.style.color = '';
          link.style.background = '';
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  return (
    <div className="landing-wrapper">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido principal</a>

      {/* ══════════════════════════════════════════════ NAV */}
      <nav>
        <div className="container">
          <div className="nav-inner">
            <a href="#" className="nav-logo" aria-label="Intelecciones - Inicio">
              <svg viewBox="0 0 80 80" width="34" height="34" fill="none" aria-hidden="true">
                <defs><linearGradient id="nl" x1="15%" y1="0%" x2="85%" y2="110%"><stop offset="0%" stopColor="#1E3A6E"/><stop offset="100%" stopColor="#0D1F42"/></linearGradient></defs>
                <rect width="80" height="80" rx="18" fill="url(#nl)"/>
                <g transform="translate(40,30) rotate(-10)">
                  <rect x="-11" y="-14" width="22" height="19" rx="2" fill="white" opacity="0.97"/>
                  <line x1="-6" y1="-8" x2="6" y2="-8" stroke="#D0DCF0" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="-6" y1="-3" x2="2" y2="-3" stroke="#D0DCF0" strokeWidth="1.2" strokeLinecap="round"/>
                  <path d="M-8,1 L-1,8 L10,-7" fill="none" stroke="#22C47E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                <rect x="12" y="41" width="56" height="8" rx="2" fill="white" opacity="0.95"/>
                <rect x="27" y="43" width="26" height="4" rx="1" fill="url(#nl)" opacity="0.45"/>
                <rect x="15" y="47" width="50" height="29" rx="3" fill="white" opacity="0.95"/>
                <circle cx="40" cy="63" r="4" fill="url(#nl)" opacity="0.18"/><circle cx="40" cy="63" r="2" fill="url(#nl)" opacity="0.3"/>
                <circle cx="69" cy="12" r="7" fill="#2E84F0"/>
              </svg>
              <div className="nav-wordmark"><span className="int">Int</span><span className="rest">elecciones</span></div>
            </a>
            <div className="nav-links" role="navigation" aria-label="Menú principal">
              <a href="#modulos" className="nav-link">Módulos</a>
              <a href="#vistas" className="nav-link">Vistas</a>
              <a href="#comparativa" className="nav-link">Comparativa</a>
              <a href="#preguntas" className="nav-link">FAQ</a>
              <a href="#ecosistema" className="nav-link">Ecosistema</a>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <button onClick={toggleTheme} className="theme-toggle" aria-label="Cambiar tema">
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
              <Link to="/login" className="btn-secondary" style={{padding:'0.55rem 1.1rem',fontSize:'0.82rem',borderColor:'rgba(90,172,255,0.25)',color:'var(--blue-lt)'}}>
                Ingresar
              </Link>
              <a href="#contacto" className="btn-primary" style={{padding:'0.55rem 1.1rem',fontSize:'0.82rem'}}>
                Solicitar Demo →
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main id="contenido-principal">
        {/* ══════════════════════════════════════════════ HERO */}
        <section className="hero">
          <div className="hero-bg" aria-hidden="true"></div>
          <div className="container">
            <div className="hero-grid">
              <div>
                <div style={{marginBottom:'1.5rem'}}>
                  <span className="tag">🇵🇾 Plataforma electoral para Paraguay</span>
                </div>
                <h1 className="hero-title">
                  Gana quien<br/>
                  <span className="gradient-text">mejor organice</span><br/>
                  su campaña.
                </h1>
                <p className="hero-sub">
                  Centro de comando en tiempo real, coordinación de campo móvil, logística de transporte, veeduría digital y WhatsApp masivo — todo integrado, todo sincronizado.
                </p>
                <div className="hero-ctas">
                  <a href="#contacto" className="btn-primary">Solicitar Demo gratuita →</a>
                  <a href="https://wa.me/595994516360?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Intelecciones" className="btn-secondary" target="_blank" rel="noopener" style={{gap:'0.5rem'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#25D366" style={{flexShrink:0}}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.528 5.852L0 24l6.334-1.506A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 0 1-5.032-1.388l-.36-.214-3.762.895.952-3.666-.234-.375A9.794 9.794 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
                    WhatsApp
                  </a>
                </div>
                <div className="hero-stats">
                  <div><div className="hero-stat-num">6</div><div className="hero-stat-lbl">Módulos integrados</div></div>
                  <div><div className="hero-stat-num">4</div><div className="hero-stat-lbl">Roles de acceso</div></div>
                  <div><div className="hero-stat-num">100%</div><div className="hero-stat-lbl">Tiempo real</div></div>
                  <div><div className="hero-stat-num">Web</div><div className="hero-stat-lbl">Sin instalar nada</div></div>
                </div>
              </div>

              <div className="fade-in">
                <div className="mockup-shell">
                  <div className="mockup-topbar">
                    <div className="m-dot" style={{background:'#FF5F57'}}></div>
                    <div className="m-dot" style={{background:'#FEBC2E'}}></div>
                    <div className="m-dot" style={{background:'#28C840'}}></div>
                    <span className="m-title">Centro de Comando — PLRA 2026</span>
                    <div className="badge-live">LIVE</div>
                  </div>
                  <div className="mockup-body">
                    <div className="stat-row">
                      <div className="stat-chip"><div className="stat-chip-num" style={{color:'#25C882'}}>3.842</div><div className="stat-chip-lbl">A Favor</div></div>
                      <div className="stat-chip"><div className="stat-chip-num" style={{color:'#F59E0B'}}>1.203</div><div className="stat-chip-lbl">Indeciso</div></div>
                      <div className="stat-chip"><div className="stat-chip-num" style={{color:'#F87171'}}>412</div><div className="stat-chip-lbl">En Contra</div></div>
                      <div className="stat-chip"><div className="stat-chip-num" style={{color:'#5AACFF'}}>2.541</div><div className="stat-chip-lbl">Sin Dato</div></div>
                    </div>
                    <div className="map-placeholder">
                      <div className="map-dot" style={{background:'#25C882',color:'#25C882',top:'30%',left:'25%'}}></div>
                      <div className="map-dot" style={{background:'#25C882',color:'#25C882',top:'55%',left:'60%'}}></div>
                      <div className="map-dot" style={{background:'#F59E0B',color:'#F59E0B',top:'38%',left:'72%'}}></div>
                      <div className="map-dot" style={{background:'#2E84F0',color:'#2E84F0',top:'65%',left:'38%'}}></div>
                      <div className="map-dot" style={{background:'#25C882',color:'#25C882',top:'22%',left:'52%'}}></div>
                      <div className="map-dot" style={{background:'#F87171',color:'#F87171',top:'70%',left:'78%'}}></div>
                      <div className="map-dot" style={{background:'#25C882',color:'#25C882',top:'48%',left:'18%'}}></div>
                      <span className="map-lbl">🗺 LOCALES DE VOTACIÓN · EN VIVO</span>
                    </div>
                    <div className="alert-list">
                      <div className="alert-item"><div className="a-dot" style={{background:'#25C882'}}></div>Coordinador Barrio Obrero registró 12 electores</div>
                      <div className="alert-item"><div className="a-dot" style={{background:'#F59E0B'}}></div>Solicitud de transporte: Local 142 — Mesa 8</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* ══════════════════════════════════════════════ DOLOR */}
        <section className="pain" id="dolor">
          <div className="container">
            <div className="fade-in" style={{maxWidth:'640px'}}>
              <span className="tag" style={{display:'inline-flex',marginBottom:'1rem'}}>El problema real</span>
              <h2 className="section-title" style={{marginBottom:'1rem'}}>
                Las campañas se pierden<br/>por <span style={{color:'#FCA5A5'}}>falta de coordinación.</span>
              </h2>
              <p className="section-sub">No es falta de votos. Es no saber dónde están, no poder movilizarlos a tiempo y perder el control total el día D.</p>
            </div>
            <div className="pain-grid">
              <div className="pain-card fade-in"><div className="pain-icon">📋</div><h3 className="pain-title">Padrones en papel o Excel</h3><div className="pain-desc">Sin visibilidad en tiempo real de quiénes captaron tus coordinadores. La información llega tarde, duplicada o nunca llega.</div></div>
              <div className="pain-card fade-in"><div className="pain-icon">🚗</div><h3 className="pain-title">Logística improvisada el día D</h3><div className="pain-desc">Vehículos sin asignar, electores sin transporte, coordinadores incomunicados. Votos que se pierden por pura desorganización.</div></div>
              <div className="pain-card fade-in"><div className="pain-icon">📍</div><h3 className="pain-title">Sin visión territorial</h3><div className="pain-desc">¿Cuántos votos tenés asegurados por local? ¿Qué mesa necesita refuerzo? Sin mapa, sin datos, sin estrategia real.</div></div>
              <div className="pain-card fade-in"><div className="pain-icon">💬</div><h3 className="pain-title">WhatsApp manual e ineficiente</h3><div className="pain-desc">Grupos caóticos, sin templates, sin seguimiento. Miles de electores que no reciben la convocatoria a tiempo.</div></div>
              <div className="pain-card fade-in"><div className="pain-icon">🗳️</div><h3 className="pain-title">Veeduría sin sistema</h3><div className="pain-desc">Fiscales de mesa sin herramienta. No sabés en tiempo real cuántos de tus votantes ya ejercieron su voto.</div></div>
              <div className="pain-card fade-in"><div className="pain-icon">📊</div><h3 className="pain-title">Sin control de resultados</h3><div className="pain-desc">Al cierre de urnas, no sabés qué coordinadores rindieron, qué zonas fallaron ni cómo comparás con el objetivo. Evaluás a ciegas.</div></div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* ══════════════════════════════════════════════ MÓDULOS */}
        <section className="modules" id="modulos">
          <div className="container">
            <div className="modules-header fade-in">
              <span className="tag tag-green">Plataforma completa</span>
              <h2 className="section-title" style={{marginTop:'1rem'}}>6 módulos. Un solo sistema.</h2>
              <p className="section-sub" style={{margin:'1rem auto 0'}}>Cada rol de tu campaña tiene su herramienta específica, todos conectados y sincronizados en tiempo real.</p>
            </div>
            <div className="modules-grid">
              <article className="module-card fade-in">
                <div className="module-icon" style={{background:'rgba(46,132,240,0.12)',border:'1px solid rgba(46,132,240,0.2)'}}>🗺️</div>
                <h3 className="module-title">Centro de Comando</h3>
                <div className="module-desc">Panel estratégico para el Jefe de Campaña. Visión 360° en tiempo real de toda la operación.</div>
                <ul className="module-features">
                  <li>Estadísticas en vivo: a favor / indeciso / en contra</li>
                  <li>Mapa interactivo de locales de votación</li>
                  <li>Alertas y solicitudes del campo</li>
                  <li>Tabla de gestión de electores</li>
                  <li>Countdown a la fecha electoral</li>
                </ul>
              </article>
              {/* Rest of the modules... I'll include all 6 */}
              <article className="module-card fade-in">
                <div className="module-icon" style={{background:'rgba(37,200,130,0.1)',border:'1px solid rgba(37,200,130,0.2)'}}>👥</div>
                <h3 className="module-title">App de Coordinador</h3>
                <div className="module-desc">Herramienta móvil para coordinadores de campo. Capta y gestiona electores directamente desde el celular.</div>
                <ul className="module-features">
                  <li>Búsqueda por cédula con autocompletado</li>
                  <li>Semáforo de apoyo: verde / amarillo / rojo</li>
                  <li>Datos de local, mesa y orden de votación</li>
                  <li>Solicitudes de transporte al comando</li>
                  <li>Historial y estadísticas propias</li>
                </ul>
              </article>
              <article className="module-card fade-in">
                <div className="module-icon" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)'}}>✅</div>
                <h3 className="module-title">Veeduría Digital</h3>
                <div className="module-desc">Para fiscales de mesa. Registra quiénes ya votaron en tiempo real, sincronizado con el comando.</div>
                <ul className="module-features">
                  <li>Grilla digital por número de orden</li>
                  <li>Marcado de voto con un solo toque</li>
                  <li>Sincronización inmediata con comando central</li>
                  <li>Vista de mesa asignada con información del local</li>
                </ul>
              </article>
              <article className="module-card fade-in">
                <div className="module-icon" style={{background:'rgba(168,85,247,0.1)',border:'1px solid rgba(168,85,247,0.2)'}}>🚗</div>
                <h3 className="module-title">Logística</h3>
                <div className="module-desc">Gestión de flota y transporte de electores. El día D coordinado, sin improvisación.</div>
                <ul className="module-features">
                  <li>Registro de vehículos, conductores y placas</li>
                  <li>Asignación de electores por unidad</li>
                  <li>Solicitudes pendientes en tiempo real</li>
                  <li>Control de capacidad por vehículo</li>
                </ul>
              </article>
              <article className="module-card fade-in">
                <div className="module-icon" style={{background:'rgba(37,200,130,0.1)',border:'1px solid rgba(37,200,130,0.2)'}}>💬</div>
                <h3 className="module-title">WhatsApp Hub</h3>
                <div className="module-desc">Envío masivo de mensajes personalizados a electores vía WhatsApp Business integrado.</div>
                <ul className="module-features">
                  <li>Conexión vía QR — sin costo de API</li>
                  <li>Templates de mensajes personalizados</li>
                  <li>Envío segmentado por lista o zona</li>
                  <li>Estado de sesión en tiempo real</li>
                </ul>
              </article>
              <article className="module-card fade-in" style={{borderColor:'rgba(37,200,130,0.2)',background:'rgba(10,26,42,0.8)'}}>
                <div className="module-icon" style={{background:'rgba(37,200,130,0.12)',border:'1px solid rgba(37,200,130,0.25)'}}>📊</div>
                <h3 className="module-title">Control de Resultados</h3>
                <div className="module-desc">Seguimiento en tiempo real del avance vs meta, evaluación por coordinador y comparación entre listas.</div>
                <ul className="module-features">
                  <li>Dashboard de avance vs objetivo global</li>
                  <li>Ranking y rendimiento por coordinador</li>
                  <li>Comparativa entre listas (Concejal / Intendente)</li>
                  <li>Análisis de zonas calientes y frías</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* ══════════════════════════════════════════════ SCREEN PREVIEWS */}
        <section className="previews" id="vistas">
          <div className="container">
            <div className="previews-header fade-in">
              <span className="tag" style={{display:'inline-flex',marginBottom:'1rem'}}>Vistas reales</span>
              <h2 className="section-title">Así se ve por dentro.</h2>
              <p className="section-sub" style={{margin:'0.75rem auto 0',textAlign:'center'}}>Cada módulo tiene una interfaz diseñada específicamente para su contexto de uso — campo, comando, mesa o análisis.</p>
            </div>

            {/* Preview 1: Coordinator */}
            <div className="preview-block">
              <div className="fade-in">
                <div className="preview-eyebrow"><span className="tag tag-green">App de Coordinador</span></div>
                <h3 className="preview-title">Tu equipo de campo, coordinado desde el celular.</h3>
                <p className="preview-desc">El coordinador busca al elector por cédula, ve su local y mesa de votación, registra su nivel de apoyo con el semáforo y solicita transporte — todo desde una pantalla, en segundos.</p>
                <ul className="preview-bullets">
                  <li><span className="bul-icon">✓</span> Búsqueda con autocompletado al escribir la cédula</li>
                  <li><span className="bul-icon">✓</span> Semáforo visual de apoyo (sin texto, solo color)</li>
                  <li><span className="bul-icon">✓</span> Información de local, mesa y orden de votación</li>
                  <li><span className="bul-icon">✓</span> Un toque para solicitar transporte al comando</li>
                </ul>
              </div>
              <div className="fade-in" style={{maxWidth:'340px',margin:'0 auto',width:'100%'}}>
                <div className="mockup-shell">
                  <div className="mockup-topbar">
                    <div className="m-dot" style={{background:'#FF5F57'}}></div>
                    <div className="m-dot" style={{background:'#FEBC2E'}}></div>
                    <div className="m-dot" style={{background:'#28C840'}}></div>
                    <span className="m-title">App Coordinador · Campo</span>
                  </div>
                  <div style={{padding:'0.85rem'}}>
                    <div className="coord-search">
                      <span className="coord-search-icon">🔍</span>
                      <span className="coord-search-text">4.521.836<span className="coord-search-cursor"></span></span>
                    </div>
                    <div className="voter-card">
                      <div className="voter-card-header">
                        <div className="voter-avatar">MR</div>
                        <div>
                          <div className="voter-name">MARIO RODRÍGUEZ</div>
                          <div className="voter-ci">CI: 4.521.836</div>
                        </div>
                        <div className="voter-badge-active">ACTIVO</div>
                      </div>
                      <div className="voter-body">
                        <div className="voter-info-row">
                          <div className="voter-info-item"><div className="voter-info-lbl">Local</div><div className="voter-info-val" style={{fontSize:'0.65rem'}}>Esc. Rep. Argentina</div></div>
                          <div className="voter-info-item"><div className="voter-info-lbl">Mesa</div><div className="voter-info-val">45</div></div>
                          <div className="voter-info-item"><div className="voter-info-lbl">Orden</div><div className="voter-info-val">#182</div></div>
                        </div>
                        <div className="semaforo-label">Nivel de apoyo</div>
                        <div className="semaforo-row">
                          <button className="sem-btn sem-green sem-active"></button>
                          <button className="sem-btn sem-yellow"></button>
                          <button className="sem-btn sem-red"></button>
                        </div>
                        <div className="voter-cta">✅ Registrar Elector</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview 2: Veedor */}
            <div className="preview-block reverse">
              <div className="fade-in">
                <div className="preview-eyebrow"><span className="tag">Veeduría Digital</span></div>
                <h3 className="preview-title">Fiscal de mesa digitalizado. Saber quién votó, en tiempo real.</h3>
                <p className="preview-desc">El fiscal de mesa toca el número de orden cuando el elector vota. El comando ve el avance al instante. Sin papeles, sin llamadas, sin dudas.</p>
                <ul className="preview-bullets">
                  <li><span className="bul-icon">✓</span> Grilla completa de electores de la mesa asignada</li>
                  <li><span className="bul-icon">✓</span> Marcado individual con confirmación visual</li>
                  <li><span className="bul-icon">✓</span> Barra de progreso: votaron X de Y</li>
                </ul>
              </div>
              <div className="fade-in" style={{maxWidth:'360px',margin:'0 auto',width:'100%'}}>
                <div className="mockup-shell">
                  <div className="mockup-topbar">
                    <div className="m-dot" style={{background:'#FF5F57'}}></div>
                    <div className="m-dot" style={{background:'#FEBC2E'}}></div>
                    <div className="m-dot" style={{background:'#28C840'}}></div>
                    <span className="m-title">Veeduría · Mesa 45</span>
                    <div className="badge-live">EN VIVO</div>
                  </div>
                  <div className="veedor-header">
                    <div className="veedor-local">Esc. República Argentina</div>
                    <div className="veedor-mesa-info"><span>Mesa 45</span><span>|</span><span>32 votaron</span></div>
                  </div>
                  <div className="veedor-progress">
                    <div className="vp-label"><span>Participación</span><span style={{color:'var(--green)',fontWeight:700}}>26.7%</span></div>
                    <div className="vp-bar"><div className="vp-fill" style={{width:'26.7%'}}></div></div>
                  </div>
                  <div className="veedor-grid">
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(i => (
                      <div key={i} className={`vg-cell ${[1,2,3,4,6,7,9,10,11,13,14,16,18,19].includes(i) ? 'vg-voted' : 'vg-empty'}`}>{i}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* ══════════════════════════════════════════════ HOW IT WORKS */}
        <section className="how" id="como-funciona">
          <div className="container">
            <div className="fade-in" style={{maxWidth:'640px',marginBottom:'0'}}>
              <span className="tag" style={{display:'inline-flex',marginBottom:'1rem'}}>Simple por diseño</span>
              <h2 className="section-title">Arrancá en 3 pasos.</h2>
            </div>
            <div className="how-grid">
              <div className="how-step fade-in">
                <div className="how-num">1</div>
                <h3 className="how-title">Configuramos tu campaña</h3>
                <div className="how-desc">Cargamos tus listas, locales de votación y estructura del equipo. Personalización completa con tu marca y fecha electoral.</div>
              </div>
              <div className="how-step fade-in">
                <div className="how-num">2</div>
                <h3 className="how-title">Activamos a tu equipo</h3>
                <div className="how-desc">Cada coordinador, veedor y logístico recibe su acceso con rol específico. Onboarding incluido — la app es intuitiva desde el primer uso.</div>
              </div>
              <div className="how-step fade-in">
                <div className="how-num">3</div>
                <h3 className="how-title">Ganás el día D</h3>
                <div className="how-desc">Vista completa en tiempo real, transporte coordinado, veeduría activa y comunicación masiva. Tu campaña en modo élite.</div>
              </div>
            </div>
          </div>
        </section>

        <div className="divider"></div>

        {/* ══════════════════════════════════════════════ COMPARATIVA */}
        <section className="compare" id="comparativa">
          <div className="container">
            <div className="compare-header fade-in">
              <span className="tag">Comparativa</span>
              <h2 className="section-title" style={{marginTop:'1rem'}}>
                <span className="gradient-text">Intelecciones</span> vs otras plataformas
              </h2>
              <p className="section-sub" style={{margin:'1rem auto 0',textAlign:'center'}}>
                No todas las herramientas electorales son iguales. Estas son las diferencias que importan en el terreno.
              </p>
            </div>
            <div className="fade-in">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="th-feature">Característica</th>
                    <th className="th-us">⚡ Intelecciones</th>
                    <th className="th-them">Comicios</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{background:'rgba(37,200,130,0.03)'}}>
                    <td colSpan={3} style={{padding:'0.5rem 1.5rem',fontSize:'0.6rem',fontWeight:800,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--green)',borderBottom:'1px solid rgba(37,200,130,0.1)'}}>
                      Exclusivo de Intelecciones
                    </td>
                  </tr>
                  <tr>
                    <td className="feature-name"><strong>WhatsApp Hub integrado</strong><br/><span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Envío masivo a electores sin costo de API, con templates</span></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                    <td className="td-center"><span className="check-no">—</span></td>
                  </tr>
                  <tr>
                    <td className="feature-name"><strong>Logística de transporte</strong><br/><span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Flota de vehículos, conductores y solicitudes en tiempo real</span></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                    <td className="td-center"><span className="check-no">—</span></td>
                  </tr>
                  <tr>
                    <td className="feature-name"><strong>Multi-lista (Concejal + Intendente)</strong><br/><span style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Vista global o por lista en un clic</span></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                    <td className="td-center"><span className="check-no">—</span></td>
                  </tr>
                  <tr style={{background:'rgba(46,132,240,0.03)'}}>
                    <td colSpan={3} style={{padding:'0.5rem 1.5rem',fontSize:'0.6rem',fontWeight:800,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--blue-lt)',borderBottom:'1px solid rgba(46,132,240,0.1)'}}>
                      Capacidades compartidas
                    </td>
                  </tr>
                  <tr>
                    <td className="feature-name"><strong>App de coordinador de campo</strong></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                  </tr>
                  <tr>
                    <td className="feature-name"><strong>Veeduría digital de mesa</strong></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                    <td className="td-center"><span className="check-yes">✓</span></td>
                  </tr>
                </tbody>
              </table>
              <p className="compare-note">* Basado en análisis de funcionalidades publicadas por ambas plataformas. Mayo 2026.</p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════ ECOSYSTEM */}
        <section className="ecosystem" id="ecosistema">
          <div className="container">
            <div className="eco-grid">
              <div className="fade-in">
                <span className="tag" style={{display:'inline-flex',marginBottom:'1.5rem'}}>IntelliHouse Ecosystem</span>
                <h2 className="section-title">Parte de algo<br/><span className="gradient-text">más grande.</span></h2>
                <p className="section-sub" style={{marginTop:'1rem'}}>
                  Intelecciones es parte del ecosistema IntelliHouse — la suite de soluciones de inteligencia de datos para organizaciones en Paraguay.
                </p>
              </div>
              <div className="fade-in">
                <div className="eco-products">
                  <div className="eco-product eco-active">
                    <div className="eco-name"><span style={{color:'#5AACFF',fontWeight:800}}>Int</span><span style={{color:'#25C882',fontWeight:300}}>elecciones</span></div>
                    <div className="eco-desc">Gestión integral de campañas electorales</div>
                  </div>
                  <div className="eco-product">
                    <div className="eco-name"><span style={{color:'#5AACFF',fontWeight:800}}>Inteli</span><span style={{color:'#25C882',fontWeight:300}}>audit</span></div>
                    <div className="eco-desc">Auditoría y control de gestión inteligente</div>
                  </div>
                  <div className="eco-product">
                    <div className="eco-name"><span style={{color:'#5AACFF',fontWeight:800}}>Sueld</span><span style={{color:'#25C882',fontWeight:300}}>OK</span></div>
                    <div className="eco-desc">Gestión de recursos humanos y nómina</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════ FAQ */}
        <section className="faq-section" id="preguntas">
          <div className="container">
            <div className="faq-section-header fade-in">
              <span className="tag" style={{display:'inline-flex',marginBottom:'1rem'}}>Preguntas frecuentes</span>
              <h2 className="section-title">Todo lo que necesitás saber.</h2>
            </div>
            <div className="faq-grid">
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Qué es Intelecciones?</summary>
                <p className="faq-a">Plataforma web de gestión integral de campañas electorales, desarrollada por IntelliHouse para Paraguay. Centro de comando, app de campo, veeduría digital, logística de transporte y WhatsApp Hub — todo sincronizado en tiempo real.</p>
              </details>
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Cuánto tiempo toma la implementación?</summary>
                <p className="faq-a">Setup completo en aproximadamente <strong>48 horas</strong>. Cargamos tus listas, locales de votación y estructura del equipo. El onboarding de coordinadores y veedores está incluido.</p>
              </details>
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Hay que instalar alguna aplicación?</summary>
                <p className="faq-a">No. Funciona <strong>100% en el navegador web</strong> — computadoras y smartphones. Sin descargas, sin actualizaciones manuales. Cada rol accede desde su dispositivo habitual con solo abrir el link.</p>
              </details>
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Qué roles de usuario tiene la plataforma?</summary>
                <p className="faq-a">Cuatro roles: <strong>Jefe de Campaña</strong> (Centro de Comando completo), <strong>Coordinador de Campo</strong> (app móvil de captación), <strong>Miembro de Mesa / Veedor</strong> (veeduría digital) y <strong>Candidato</strong> (vista de solo lectura).</p>
              </details>
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Funciona para elecciones municipales y departamentales?</summary>
                <p className="faq-a">Sí. Diseñado para cualquier elección en Paraguay: municipales (intendente y concejales), departamentales y nacionales. Soporta <strong>múltiples listas simultáneas</strong>.</p>
              </details>
              <details className="faq-item fade-in">
                <summary className="faq-q">¿Funciona con conexión limitada en el interior?</summary>
                <p className="faq-a">Sí. La interfaz está optimizada para conexiones móviles lentas, comunes en el interior de Paraguay. Liviana por diseño y funcional desde cualquier smartphone.</p>
              </details>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════ CTA FINAL */}
        <section className="cta-section" id="contacto">
          <div className="cta-bg" aria-hidden="true"></div>
          <div className="container">
            <div className="cta-inner fade-in">
              <h2 className="cta-title">¿Listo para ganar con inteligencia?</h2>
              <div className="cta-buttons">
                <a href="https://wa.me/595994516360" className="btn-primary" target="_blank" rel="noopener">Hablar por WhatsApp</a>
                <Link to="/login" className="btn-secondary">Ingresar al sistema</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <span style={{fontFamily:'var(--font-d)',fontWeight:800,color:'#5AACFF'}}>Int<span style={{fontWeight:300,color:'#25C882'}}>elecciones</span></span>
              <span className="footer-copy" style={{marginLeft:'0.5rem'}}>© 2026 IntelliHouse. Paraguay.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp Float */}
      <a href="https://wa.me/595994516360" className="wa-float" target="_blank" rel="noopener">
        <div className="wa-float-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.528 5.852L0 24l6.334-1.506A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 0 1-5.032-1.388l-.36-.214-3.762.895.952-3.666-.234-.375A9.794 9.794 0 0 1 2.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/></svg>
        </div>
        <span className="wa-float-label">Consultá por WhatsApp</span>
      </a>
    </div>
  );
};

export default LandingPage;
