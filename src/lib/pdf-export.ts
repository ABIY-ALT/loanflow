import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Capture an element and save it as a multi-page A4 PDF.
 *
 * The element is rendered once to a tall canvas, then split into A4 pages. Rather
 * than cutting at a fixed page height (which slices through tables/sections — e.g.
 * a "10. Fulfillment" block split across two pages), each page break is nudged up to
 * the nearest blank (whitespace) row so logical blocks stay intact. If the canvas
 * pixels can't be read (e.g. a cross-origin image taints it), it falls back to plain
 * fixed-height slicing.
 */
export async function exportElementToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Export target #${elementId} not found`);

  // Capture from the top so nothing is scrolled out of view.
  window.scrollTo(0, 0);

  // Expand horizontally-scrollable containers (e.g. shadcn <Table> wraps in
  // .overflow-auto) so html2canvas captures every column instead of the clipped
  // viewport. The `.exporting-pdf` rules live in globals.css.
  element.classList.add('exporting-pdf');

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: element.scrollWidth,
      // html2canvas renders <input>/<textarea> text poorly (shifted/clipped against
      // the field's underline). Swap each form field for a plain div carrying the same
      // value and visual styles in the cloned document, so the text renders cleanly.
      onclone: (clonedDoc) => {
        const root = clonedDoc.getElementById(elementId);
        if (!root) return;

        const replace = (cloned: Element, live: Element | undefined, multiline: boolean) => {
          const source = (live ?? cloned) as HTMLInputElement | HTMLTextAreaElement;
          const cs = window.getComputedStyle(source);
          const div = clonedDoc.createElement('div');
          div.textContent = source.value || cloned.getAttribute('value') || '';

          div.style.display = cs.display === 'inline' ? 'inline-block' : (cs.display || 'block');
          div.style.width = cs.width;
          div.style.boxSizing = 'border-box';
          div.style.fontFamily = cs.fontFamily;
          div.style.fontSize = cs.fontSize;
          div.style.fontWeight = cs.fontWeight;
          div.style.fontStyle = cs.fontStyle;
          div.style.color = cs.color;
          div.style.textAlign = cs.textAlign;
          div.style.paddingLeft = cs.paddingLeft;
          div.style.paddingRight = cs.paddingRight;
          div.style.borderBottom = `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`;

          if (multiline) {
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordBreak = 'break-word';
            div.style.minHeight = cs.height;
            div.style.lineHeight = '1.45';
            div.style.paddingTop = '2px';
            div.style.paddingBottom = '4px';
          } else {
            div.style.whiteSpace = 'nowrap';
            div.style.overflow = 'hidden';
            div.style.height = cs.height;
            div.style.lineHeight = cs.height; // vertically centre single-line text
          }

          cloned.parentNode?.replaceChild(div, cloned);
        };

        const liveInputs = element.querySelectorAll('input');
        root.querySelectorAll('input').forEach((c, i) => replace(c, liveInputs[i], false));
        const liveTextareas = element.querySelectorAll('textarea');
        root.querySelectorAll('textarea').forEach((c, i) => replace(c, liveTextareas[i], true));
      },
    });
  } finally {
    element.classList.remove('exporting-pdf');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Uniform page margins so content never sits flush against the page edge.
  const marginX = 10; // mm
  const marginY = 12; // mm
  const contentWidth = pdfWidth - marginX * 2;
  const contentHeight = pdfHeight - marginY * 2;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  // One page's worth of usable (inside-margins) height, in source-canvas pixels.
  const pageHeightPx = Math.floor((contentHeight * canvasWidth) / contentWidth);

  // Try to read the pixels so we can pick whitespace break points. If the canvas
  // is tainted this throws — we then fall back to fixed-height slicing.
  let pixels: Uint8ClampedArray | null = null;
  try {
    const ctx = canvas.getContext('2d');
    pixels = ctx ? ctx.getImageData(0, 0, canvasWidth, canvasHeight).data : null;
  } catch {
    pixels = null;
  }

  // A row is a safe break point if it is "uniform" — i.e. nothing (text, borders,
  // input underlines) crosses it, only the background colour. This works whether the
  // background is white or a tint (these forms use a cream/amber background), unlike a
  // plain near-white test which finds no blank rows on a tinted page.
  const isRowUniform = (y: number): boolean => {
    if (!pixels) return false;
    const rowStart = y * canvasWidth * 4;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let x = 0; x < canvasWidth; x += 3) {
      const i = rowStart + x * 4;
      if (pixels[i + 3] === 0) continue; // skip fully transparent pixels
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    const spread = Math.max(rMax - rMin, gMax - gMin, bMax - bMin);
    return spread <= 10;
  };

  const addSlice = (top: number, sliceHeight: number, isFirst: boolean) => {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvasWidth;
    pageCanvas.height = sliceHeight;
    const pctx = pageCanvas.getContext('2d');
    if (pctx) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, canvasWidth, sliceHeight);
      pctx.drawImage(canvas, 0, top, canvasWidth, sliceHeight, 0, 0, canvasWidth, sliceHeight);
    }
    const imgData = pageCanvas.toDataURL('image/png');
    // Scale the slice to the content width and inset it by the page margins.
    const sliceHeightMm = (sliceHeight * contentWidth) / canvasWidth;
    if (!isFirst) pdf.addPage();
    pdf.addImage(imgData, 'PNG', marginX, marginY, contentWidth, sliceHeightMm, undefined, 'FAST');
  };

  let top = 0;
  let isFirst = true;

  while (top < canvasHeight) {
    let cut = Math.min(top + pageHeightPx, canvasHeight);

    // For a non-final page, nudge the cut up to the nearest uniform (content-free)
    // row so we don't slice through a heading/section. Never make a page shorter
    // than 45% of a full page, otherwise fall back to the fixed boundary.
    if (cut < canvasHeight && pixels) {
      const minCut = top + Math.floor(pageHeightPx * 0.45);
      for (let y = cut; y > minCut; y--) {
        if (isRowUniform(y)) {
          cut = y;
          break;
        }
      }
    }

    addSlice(top, cut - top, isFirst);
    isFirst = false;
    top = cut;
  }

  pdf.save(filename);
}
