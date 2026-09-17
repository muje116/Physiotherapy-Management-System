import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateInvoicePdf(invoiceData: {
  invoiceNumber: string;
  patientName: string;
  date: string;
  lineItems: Array<{ description: string; qty: number; unitPrice: number; total: number }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  clinicName: string;
  clinicVat: string;
  clinicPracticeNo: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let y = height - 50;

  page.drawText(invoiceData.clinicName, { x: 50, y, size: 20, font: boldFont, color: rgb(0.2, 0.3, 0.8) });
  y -= 20;
  page.drawText(`Practice #: ${invoiceData.clinicPracticeNo}`, { x: 50, y, size: 10, font });
  y -= 15;
  page.drawText(`VAT #: ${invoiceData.clinicVat}`, { x: 50, y, size: 10, font });

  y -= 30;
  page.drawText('INVOICE', { x: 50, y, size: 24, font: boldFont });
  y -= 20;
  page.drawText(`# ${invoiceData.invoiceNumber}`, { x: 50, y, size: 14, font });
  y -= 15;
  page.drawText(`Date: ${invoiceData.date}`, { x: 50, y, size: 10, font });

  y -= 30;
  page.drawText('Bill To:', { x: 50, y, size: 12, font: boldFont });
  y -= 15;
  page.drawText(invoiceData.patientName, { x: 50, y, size: 10, font });

  y -= 40;
  page.drawText('Description', { x: 50, y, size: 10, font: boldFont });
  page.drawText('Qty', { x: 350, y, size: 10, font: boldFont });
  page.drawText('Unit Price', { x: 400, y, size: 10, font: boldFont });
  page.drawText('Total', { x: 480, y, size: 10, font: boldFont });

  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

  for (const item of invoiceData.lineItems) {
    y -= 20;
    page.drawText(item.description.substring(0, 40), { x: 50, y, size: 9, font });
    page.drawText(String(item.qty), { x: 350, y, size: 9, font });
    page.drawText(`R ${item.unitPrice.toFixed(2)}`, { x: 400, y, size: 9, font });
    page.drawText(`R ${item.total.toFixed(2)}`, { x: 480, y, size: 9, font });
  }

  y -= 30;
  page.drawLine({ start: { x: 350, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;
  page.drawText('Subtotal:', { x: 400, y, size: 10, font });
  page.drawText(`R ${invoiceData.subtotal.toFixed(2)}`, { x: 480, y, size: 10, font });
  y -= 15;
  page.drawText('VAT (15%):', { x: 400, y, size: 10, font });
  page.drawText(`R ${invoiceData.vatAmount.toFixed(2)}`, { x: 480, y, size: 10, font });
  y -= 15;
  page.drawText('Total:', { x: 400, y, size: 12, font: boldFont });
  page.drawText(`R ${invoiceData.total.toFixed(2)}`, { x: 480, y, size: 12, font: boldFont });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function generateExercisePlanPdf(planData: {
  patientName: string;
  planName: string;
  therapistName: string;
  exercises: Array<{ name: string; sets?: number; reps?: number; duration?: number; frequency?: string; notes?: string }>;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 750;

  page.drawText('Exercise Plan', { x: 50, y, size: 20, font: boldFont, color: rgb(0.2, 0.5, 0.2) });
  y -= 25;
  page.drawText(`Patient: ${planData.patientName}`, { x: 50, y, size: 11, font });
  y -= 15;
  page.drawText(`Plan: ${planData.planName}`, { x: 50, y, size: 11, font });
  y -= 15;
  page.drawText(`Therapist: ${planData.therapistName}`, { x: 50, y, size: 11, font });

  y -= 30;
  for (const ex of planData.exercises) {
    page.drawText(ex.name, { x: 50, y, size: 11, font: boldFont });
    y -= 15;
    if (ex.sets) page.drawText(`Sets: ${ex.sets}`, { x: 70, y, size: 9, font });
    if (ex.reps) page.drawText(`Reps: ${ex.reps}`, { x: 180, y, size: 9, font });
    if (ex.duration) page.drawText(`Duration: ${ex.duration}s`, { x: 300, y, size: 9, font });
    if (ex.frequency) page.drawText(`Frequency: ${ex.frequency}`, { x: 400, y, size: 9, font });
    y -= 15;
    if (ex.notes) page.drawText(`Notes: ${ex.notes}`, { x: 70, y, size: 9, font });
    y -= 25;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
