const Landing = () => {
  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
      <iframe
        src="/landing.html"
        title="Intelecciones - Plataforma Electoral"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  );
};

export default Landing;
