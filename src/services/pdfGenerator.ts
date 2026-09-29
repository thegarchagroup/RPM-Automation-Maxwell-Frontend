import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Section, InspectionItem } from '../types';

export interface GeneratePdfOptions {
  roomNumber: string;
  roomType: string;
  inspectionDate: string;
  quarter?: string;
  status: string;
  sections: Section[];
  itemsMap: Record<number, InspectionItem>;
  overallRemark: string;
  maintenanceCarriedBy?: string;
  signatureUrl: string | null;
  inspectedByName?: string;
  inspectedBySignatureUrl?: string | null;
  inspectedAt?: string;
  // Backward compatibility alias
  inspectorName?: string;
  verifiedByName?: string;
  verifiedAt?: string;
}

export function buildInspectionPdfDoc(options: GeneratePdfOptions): { doc: jsPDF; filename: string } {
  const {
    roomNumber,
    roomType,
    inspectionDate,
    quarter,
    status,
    sections,
    itemsMap,
    overallRemark,
    maintenanceCarriedBy,
    inspectorName,
    signatureUrl,
    inspectedByName,
    inspectedBySignatureUrl,
    inspectedAt,
    verifiedByName,
    verifiedAt,
  } = options;

  const maintenancePerson = maintenanceCarriedBy || inspectorName || 'Maintenance Staff';
  const inspectorPerson = inspectedByName || verifiedByName || 'Not Specified';
  const officialInspectDate = inspectedAt || verifiedAt || inspectionDate;

  // Initialize A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  let currentY = margin;

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, contentWidth, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('THE MAXWELL - ROOM PREVENTIVE MAINTENANCE', pageWidth / 2, currentY + 7.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text('ROOM PREVENTIVE MAINTENANCE INSPECTION REPORT', pageWidth / 2, currentY + 13, { align: 'center' });

  currentY += 22;

  // Metadata Table (Type, Room, Date, Quarter, Status)
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [],
    body: [
      [
        { content: 'Room Type:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: roomType || 'N/A', styles: { textColor: [15, 23, 42] } },
        { content: 'Room Number:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: `Room ${roomNumber}`, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
      ],
      [
        { content: 'Inspection Date:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: inspectionDate || new Date().toLocaleDateString(), styles: { textColor: [15, 23, 42] } },
        { content: 'Schedule Quarter:', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: `${quarter || '2nd Quarter (May - August)'} (${status.toUpperCase()})`, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
      ],
    ],
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 61 },
      2: { cellWidth: 32 },
      3: { cellWidth: 61 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Summary Metrics Bar
  let totalItems = 0;
  let passCount = 0;
  let failCount = 0;
  let naCount = 0;

  sections.forEach((sec) => {
    sec.items.forEach((item) => {
      totalItems++;
      const res = itemsMap[item.id]?.result;
      if (res === 'pass') passCount++;
      else if (res === 'fail') failCount++;
      else if (res === 'na') naCount++;
    });
  });

  const answeredCount = passCount + failCount + naCount;
  const passRate = answeredCount > 0 ? Math.round((passCount / (passCount + failCount || 1)) * 100) : 0;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    body: [
      [
        {
          content: `Total Items: ${totalItems}   |   Checked: ${answeredCount}   |   Pass: ${passCount}   |   Defects/Fail: ${failCount}   |   Pass Rate: ${passRate}%`,
          styles: {
            fillColor: [248, 250, 252],
            textColor: failCount > 0 ? [185, 28, 28] : [22, 101, 52],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center',
            cellPadding: 2,
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
        },
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Render Checklist Sections
  sections.forEach((section) => {
    const tableBody: any[][] = [];

    section.items.forEach((item) => {
      const itemRecord = itemsMap[item.id];
      const result = itemRecord?.result;
      const remark = itemRecord?.remark || '';

      let statusText = '—';
      let statusStyle: any = { textColor: [148, 163, 184], fontStyle: 'normal', halign: 'center' };

      if (result === 'pass') {
        statusText = 'PASS';
        statusStyle = { textColor: [22, 101, 52], fontStyle: 'bold', halign: 'center', fillColor: [240, 253, 244] };
      } else if (result === 'fail') {
        statusText = 'DEFECT';
        statusStyle = { textColor: [185, 28, 28], fontStyle: 'bold', halign: 'center', fillColor: [254, 242, 242] };
      } else if (result === 'na') {
        statusText = 'N/A';
        statusStyle = { textColor: [100, 116, 139], fontStyle: 'normal', halign: 'center', fillColor: [248, 250, 252] };
      }

      tableBody.push([
        { content: item.item_no, styles: { halign: 'center', fontStyle: 'bold', textColor: [71, 85, 105] } },
        { content: item.description, styles: { textColor: [15, 23, 42] } },
        { content: statusText, styles: statusStyle },
        {
          content: remark,
          styles: { textColor: result === 'fail' ? [185, 28, 28] : [71, 85, 105], fontStyle: result === 'fail' ? 'bold' : 'normal' },
        },
      ]);
    });

    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = margin;
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [
        [
          {
            content: `${section.code}. ${section.title}`,
            colSpan: 4,
            styles: {
              fillColor: [30, 41, 59], // slate-800
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8.5,
              cellPadding: 2,
            },
          },
        ],
        [
          { content: '#', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', halign: 'center', textColor: [51, 65, 85] } },
          { content: 'Checklist Item', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [51, 65, 85] } },
          { content: 'Result', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', halign: 'center', textColor: [51, 65, 85] } },
          { content: 'Remarks / Defect Details', styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [51, 65, 85] } },
        ],
      ],
      body: tableBody,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 95 },
        2: { cellWidth: 20 },
        3: { cellWidth: 61 },
      },
      pageBreak: 'auto',
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;
  });

  // Overall Remarks Section
  if (currentY > pageHeight - 65) {
    doc.addPage();
    currentY = margin;
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        {
          content: 'Overall Remarks & Observations',
          styles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8.5 },
        },
      ],
    ],
    body: [
      [
        {
          content: overallRemark || 'No additional remarks recorded.',
          styles: { minCellHeight: 12, fontSize: 8, textColor: [30, 41, 59] },
        },
      ],
    ],
    styles: { lineColor: [203, 213, 225], lineWidth: 0.2 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = margin;
  }

  // Signatures Table: Date / Maintenance carried By / Inspected By
  const signTableStartY = currentY;

  autoTable(doc, {
    startY: signTableStartY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [
      [
        { content: 'Date & Schedule', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: 'Maintenance carried By (Mandatory)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
        { content: 'Inspected By (Optional)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
      ],
    ],
    body: [
      [
        {
          content: `${inspectionDate}\n${quarter || ''}\nOfficial Submission Record`,
          styles: { minCellHeight: 28, fontSize: 8, textColor: [30, 41, 59], cellPadding: 3 },
        },
        {
          content: '', // Dynamically rendered via didDrawCell
          styles: { minCellHeight: 28, cellPadding: 3 },
        },
        {
          content: '', // Dynamically rendered via didDrawCell
          styles: { minCellHeight: 28, cellPadding: 3 },
        },
      ],
    ],
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 76 },
      2: { cellWidth: 55 },
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const cell = data.cell;
        if (data.column.index === 1) {
          // Maintenance carried By
          let drawY = cell.y + 2.5;
          const hasSig = signatureUrl && (signatureUrl.startsWith('data:image') || signatureUrl.startsWith('blob:'));

          if (hasSig) {
            try {
              const imgWidth = 38;
              const imgHeight = 11;
              const imgX = cell.x + 3;
              doc.addImage(signatureUrl, 'PNG', imgX, drawY, imgWidth, imgHeight);
              drawY += imgHeight + 2.5;
            } catch (e) {
              console.warn('Could not embed maintenance signature image in PDF', e);
            }
          } else {
            drawY += 3;
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(maintenancePerson || 'Not Specified', cell.x + 3, drawY + 2.5);

          if (!hasSig) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('(Digital Sign-off)', cell.x + 3, drawY + 6.5);
          }
        } else if (data.column.index === 2) {
          // Inspected By
          let drawY = cell.y + 2.5;
          const hasSig = inspectedBySignatureUrl && (inspectedBySignatureUrl.startsWith('data:image') || inspectedBySignatureUrl.startsWith('blob:'));

          if (hasSig) {
            try {
              const imgWidth = 35;
              const imgHeight = 11;
              const imgX = cell.x + 3;
              doc.addImage(inspectedBySignatureUrl, 'PNG', imgX, drawY, imgWidth, imgHeight);
              drawY += imgHeight + 2.5;
            } catch (e) {
              console.warn('Could not embed inspected-by signature image in PDF', e);
            }
          } else {
            drawY += 3;
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(inspectorPerson || 'Not Specified', cell.x + 3, drawY + 2.5);

          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          if (hasSig) {
            doc.text(`${officialInspectDate} • Verified`, cell.x + 3, drawY + 6.5);
          } else {
            doc.text(officialInspectDate, cell.x + 3, drawY + 6.5);
            doc.text('Official Inspection Sign-off', cell.x + 3, drawY + 10);
          }
        }
      }
    },
  });

  // Add Page Numbers & Footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Maxwell Hotel & Suites • Room Preventive Maintenance Inspection • Room ${roomNumber}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  const safeFilename = `Maxwell_Inspection_Room_${roomNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, filename: safeFilename };
}

export function generateInspectionPdf(options: GeneratePdfOptions): void {
  const { doc, filename } = buildInspectionPdfDoc(options);
  doc.save(filename);
}

export function getInspectionPdfBlob(options: GeneratePdfOptions): { blob: Blob; filename: string } {
  const { doc, filename } = buildInspectionPdfDoc(options);
  const blob = doc.output('blob');
  return { blob, filename };
}
