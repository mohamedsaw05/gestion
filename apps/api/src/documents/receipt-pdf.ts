import PDFDocument from 'pdfkit';
import type { Response } from 'express';

export interface ReceiptLine {
  product: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  sku?: string;
  description?: string;
}

export interface ReceiptPayment {
  method: string;
  amount: string;
}

export type InvoiceTemplateType = 'STANDARD_PRO' | 'COMPACT' | 'DETAILED' | 'ELEGANT' | 'SERVICES';

export interface ReceiptContent {
  template?: InvoiceTemplateType;
  number: string;
  issuedAt: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  grandTotal: string;
  amountPaid: string;
  balanceDue: string;
  lines: ReceiptLine[];
  payments: ReceiptPayment[];
  tenderedAmount?: string | null;
  changeGiven?: string | null;
  footerText?: string | null;
  headerText?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoDataUri?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  showCustomerInfo?: boolean;
}

const DOCUMENT_TITLES: Record<string, string> = {
  RECEIPT: 'Reçu de Vente',
  INVOICE: 'Facture Commerciale',
  QUOTE: 'Devis Proforma',
  CREDIT_NOTE: 'Avoir Commercial',
};

function tryEmbedLogo(doc: PDFKit.PDFDocument, logoDataUri: string | null | undefined, fit: [number, number], x?: number, y?: number) {
  if (logoDataUri && logoDataUri.startsWith('data:image/')) {
    try {
      const base64Data = logoDataUri.split(',')[1];
      if (base64Data) {
        const imgBuffer = Buffer.from(base64Data, 'base64');
        if (x !== undefined && y !== undefined) {
          doc.image(imgBuffer, x, y, { fit });
        } else {
          doc.image(imgBuffer, { fit, align: 'center' });
        }
        return true;
      }
    } catch {
      // Ignorer format non supporté
    }
  }
  return false;
}

// ── Modèle 1 : STANDARD PRO (A5 portrait, clair, lisible, équilibré) ──
function renderStandardPro(doc: PDFKit.PDFDocument, content: ReceiptContent, title: string, showPayments: boolean) {
  tryEmbedLogo(doc, content.logoDataUri, [140, 50]);
  doc.moveDown(0.4);

  if (content.legalName) {
    doc.fontSize(14).font('Helvetica-Bold').text(content.legalName, { align: 'center' });
  }

  const contactPieces = [
    content.address,
    content.phone ? `Tél: ${content.phone}` : null,
    content.taxId ? `NIF/RCCM: ${content.taxId}` : null,
  ].filter(Boolean);

  if (contactPieces.length > 0) {
    doc.fontSize(8).font('Helvetica').fillColor('#555555').text(contactPieces.join(' — '), { align: 'center' });
    doc.fillColor('#000000');
  }

  if (content.headerText) {
    doc.fontSize(8).font('Helvetica-Oblique').text(content.headerText, { align: 'center' });
  }

  doc.moveDown(0.6);
  doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center', underline: true });
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica').text(`N° ${content.number}`);
  doc.text(`Date : ${new Date(content.issuedAt).toLocaleString('fr-FR')}`);

  if (content.showCustomerInfo !== false && content.customerName) {
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text(`Client : ${content.customerName}`);
    if (content.customerPhone) doc.font('Helvetica').text(`Contact : ${content.customerPhone}`);
  }

  doc.moveDown(0.6);
  doc.strokeColor('#cccccc').lineWidth(1).moveTo(36, doc.y).lineTo(380, doc.y).stroke();
  doc.moveDown(0.4);

  content.lines.forEach((l) => {
    doc.fontSize(9).font('Helvetica-Bold').text(l.product, { continued: false });
    doc.fontSize(8).font('Helvetica').fillColor('#444444').text(
      `Qté: ${l.quantity} ${l.unit} × ${l.unitPrice} ${content.currency} = ${l.lineTotal} ${content.currency}`,
      { indent: 10 },
    );
    doc.fillColor('#000000');
    doc.moveDown(0.2);
  });

  doc.moveDown(0.4);
  doc.strokeColor('#cccccc').lineWidth(1).moveTo(36, doc.y).lineTo(380, doc.y).stroke();
  doc.moveDown(0.4);

  doc.fontSize(9).font('Helvetica').text(`Sous-total : ${content.subtotal} ${content.currency}`, { align: 'right' });
  if (Number(content.discountTotal) > 0) {
    doc.text(`Remise : -${content.discountTotal} ${content.currency}`, { align: 'right' });
  }
  if (Number(content.taxTotal) > 0) {
    doc.text(`Taxes : +${content.taxTotal} ${content.currency}`, { align: 'right' });
  }
  doc.moveDown(0.2);
  doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL : ${content.grandTotal} ${content.currency}`, { align: 'right' });

  if (showPayments) {
    doc.moveDown(0.4);
    doc.fontSize(8).font('Helvetica');
    content.payments.forEach((p) => {
      doc.text(`Règlement (${p.method}) : ${p.amount} ${content.currency}`, { align: 'right' });
    });
    if (content.tenderedAmount) {
      doc.text(`Montant remis : ${content.tenderedAmount} ${content.currency}`, { align: 'right' });
    }
    if (content.changeGiven && Number(content.changeGiven) > 0) {
      doc.font('Helvetica-Bold').fillColor('#16a34a').text(`Monnaie rendue : ${content.changeGiven} ${content.currency}`, { align: 'right' });
      doc.fillColor('#000000');
    }
    if (Number(content.balanceDue) > 0) {
      doc.font('Helvetica-Bold').fillColor('#b91c1c').text(`Solde restant dû : ${content.balanceDue} ${content.currency}`, { align: 'right' });
      doc.fillColor('#000000');
    }
  }

  if (content.footerText) {
    doc.moveDown(0.8);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666').text(content.footerText, { align: 'center' });
  }
}

// ── Modèle 2 : COMPACT (Format ticket thermique 80mm pour caisse rapide) ──
function renderCompact(doc: PDFKit.PDFDocument, content: ReceiptContent, title: string, showPayments: boolean) {
  tryEmbedLogo(doc, content.logoDataUri, [100, 35]);
  doc.moveDown(0.3);

  if (content.legalName) {
    doc.fontSize(11).font('Helvetica-Bold').text(content.legalName, { align: 'center' });
  }
  if (content.address || content.phone) {
    doc.fontSize(7).font('Helvetica').text([content.address, content.phone].filter(Boolean).join(' | '), { align: 'center' });
  }
  doc.fontSize(7).font('Helvetica').text('------------------------------------------------', { align: 'center' });
  doc.fontSize(10).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
  doc.fontSize(8).font('Helvetica').text(`Ticket: ${content.number}`);
  doc.text(`Date: ${new Date(content.issuedAt).toLocaleDateString('fr-FR')} ${new Date(content.issuedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
  if (content.showCustomerInfo !== false && content.customerName) {
    doc.text(`Client: ${content.customerName}`);
  }
  doc.text('------------------------------------------------', { align: 'center' });

  content.lines.forEach((l) => {
    doc.fontSize(8).font('Helvetica-Bold').text(l.product);
    doc.font('Helvetica').text(`  ${l.quantity} × ${l.unitPrice} = ${l.lineTotal} ${content.currency}`);
  });

  doc.text('------------------------------------------------', { align: 'center' });
  doc.fontSize(11).font('Helvetica-Bold').text(`TOTAL: ${content.grandTotal} ${content.currency}`);
  if (showPayments) {
    doc.fontSize(8).font('Helvetica');
    content.payments.forEach((p) => doc.text(`Payé (${p.method}): ${p.amount} ${content.currency}`));
    if (content.tenderedAmount) {
      doc.text(`Reçu: ${content.tenderedAmount} ${content.currency}`);
    }
    if (content.changeGiven && Number(content.changeGiven) > 0) {
      doc.font('Helvetica-Bold').text(`Monnaie: ${content.changeGiven} ${content.currency}`);
    }
    if (Number(content.balanceDue) > 0) {
      doc.font('Helvetica-Bold').text(`Reste à payer: ${content.balanceDue} ${content.currency}`);
    }
  }
  doc.fontSize(7).font('Helvetica').text('------------------------------------------------', { align: 'center' });
  doc.fontSize(7).font('Helvetica-Oblique').text(content.footerText ?? 'Merci de votre visite à bientôt !', { align: 'center' });
}

// ── Modèle 3 : DÉTAILLÉ (A4 portrait B2B, colonnes complètes, TVA, remise, coordonnées étendues) ──
function renderDetailed(doc: PDFKit.PDFDocument, content: ReceiptContent, title: string, showPayments: boolean) {
  const hasLogo = tryEmbedLogo(doc, content.logoDataUri, [140, 55], 36, 36);
  const headerY = hasLogo ? 100 : 36;

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b').text(content.legalName ?? 'ENTREPRISE', 36, headerY);
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  if (content.address) doc.text(content.address, 36);
  if (content.phone) doc.text(`Téléphone : ${content.phone}`, 36);
  if (content.email) doc.text(`Courriel : ${content.email}`, 36);
  if (content.taxId) doc.text(`NIF/RCCM : ${content.taxId}`, 36);

  // Bloc Client à droite
  const clientBoxX = 330;
  doc.rect(clientBoxX, headerY, 230, 85).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('FACTURÉ À :', clientBoxX + 10, headerY + 8);
  doc.font('Helvetica').fillColor('#334155');
  if (content.showCustomerInfo !== false && content.customerName) {
    doc.text(content.customerName, clientBoxX + 10, headerY + 22);
    if (content.customerPhone) doc.text(`Tél : ${content.customerPhone}`, clientBoxX + 10);
    if (content.customerEmail) doc.text(`Email : ${content.customerEmail}`, clientBoxX + 10);
    if (content.customerAddress) doc.text(`Adresse : ${content.customerAddress}`, clientBoxX + 10);
  } else {
    doc.text('Client comptoir / Vente directe', clientBoxX + 10, headerY + 22);
  }

  // Titre & Métadonnées
  doc.y = headerY + 105;
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase(), 36, doc.y);
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  doc.text(`Document N° : ${content.number}  |  Date d'émission : ${new Date(content.issuedAt).toLocaleDateString('fr-FR')}`);
  doc.moveDown(0.6);

  // Table en-tête
  const tableY = doc.y;
  doc.rect(36, tableY, 524, 20).fillColor('#f1f5f9').fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155');
  doc.text('DÉSIGNATION / RÉFÉRENCE', 45, tableY + 5);
  doc.text('QTÉ', 270, tableY + 5);
  doc.text('UNITÉ', 315, tableY + 5);
  doc.text('P.U. HT', 370, tableY + 5);
  doc.text('TOTAL HT', 480, tableY + 5, { align: 'right', width: 70 });

  let rowY = tableY + 24;
  doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

  content.lines.forEach((l) => {
    doc.text(l.product, 45, rowY, { width: 215 });
    doc.text(l.quantity, 270, rowY);
    doc.text(l.unit, 315, rowY);
    doc.text(`${l.unitPrice} ${content.currency}`, 370, rowY);
    doc.text(`${l.lineTotal} ${content.currency}`, 480, rowY, { align: 'right', width: 70 });
    rowY += 18;
  });

  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(36, rowY).lineTo(560, rowY).stroke();
  rowY += 10;

  // Totaux à droite
  const totalBoxX = 350;
  doc.fontSize(9).font('Helvetica').text(`Sous-total HT :`, totalBoxX, rowY);
  doc.text(`${content.subtotal} ${content.currency}`, 480, rowY, { align: 'right', width: 70 });
  rowY += 15;

  if (Number(content.discountTotal) > 0) {
    doc.text(`Remise globale :`, totalBoxX, rowY);
    doc.text(`-${content.discountTotal} ${content.currency}`, 480, rowY, { align: 'right', width: 70 });
    rowY += 15;
  }
  if (Number(content.taxTotal) > 0) {
    doc.text(`Montant TVA / Taxes :`, totalBoxX, rowY);
    doc.text(`+${content.taxTotal} ${content.currency}`, 480, rowY, { align: 'right', width: 70 });
    rowY += 15;
  }

  doc.rect(totalBoxX - 5, rowY - 2, 215, 24).fillColor('#0f172a').fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text(`TOTAL TTC :`, totalBoxX + 5, rowY + 5);
  doc.text(`${content.grandTotal} ${content.currency}`, 480, rowY + 5, { align: 'right', width: 65 });
  rowY += 32;

  if (showPayments) {
    doc.fontSize(8).font('Helvetica').fillColor('#475569');
    content.payments.forEach((p) => {
      doc.text(`Paiement reçu (${p.method}) : ${p.amount} ${content.currency}`, totalBoxX, rowY);
      rowY += 13;
    });
    if (Number(content.balanceDue) > 0) {
      doc.font('Helvetica-Bold').fillColor('#dc2626').text(`Solde restant exigible : ${content.balanceDue} ${content.currency}`, totalBoxX, rowY);
      rowY += 15;
    }
  }

  if (content.footerText) {
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(content.footerText, 36, 750, { align: 'center', width: 524 });
  }
}

// ── Modèle 4 : ÉLÉGANT (A4 portrait prestige, bandeau indigo/ardoise, bordures fines, style premium) ──
function renderElegant(doc: PDFKit.PDFDocument, content: ReceiptContent, title: string, showPayments: boolean) {
  // Bandeau supérieur sombre
  doc.rect(0, 0, 595, 80).fillColor('#0f172a').fill();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff').text(content.legalName ?? 'MAISON COMMERCIALE', 36, 25);
  doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(title.toUpperCase(), 36, 50);

  // Logo ou badge à droite
  tryEmbedLogo(doc, content.logoDataUri, [120, 50], 430, 15);

  doc.fillColor('#000000');
  doc.y = 100;

  // Ligne de métadonnées élégante
  doc.fontSize(9).font('Helvetica').fillColor('#64748b');
  doc.text(`FACTURE N° ${content.number}  •  DATE : ${new Date(content.issuedAt).toLocaleDateString('fr-FR')}`, 36, 95);
  if (content.showCustomerInfo !== false && content.customerName) {
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`CLIENT : ${content.customerName.toUpperCase()}`, 36, 110);
    if (content.customerPhone) doc.font('Helvetica').fillColor('#64748b').text(`Tél : ${content.customerPhone}`, 36, 123);
  }

  doc.y = 145;
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(36, doc.y).lineTo(560, doc.y).stroke();
  doc.moveDown(0.5);

  // Table
  const startY = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
  doc.text('ARTICLE', 40, startY);
  doc.text('QUANTITÉ', 280, startY);
  doc.text('PRIX UNITAIRE', 360, startY);
  doc.text('MONTANT', 480, startY, { align: 'right', width: 70 });
  doc.moveDown(0.5);

  let currentY = doc.y + 5;
  content.lines.forEach((l) => {
    doc.fontSize(9).font('Helvetica').fillColor('#1e293b').text(l.product, 40, currentY, { width: 230 });
    doc.text(`${l.quantity} ${l.unit}`, 280, currentY);
    doc.text(`${l.unitPrice} ${content.currency}`, 360, currentY);
    doc.font('Helvetica-Bold').text(`${l.lineTotal} ${content.currency}`, 480, currentY, { align: 'right', width: 70 });
    currentY += 22;
  });

  doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(36, currentY).lineTo(560, currentY).stroke();
  currentY += 15;

  // Card total élégant
  doc.rect(340, currentY, 220, 75).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
  doc.fontSize(9).font('Helvetica').fillColor('#475569').text('Sous-total :', 355, currentY + 12);
  doc.text(`${content.subtotal} ${content.currency}`, 470, currentY + 12, { align: 'right', width: 80 });

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('Total Général :', 355, currentY + 32);
  doc.text(`${content.grandTotal} ${content.currency}`, 470, currentY + 32, { align: 'right', width: 80 });

  if (showPayments && Number(content.balanceDue) > 0) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#e11d48').text('Solde dû :', 355, currentY + 52);
    doc.text(`${content.balanceDue} ${content.currency}`, 470, currentY + 52, { align: 'right', width: 80 });
  }

  if (content.footerText) {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94a3b8').text(content.footerText, 36, 750, { align: 'center', width: 524 });
  }
}

// ── Modèle 5 : SERVICES / PRESTATIONS (A4 adapté aux missions, conseil, forfaits et taux horaires) ──
function renderServices(doc: PDFKit.PDFDocument, content: ReceiptContent, title: string, showPayments: boolean) {
  tryEmbedLogo(doc, content.logoDataUri, [130, 45], 36, 36);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0284c7').text(content.legalName ?? 'CABINET PRESTATAIRE', 36, 95);
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  if (content.address) doc.text(content.address, 36);
  if (content.phone || content.email) doc.text([content.phone, content.email].filter(Boolean).join(' | '), 36);
  if (content.taxId) doc.text(`Immatriculation : ${content.taxId}`, 36);

  // Bloc Mission / Client
  doc.y = 170;
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase(), 36, doc.y);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b');
  doc.text(`Réf Facture : ${content.number}  •  Date : ${new Date(content.issuedAt).toLocaleDateString('fr-FR')}`);
  if (content.showCustomerInfo !== false && content.customerName) {
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`Bénéficiaire de la prestation : ${content.customerName}`);
    if (content.customerAddress) doc.font('Helvetica').fillColor('#64748b').text(`Lieu d'intervention : ${content.customerAddress}`);
  }

  doc.moveDown(0.8);

  // En-tête Prestations
  const tableY = doc.y;
  doc.rect(36, tableY, 524, 22).fillColor('#e0f2fe').fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0369a1');
  doc.text('INTITULÉ DE LA PRESTATION / MISSION', 45, tableY + 6);
  doc.text('VOLUME / BASE', 320, tableY + 6);
  doc.text('HONORAIRES HT', 460, tableY + 6, { align: 'right', width: 90 });

  let rowY = tableY + 28;
  content.lines.forEach((l) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(l.product, 45, rowY, { width: 260 });
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`${l.quantity} ${l.unit} (taux: ${l.unitPrice})`, 320, rowY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`${l.lineTotal} ${content.currency}`, 460, rowY, { align: 'right', width: 90 });
    rowY += 24;
  });

  doc.strokeColor('#bae6fd').lineWidth(1).moveTo(36, rowY).lineTo(560, rowY).stroke();
  rowY += 15;

  // Récapitulatif honoraires
  doc.fontSize(9).font('Helvetica').fillColor('#334155');
  doc.text('Total Honoraires HT :', 320, rowY);
  doc.text(`${content.subtotal} ${content.currency}`, 460, rowY, { align: 'right', width: 90 });
  rowY += 16;

  if (Number(content.taxTotal) > 0) {
    doc.text('TVA légale :', 320, rowY);
    doc.text(`+${content.taxTotal} ${content.currency}`, 460, rowY, { align: 'right', width: 90 });
    rowY += 16;
  }

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0284c7').text('NET À PAYER :', 320, rowY);
  doc.text(`${content.grandTotal} ${content.currency}`, 460, rowY, { align: 'right', width: 90 });
  rowY += 25;

  if (showPayments) {
    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    content.payments.forEach((p) => {
      doc.text(`Acompte / Règlement (${p.method}) : ${p.amount} ${content.currency}`, 320, rowY);
      rowY += 14;
    });
    if (Number(content.balanceDue) > 0) {
      doc.font('Helvetica-Bold').fillColor('#b91c1c').text(`Solde exigible à réception : ${content.balanceDue} ${content.currency}`, 320, rowY);
    }
  }

  // Mentions de règlement et pénalités
  doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(
    'Règlement net à échéance. Aucun escompte pour paiement anticipé. En cas de retard de paiement, une indemnité forfaitaire pour frais de recouvrement sera exigible.',
    36,
    720,
    { align: 'center', width: 524 },
  );

  if (content.footerText) {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text(content.footerText, 36, 745, { align: 'center', width: 524 });
  }
}

/**
 * Routeur principal du Document Engine selon le modèle demandé.
 */
export function streamReceiptPdf(
  content: ReceiptContent,
  res: Response,
  documentType: string = 'RECEIPT',
  overrideTemplate?: InvoiceTemplateType,
) {
  const title = DOCUMENT_TITLES[documentType] ?? documentType;
  const showPayments = documentType !== 'QUOTE';
  const selectedTemplate = overrideTemplate ?? content.template ?? 'STANDARD_PRO';

  const isCompact = selectedTemplate === 'COMPACT';
  const isA4 = selectedTemplate === 'DETAILED' || selectedTemplate === 'ELEGANT' || selectedTemplate === 'SERVICES';

  const doc = new PDFDocument({
    size: isCompact ? [226, 650] : isA4 ? 'A4' : 'A5',
    margin: isCompact ? 15 : 36,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${content.number}.pdf"`);
  doc.pipe(res);

  switch (selectedTemplate) {
    case 'COMPACT':
      renderCompact(doc, content, title, showPayments);
      break;
    case 'DETAILED':
      renderDetailed(doc, content, title, showPayments);
      break;
    case 'ELEGANT':
      renderElegant(doc, content, title, showPayments);
      break;
    case 'SERVICES':
      renderServices(doc, content, title, showPayments);
      break;
    case 'STANDARD_PRO':
    default:
      renderStandardPro(doc, content, title, showPayments);
      break;
  }

  doc.end();
}

export interface DeliveryNoteLine {
  product: string;
  unit: string;
  quantity: string;
}

export interface DeliveryNoteContent {
  number: string;
  issuedAt: string;
  orderNumber: string;
  address: string;
  status: string;
  lines: DeliveryNoteLine[];
}

export function streamDeliveryNotePdf(content: DeliveryNoteContent, res: Response) {
  const doc = new PDFDocument({ size: 'A5', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${content.number}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text('Bon de livraison', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`N° ${content.number}`);
  doc.text(`Commande n° ${content.orderNumber}`);
  doc.text(`Livré le ${new Date(content.issuedAt).toLocaleString('fr-FR')}`);
  doc.text(`Adresse : ${content.address}`);
  doc.moveDown();

  content.lines.forEach((l) => {
    doc.text(`${l.quantity} x ${l.product} (${l.unit})`);
  });

  doc.moveDown();
  doc.fontSize(10).text(`Statut : ${content.status}`);

  doc.end();
}
