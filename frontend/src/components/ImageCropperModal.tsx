import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion } from 'framer-motion';
import { X, Crop as CropIcon, MousePointer2 } from 'lucide-react';

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ image, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    if (!ctx) return new Blob();

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      400,
      400
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob as Blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleDone = async () => {
    if (imgRef.current && completedCrop) {
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      onCropComplete(blob);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{
        width: '95%', maxWidth: '600px', background: '#0a0e17',
        borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)'
      }}>
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CropIcon size={18} color="var(--plra-300)" />
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>Recortar Imagen</span>
          </div>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ 
          padding: '1rem', background: '#000', display: 'flex', justifyContent: 'center', 
          maxHeight: '60vh', overflow: 'auto' 
        }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
          >
            <img 
              ref={imgRef}
              src={image} 
              onLoad={onImageLoad} 
              style={{ maxWidth: '100%', maxHeight: '50vh' }}
              alt="Crop"
            />
          </ReactCrop>
        </div>

        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <MousePointer2 size={12} /> Dibuja el recuadro sobre el rostro del candidato
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onCancel} className="btn-cancel-styled" style={{ flex: 1 }}>Cancelar</button>
            <button 
              onClick={handleDone} 
              className="btn-confirm-styled" 
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={!completedCrop?.width || !completedCrop?.height}
            >
              Aplicar Recorte
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
