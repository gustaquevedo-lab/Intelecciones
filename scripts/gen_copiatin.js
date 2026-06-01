/**
 * Copiatín Electoral — Nuevo Liberalismo PLRA
 * 9cm × 5cm | Fondo Blanco
 * Diseño adaptado del material de campaña
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const CM = 28.3465;
const W  = 9 * CM;   // 255.12 pt
const H  = 5 * CM;   // 141.73 pt

// ── PALETA (basada en imagen de referencia) ────────────────────────────────────
const C = {
  azul:      '#002868',   // azul oscuro PLRA
  azulMed:   '#003DA6',   // azul medio
  azulCard:  '#0147A3',   // azul tarjeta
  naranja:   '#FF6B00',   // naranja "LISTA"
  naranjaL:  '#FF8C00',
  blanco:    '#FFFFFF',
  negro:     '#111111',
  grisOsc:   '#333333',
  grisMed:   '#666666',
  grisLine:  '#D8E2EE',
  fondoClaro:'#F4F7FC',
  azulPale:  '#E8F0FA',
  rojo:      '#C8102E',
};

const outPath = path.join(__dirname, 'copiatin_electoral.pdf');
const doc = new PDFDocument({
  size: [W, H],
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: { Title: 'Copiatín Electoral — Nuevo Liberalismo' }
});
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

// ══════════════════════════════════════════════════════════════════════════════
// FONDO GENERAL
// ══════════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, W, H).fill(C.blanco);

// ══════════════════════════════════════════════════════════════════════════════
// COLUMNA IZQUIERDA (candidatos) — fondo azul oscuro
// ══════════════════════════════════════════════════════════════════════════════
const LW  = 106;   // ancho columna izquierda (~3.74cm)
const DIV = LW;    // posición divisor
const RX  = LW + 5; // inicio col. derecha
const RW  = W - RX - 4; // ancho col. derecha

doc.rect(0, 0, LW, H).fill(C.azul);

// ── HEADER IZQUIERDO ───────────────────────────────────────────────────────────
// Logo / nombre movimiento
doc.fillColor(C.blanco).font('Helvetica-Bold').fontSize(6.5)
   .text('NUEVO LIBERALISMO', 4, 4, { width: LW - 8, align: 'center', lineBreak: false });
doc.fillColor('#90C4FF').font('Helvetica').fontSize(4.5)
   .text('Creando Nación · PLRA', 4, 12, { width: LW - 8, align: 'center', lineBreak: false });

// Línea divisora bajo header
doc.rect(4, 18.5, LW - 8, 0.8).fill(C.naranja);

// Texto "ASÍ VOTAMOS EN"
doc.fillColor('#B0D0FF').font('Helvetica-Bold').fontSize(4.5)
   .text('ASÍ VOTAMOS EN', 4, 21.5, { width: LW - 8, align: 'center', lineBreak: false });
// Badge naranja ciudad
const ciudadLabel = 'PEDRO J. CABALLERO';
const cidW = 98; const cidH = 9; const cidX = (LW - cidW) / 2; const cidY = 27;
doc.roundedRect(cidX, cidY, cidW, cidH, 4).fill(C.naranja);
doc.fillColor(C.blanco).font('Helvetica-Bold').fontSize(5.5)
   .text(ciudadLabel, cidX, cidY + 1.5, { width: cidW, align: 'center', lineBreak: false });

// ── CANDIDATOS ─────────────────────────────────────────────────────────────────
// Helper: fila candidato
const ROW_PAD = 3;
let yC = cidY + cidH + 3;

function candidateRow(nombre, cargo, lista, opcion, y, highlight) {
  const rH = 16.5;
  const rW = LW - 6;
  const rx = 3;

  // Fondo de la fila: azul más claro si highlight
  const bgColor = highlight ? C.azulCard : C.azulMed;
  doc.roundedRect(rx, y, rW, rH, 2.5).fill(bgColor);

  // Texto cargo
  doc.fillColor('#9EC8FF').font('Helvetica-Bold').fontSize(3.8)
     .text(cargo, rx + ROW_PAD, y + 2.5, { width: rW - 28, lineBreak: false });

  // Nombre candidato
  doc.fillColor(C.blanco).font('Helvetica-Bold').fontSize(highlight ? 6.5 : 5.8)
     .text(nombre, rx + ROW_PAD, y + 7.5, { width: rW - 28, lineBreak: false });

  // Badge LISTA (naranja, parte derecha)
  const badgeW = 24;
  const badgeX = rx + rW - badgeW - 1;
  doc.roundedRect(badgeX, y + 2, badgeW, rH - 4, 3).fill(C.naranja);

  doc.fillColor(C.blanco).font('Helvetica-Bold').fontSize(4)
     .text('LISTA', badgeX, y + 3.5, { width: badgeW, align: 'center', lineBreak: false });
  doc.fillColor(C.blanco).font('Helvetica-Bold').fontSize(8.5)
     .text(String(lista), badgeX, y + 7, { width: badgeW, align: 'center', lineBreak: false });

  if (opcion !== null) {
    doc.fillColor('#FFD090').font('Helvetica-Bold').fontSize(3.5)
       .text(`OP.${opcion}`, badgeX, y + rH - 4.5, { width: badgeW, align: 'center', lineBreak: false });
  }

  return y + rH + 2;
}

yC = candidateRow('ARQ. MIGUEL ROJAS LEÓN', 'INTENDENTE MUNICIPAL', 3, null, yC, true);
yC = candidateRow('LOURDES AMARILLA', 'CONCEJAL MUNICIPAL', 3, 3, yC, false);
yC = candidateRow('ALCIDES RIVEROS', 'PDTE. DEL PARTIDO', 3, null, yC, false);
// Dir. Nacional: fila compacta si queda espacio
if (yC + 12 < H - 3) {
  yC = candidateRow('PEDRO GONZALEZ', 'DIR. NACIONAL', 3, 13, yC, false);
}

// ══════════════════════════════════════════════════════════════════════════════
// DIVISOR
// ══════════════════════════════════════════════════════════════════════════════
doc.moveTo(DIV, 3).lineTo(DIV, H - 3)
   .lineWidth(1.2).strokeColor(C.naranja).stroke();

// ══════════════════════════════════════════════════════════════════════════════
// COLUMNA DERECHA — DATOS DEL ELECTOR
// ══════════════════════════════════════════════════════════════════════════════
let yR = 4;

// Header derecha
doc.fillColor(C.azul).font('Helvetica-Bold').fontSize(5.5)
   .text('DATOS DEL ELECTOR', RX, yR, { width: RW, align: 'left', lineBreak: false });
doc.rect(RX, yR + 7, RW, 0.6).fill(C.naranja); // línea naranja bajo header
yR += 11;

// Helper campo
function campo(label, valor, x, y, w, hBox = 10.5, fontSize = 6) {
  doc.fillColor(C.azulMed).font('Helvetica-Bold').fontSize(4.3)
     .text(label, x, y, { width: w, lineBreak: false });
  const bY = y + 5.5;
  doc.rect(x, bY, w, hBox).fill(C.fondoClaro);
  doc.rect(x, bY, w, hBox).lineWidth(0.4).strokeColor(C.grisLine).stroke();
  doc.fillColor(C.negro).font('Helvetica-Bold').fontSize(fontSize)
     .text(valor, x + 2.5, bY + 2, { width: w - 5, lineBreak: false });
  return bY + hBox + 3;
}

// Nombre completo (ancho total)
yR = campo('NOMBRE COMPLETO', '{{nombre}}', RX, yR, RW, 11, 6);

// CI + Local (misma fila)
const CI_W  = 54;
const LOC_X = RX + CI_W + 4;
const LOC_W = RW - CI_W - 4;

doc.fillColor(C.azulMed).font('Helvetica-Bold').fontSize(4.3)
   .text('C.I.', RX, yR, { width: CI_W, lineBreak: false });
doc.fillColor(C.azulMed).font('Helvetica-Bold').fontSize(4.3)
   .text('LOCAL DE VOTACIÓN', LOC_X, yR, { width: LOC_W, lineBreak: false });

const row2Y = yR + 5.5;
doc.rect(RX, row2Y, CI_W, 10.5).fill(C.fondoClaro);
doc.rect(RX, row2Y, CI_W, 10.5).lineWidth(0.4).strokeColor(C.grisLine).stroke();
doc.fillColor(C.negro).font('Helvetica-Bold').fontSize(6)
   .text('{{ci}}', RX + 2.5, row2Y + 2, { width: CI_W - 5, lineBreak: false });

doc.rect(LOC_X, row2Y, LOC_W, 10.5).fill(C.fondoClaro);
doc.rect(LOC_X, row2Y, LOC_W, 10.5).lineWidth(0.4).strokeColor(C.grisLine).stroke();
doc.fillColor(C.negro).font('Helvetica').fontSize(5.5)
   .text('{{local_votacion}}', LOC_X + 2.5, row2Y + 2, { width: LOC_W - 5, lineBreak: false });

yR = row2Y + 10.5 + 3;

// MESA y ORDEN — cajas cuadradas prominentes con fondo naranja/azul
const BW = 30; const BH = 20;

// Mesa
doc.fillColor(C.azulMed).font('Helvetica-Bold').fontSize(4.3)
   .text('MESA N°', RX, yR, { width: BW, lineBreak: false });
const mesaBoxY = yR + 5.5;
doc.roundedRect(RX, mesaBoxY, BW, BH, 3).fill(C.azul);
doc.fillColor(C.naranja).font('Helvetica-Bold').fontSize(12)
   .text('{{mesa}}', RX, mesaBoxY + 4, { width: BW, align: 'center', lineBreak: false });

// Orden
const ORD_X = RX + BW + 6;
doc.fillColor(C.azulMed).font('Helvetica-Bold').fontSize(4.3)
   .text('ORDEN N°', ORD_X, yR, { width: BW, lineBreak: false });
doc.roundedRect(ORD_X, mesaBoxY, BW, BH, 3).fill(C.azul);
doc.fillColor(C.naranja).font('Helvetica-Bold').fontSize(12)
   .text('{{orden}}', ORD_X, mesaBoxY + 4, { width: BW, align: 'center', lineBreak: false });

// Año / elecciones (sutil, abajo derecha)
doc.fillColor(C.grisMed).font('Helvetica').fontSize(3.5)
   .text('ELECCIONES MUNICIPALES 2025', RX + BW * 2 + 10, mesaBoxY + 8, {
     width: RW - (BW * 2 + 10), align: 'right', lineBreak: false
   });

// ══════════════════════════════════════════════════════════════════════════════
// BORDE EXTERIOR
// ══════════════════════════════════════════════════════════════════════════════
doc.rect(0.5, 0.5, W - 1, H - 1)
   .lineWidth(0.8).strokeColor(C.azul).stroke();

// ══════════════════════════════════════════════════════════════════════════════
// MARCAS DE CORTE
// ══════════════════════════════════════════════════════════════════════════════
const MK = 4;
[[0,0],[W,0],[0,H],[W,H]].forEach(([cx,cy]) => {
  doc.moveTo(cx + (cx===0?MK:-MK), cy)
     .lineTo(cx, cy)
     .lineTo(cx, cy + (cy===0?MK:-MK))
     .lineWidth(0.4).strokeColor('#AAAAAA').stroke();
});

doc.end();
stream.on('finish', () => {
  console.log('✅ Copiatín generado:', outPath);
});
stream.on('error', e => console.error('❌', e));
