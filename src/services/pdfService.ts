import * as pdfjsLib from "pdfjs-dist";

// Configure pdfjs worker using unpkg or CDN
if (typeof window !== "undefined" && "GlobalWorkerOptions" in pdfjsLib) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ExtractedPdfResult {
  totalPages: number;
  fullText: string;
  pages: { pageNumber: number; text: string; hasText: boolean }[];
  isScannedOrImageOnly: boolean;
}

/**
 * Get total number of pages from a PDF ArrayBuffer
 */
export async function getPdfInfo(arrayBuffer: ArrayBuffer): Promise<{ totalPages: number }> {
  const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer.slice(0) });
  const pdf = await loadingTask.promise;
  return { totalPages: pdf.numPages };
}

/**
 * Extract embedded text layer from a PDF file
 */
export async function extractTextFromPdf(
  arrayBuffer: ArrayBuffer,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<ExtractedPdfResult> {
  const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer.slice(0) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages: { pageNumber: number; text: string; hasText: boolean }[] = [];
  let totalExtractedLength = 0;

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress(i, totalPages);
    }
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = "";

    for (const item of textContent.items as any[]) {
      if (!item.str) continue;
      // Group words into lines based on Y position change
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += "\n";
      } else if (pageText && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
        pageText += " ";
      }
      pageText += item.str;
      lastY = item.transform[5];
    }

    const cleanPageText = pageText.trim();
    totalExtractedLength += cleanPageText.length;
    pages.push({
      pageNumber: i,
      text: cleanPageText,
      hasText: cleanPageText.length > 20,
    });
  }

  const fullText = pages
    .filter((p) => p.text)
    .map((p) => `--- পৃষ্ঠা ${p.pageNumber} ---\n` + p.text)
    .join("\n\n");

  const isScannedOrImageOnly = totalExtractedLength < totalPages * 30;

  return {
    totalPages,
    fullText,
    pages,
    isScannedOrImageOnly,
  };
}

/**
 * Extract text from a single page of a PDF file
 */
export async function extractSinglePageText(
  arrayBuffer: ArrayBuffer,
  pageNumber: number
): Promise<string> {
  try {
    const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer.slice(0) });
    const pdf = await loadingTask.promise;
    if (pageNumber > pdf.numPages || pageNumber < 1) return "";
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = "";

    for (const item of textContent.items as any[]) {
      if (!item.str) continue;
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += "\n";
      } else if (pageText && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
        pageText += " ";
      }
      pageText += item.str;
      lastY = item.transform[5];
    }
    return pageText.trim();
  } catch (err) {
    console.warn(`Failed to extract text from page ${pageNumber}:`, err);
    return "";
  }
}

/**
 * Check if the first few pages of a PDF have digital text
 */
export async function checkPdfTextLayer(
  arrayBuffer: ArrayBuffer
): Promise<{ hasText: boolean; totalPages: number; sampleSnippet: string }> {
  try {
    const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer.slice(0) });
    const pdf = await loadingTask.promise;
    const pagesToCheck = Math.min(3, pdf.numPages);
    let totalChars = 0;
    let snippet = "";

    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = (textContent.items as any[])
        .map((it) => it.str || "")
        .join(" ")
        .trim();
      totalChars += text.length;
      if (!snippet && text.length > 20) {
        snippet = text.slice(0, 150);
      }
    }

    return {
      hasText: totalChars > 40,
      totalPages: pdf.numPages,
      sampleSnippet: snippet,
    };
  } catch (e) {
    return { hasText: false, totalPages: 1, sampleSnippet: "" };
  }
}

/**
 * Render a specific page of a PDF to an optimized base64 JPEG image (for Scanned OCR)
 */
export async function renderPdfPageToImage(
  arrayBuffer: ArrayBuffer,
  pageNumber: number,
  targetMaxDimension: number = 1400
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer.slice(0) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const defaultViewport = page.getViewport({ scale: 1.0 });
  const maxDim = Math.max(defaultViewport.width, defaultViewport.height);
  const calculatedScale = maxDim > 0 ? Math.min(2.0, Math.max(1.0, targetMaxDimension / maxDim)) : 1.4;
  const viewport = page.getViewport({ scale: calculatedScale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available.");
  }
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas,
  } as any).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const base64 = dataUrl.split(",")[1];
  return {
    dataUrl,
    base64,
    mimeType: "image/jpeg",
  };
}
