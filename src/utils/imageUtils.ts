/**
 * Client-side image utility to optimize and downscale photos/scans before sending for OCR.
 * Prevents payload bloat, request timeouts, and Gemini 503 high-load spikes.
 */
export async function optimizeImageForOcr(
  file: File,
  maxDimension: number = 1500
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ছবিটি পড়তে ব্যর্থ হয়েছে"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("ছবিটি লোড করা যায়নি"));
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        let targetWidth = width;
        let targetHeight = height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            targetWidth = maxDimension;
            targetHeight = Math.round((height * maxDimension) / width);
          } else {
            targetHeight = maxDimension;
            targetWidth = Math.round((width * maxDimension) / height);
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const rawDataUrl = e.target?.result as string;
          const rawBase64 = rawDataUrl.split(",")[1];
          return resolve({ base64: rawBase64, mimeType: file.type || "image/jpeg" });
        }

        // Draw and compress to crisp JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
