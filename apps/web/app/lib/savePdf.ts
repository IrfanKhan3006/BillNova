// Renders a printable sheet to an A4 PDF and downloads it as `<fileName>.pdf`.
// Mimics print styles: `print:hidden` elements are hidden, `print:block` ones shown.
export async function saveElementAsPdf(el: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  el.setAttribute('data-pdf-target', '1');
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      onclone: (doc) => {
        const clone = doc.querySelector<HTMLElement>('[data-pdf-target]');
        if (!clone) return;
        clone.querySelectorAll<HTMLElement>('[class*="print:hidden"], .no-print').forEach((n) => (n.style.display = 'none'));
        clone.querySelectorAll<HTMLElement>('[class*="print:block"]').forEach((n) => (n.style.display = 'block'));
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
      },
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.95);
    let y = 0;
    pdf.addImage(img, 'JPEG', 0, y, pageW, imgH);
    while (imgH + y > pageH) {
      y -= pageH;
      pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, y, pageW, imgH);
    }
    const safe = (fileName || 'invoice').replace(/[\\/:*?"<>|]/g, '-');
    pdf.save(`${safe}.pdf`);
    return safe;
  } finally {
    el.removeAttribute('data-pdf-target');
  }
}
