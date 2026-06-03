import React, { useState, useRef } from 'react';
import { Camera, Send, CheckCircle, RefreshCw, Edit3 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import MainLayout from '../components/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { OfflineQueueService } from '../services/OfflineQueueService';

const CateringApp = () => {
  const { user } = useAuth();
  const [shift, setShift] = useState<'DESAYUNO' | 'ALMUERZO' | 'MERIENDA'>('DESAYUNO');
  const [receivedBy, setReceivedBy] = useState('');
  const [localName, setLocalName] = useState(user?.assigned_local || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const clearSignature = () => {
    sigCanvasRef.current?.clear();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPreview) {
      alert('Debe tomar una fotografía del catering entregado.');
      return;
    }
    if (sigCanvasRef.current?.isEmpty()) {
      alert('Debe firmar para confirmar la entrega.');
      return;
    }

    setLoading(true);
    try {
      const signatureDataUrl = sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
      
      const formData = new FormData();
      formData.append('shift', shift);
      formData.append('received_by', receivedBy);
      formData.append('local', localName);
      formData.append('signature', signatureDataUrl);
      if (photo) {
        formData.append('photo', photo);
      }

      if (navigator.onLine) {
        await api.post('/diad/catering', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Enqueue offline checklist metadata
        await OfflineQueueService.enqueue({
          type: 'CATERING_CHECKLIST',
          url: '/diad/catering',
          method: 'POST',
          data: {
            shift,
            received_by: receivedBy,
            local: localName,
            signature: signatureDataUrl,
            // Convert file preview or metadata if needed, otherwise send signature
            photoUrl: photoPreview
          }
        });
      }

      setSuccess(true);
    } catch (err) {
      alert('Error registrando entrega.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <MainLayout title="Logística Catering" userName={user?.nombre || 'Logística'}>
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          <CheckCircle size={64} style={{ color: 'var(--green)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', marginBottom: '0.5rem' }}>
            Entrega Registrada
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            La entrega de {shift} para el local {localName} ha sido guardada y cargada en el sistema central de logística.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setReceivedBy('');
              setPhoto(null);
              setPhotoPreview(null);
              clearSignature();
            }}
            style={{
              padding: '0.85rem 1.5rem', borderRadius: '12px', border: 'none',
              background: 'var(--plra-500)', color: 'white', fontWeight: 900, cursor: 'pointer'
            }}
          >
            REGISTRAR OTRA ENTREGA
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Logística Catering" userName={user?.nombre || 'Logística'}>
      <form onSubmit={handleSubmit} style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Local & Shift selector */}
        <div className="card-premium-styled" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Turno de Catering</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
              {(['DESAYUNO', 'ALMUERZO', 'MERIENDA'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setShift(opt)}
                  style={{
                    padding: '0.6rem 0.5rem', borderRadius: '10px',
                    border: shift === opt ? '2px solid var(--plra-300)' : '1px solid var(--border)',
                    background: shift === opt ? 'rgba(0,71,171,0.1)' : 'transparent',
                    color: shift === opt ? 'white' : 'var(--text-3)',
                    fontWeight: 900, fontSize: '0.72rem', cursor: 'pointer'
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Local de Votación</label>
            <input
              type="text"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className="modern-input-premium-styled"
              required
              style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Recibido por (Nombre/Cargo)</label>
            <input
              type="text"
              value={receivedBy}
              onChange={e => setReceivedBy(e.target.value)}
              className="modern-input-premium-styled"
              placeholder="Ej. Juan Pérez - Coordinador de Mesa"
              required
              style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Camera capture */}
        <div className="card-premium-styled" style={{ padding: '1.25rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Evidencia Fotográfica
          </label>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />

          {photoPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={photoPreview} alt="Catering" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px' }} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)',
                  border: 'none', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900
                }}
              >
                CAMBIAR
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '2rem 1rem', border: '2px dashed var(--border)', borderRadius: '12px',
                background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'
              }}
            >
              <Camera size={32} style={{ color: 'var(--plra-300)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'white' }}>TOMAR FOTO ENTREGA</span>
            </button>
          )}
        </div>

        {/* Digital canvas signature */}
        <div className="card-premium-styled" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase' }}>Firma de Conformidad</label>
            <button type="button" onClick={clearSignature} style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>
              LIMPIAR
            </button>
          </div>
          <div style={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="white"
              canvasProps={{ width: 440, height: 150, className: 'sigCanvas' }}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '1rem', borderRadius: '14px', border: 'none',
            background: 'linear-gradient(135deg, #2E84F0, #1b74e4)', color: 'white', fontWeight: 900,
            fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,71,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}
        >
          <Send size={18} /> {loading ? 'Enviando...' : 'REGISTRAR ENTREGA'}
        </button>

      </form>
    </MainLayout>
  );
};

export default CateringApp;
