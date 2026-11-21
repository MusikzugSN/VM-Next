/**
 * Browser printing (D-2): the print-ready PDF goes into a hidden iframe, then its print dialog
 * opens. The iframe and the object URL are removed after printing (or after a minute at the latest,
 * because not every browser reports the end of printing).
 */
export function printPdf(pdf: Blob, doc: Document = document): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(pdf);
    const frame = doc.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      frame.remove();
      URL.revokeObjectURL(url);
    };
    frame.onload = () => {
      const view = frame.contentWindow;
      if (!view) {
        cleanup();
        reject(new Error('print frame without window'));
        return;
      }
      view.addEventListener('afterprint', () => setTimeout(cleanup, 1000), { once: true });
      setTimeout(cleanup, 60_000);
      try {
        view.focus();
        view.print();
        resolve();
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    frame.src = url;
    doc.body.appendChild(frame);
  });
}

/**
 * Opens the PDF in a new tab – on phones and tablets the way to print („über dein Gerät drucken“),
 * because embedded PDFs cannot be printed there. The tab is opened before the download finishes,
 * so pop-up blockers accept it; `load` fills it afterwards.
 */
export function openPdfTab(): { load(pdf: Blob): void; close(): void } {
  const tab = window.open('', '_blank');
  return {
    load(pdf: Blob) {
      const url = URL.createObjectURL(pdf);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    },
    close() {
      tab?.close();
    },
  };
}

/** Shares the PDF via the system share sheet (phones); `false` if the browser cannot share files. */
export async function sharePdf(pdf: Blob, fileName: string): Promise<boolean> {
  const file = new File([pdf], fileName, { type: 'application/pdf' });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: fileName });
    return true;
  } catch {
    // Cancelled by the person: nothing to report.
    return true;
  }
}

/** File name like the API's: „Druck – <Titel> – <Stimme>.pdf“ (characters not allowed in files removed). */
export function printFileName(title: string, voices: readonly string[]): string {
  const voice = voices.length === 1 ? voices[0] : voices.length > 1 ? `${voices.length} Stimmen` : '';
  const name = ['Druck', title, voice].filter(Boolean).join(' – ');
  return `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.pdf`;
}
