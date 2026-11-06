import PDFDocument from 'pdfkit';
import type { Response } from 'express';

export interface CustomerStatementData {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    creditLimit?: string | null;
  };
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalPurchases: number;
    totalPayments: number;
    totalBalanceDue: number;
    currentOutstandingDebt: number;
  };
  sales: {
    id: string;
    createdAt: Date | string;
    grandTotal: any;
    amountPaid: any;
    balanceDue: any;
    status: string;
    lines: {
      productNameSnapshot: string;
      quantity: any;
      unitSnapshot: string;
      unitPriceSnapshot: any;
      lineTotal: any;
    }[];
  }[];
  movements: {
    id: string;
    createdAt: Date | string;
    movementType: string;
    amount: any;
    referenceType: string;
  }[];
  organizationName: string;
}

export function streamCustomerStatementPdf(data: CustomerStatementData, res: Response) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="releve-${data.customer.name.replace(/\s+/g, '_')}.pdf"`,
  );
  doc.pipe(res);

  // En-tête
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(data.organizationName, 36, 36);
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('RELEVÉ DE COMPTE CLIENT', 36, 56);

  // Bloc Client
  const clientBoxX = 320;
  doc.rect(clientBoxX, 36, 240, 75).strokeColor('#cbd5e1').lineWidth(1).stroke();
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('CLIENT :', clientBoxX + 10, 46);
  doc.font('Helvetica').fillColor('#334155').text(data.customer.name, clientBoxX + 10, 58);
  if (data.customer.phone) doc.text(`Tél : ${data.customer.phone}`, clientBoxX + 10, 70);
  if (data.customer.email) doc.text(`Email : ${data.customer.email}`, clientBoxX + 10, 82);

  // Période
  doc.y = 125;
  doc.fontSize(9).font('Helvetica').fillColor('#475569');
  const fromStr = new Date(data.period.from).toLocaleDateString('fr-FR');
  const toStr = new Date(data.period.to).toLocaleDateString('fr-FR');
  doc.text(`Période couverte : du ${fromStr} au ${toStr}`);

  // Cartes Récapitulatives
  doc.moveDown(0.5);
  const cardY = doc.y;
  const cardWidth = 122;

  // Card 1 : Achats
  doc.rect(36, cardY, cardWidth, 45).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('TOTAL ACHATS', 44, cardY + 8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`${data.summary.totalPurchases.toLocaleString('fr-FR')} XOF`, 44, cardY + 22);

  // Card 2 : Règlements
  doc.rect(36 + cardWidth + 8, cardY, cardWidth, 45).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('TOTAL RÉGLÉ', 36 + cardWidth + 16, cardY + 8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a').text(`${data.summary.totalPayments.toLocaleString('fr-FR')} XOF`, 36 + cardWidth + 16, cardY + 22);

  // Card 3 : Solde dû période
  doc.rect(36 + (cardWidth + 8) * 2, cardY, cardWidth, 45).fillColor('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).fillAndStroke();
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('SOLDE PÉRIODE', 36 + (cardWidth + 8) * 2 + 8, cardY + 8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`${data.summary.totalBalanceDue.toLocaleString('fr-FR')} XOF`, 36 + (cardWidth + 8) * 2 + 8, cardY + 22);

  // Card 4 : Créance Globale en cours
  doc.rect(36 + (cardWidth + 8) * 3, cardY, cardWidth, 45).fillColor('#fef2f2').strokeColor('#fecaca').lineWidth(1).fillAndStroke();
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#991b1b').text('ENCOURS CRÉDIT', 36 + (cardWidth + 8) * 3 + 8, cardY + 8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626').text(`${data.summary.currentOutstandingDebt.toLocaleString('fr-FR')} XOF`, 36 + (cardWidth + 8) * 3 + 8, cardY + 22);

  // Table des Transactions
  doc.y = cardY + 60;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('DÉTAIL CHRONOLOGIQUE DES OPÉRATIONS', 36, doc.y);
  doc.moveDown(0.3);

  const tableHeaderY = doc.y;
  doc.rect(36, tableHeaderY, 524, 20).fillColor('#f1f5f9').fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155');
  doc.text('DATE', 42, tableHeaderY + 6);
  doc.text('RÉFÉRENCE / DÉTAIL', 115, tableHeaderY + 6);
  doc.text('ACHAT', 340, tableHeaderY + 6, { align: 'right', width: 65 });
  doc.text('PAYÉ', 415, tableHeaderY + 6, { align: 'right', width: 65 });
  doc.text('SOLDE DÛ', 490, tableHeaderY + 6, { align: 'right', width: 65 });

  let rowY = tableHeaderY + 25;
  doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

  if (data.sales.length === 0) {
    doc.text('Aucune opération enregistrée pour ce client sur la période sélectionnée.', 42, rowY);
    rowY += 20;
  } else {
    data.sales.forEach((s) => {
      const dateStr = new Date(s.createdAt).toLocaleDateString('fr-FR');
      const linesSummary = s.lines.map((l) => `${l.quantity}x ${l.productNameSnapshot}`).join(', ');
      const desc = linesSummary.length > 40 ? linesSummary.substring(0, 37) + '...' : linesSummary;

      doc.text(dateStr, 42, rowY);
      doc.text(desc || 'Vente directe', 115, rowY, { width: 220 });
      doc.text(`${Number(s.grandTotal).toLocaleString('fr-FR')} XOF`, 340, rowY, { align: 'right', width: 65 });
      doc.text(`${Number(s.amountPaid).toLocaleString('fr-FR')} XOF`, 415, rowY, { align: 'right', width: 65 });
      doc.text(`${Number(s.balanceDue).toLocaleString('fr-FR')} XOF`, 490, rowY, { align: 'right', width: 65 });
      rowY += 18;

      if (rowY > 750) {
        doc.addPage();
        rowY = 36;
      }
    });
  }

  doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(36, rowY).lineTo(560, rowY).stroke();
  rowY += 15;

  // Pied de page
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text(
    'Relevé généré automatiquement par le Gestionnaire SaaS Universel de Commerce. Document certifié conforme aux écritures comptables enregistrées.',
    36,
    760,
    { align: 'center', width: 524 },
  );

  doc.end();
}
