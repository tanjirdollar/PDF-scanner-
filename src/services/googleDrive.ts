export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

/**
 * List files from user's Google Drive with optional search query and mimeType filtering
 */
export async function listDriveFiles(
  accessToken: string,
  options?: {
    search?: string;
    onlyPdfs?: boolean;
    pageSize?: number;
  }
): Promise<DriveFile[]> {
  try {
    const qParts: string[] = ["trashed = false"];
    if (options?.onlyPdfs) {
      qParts.push("(mimeType = 'application/pdf' or mimeType = 'text/plain')");
    }
    if (options?.search?.trim()) {
      const sanitized = options.search.replace(/'/g, "\\'");
      qParts.push(`name contains '${sanitized}'`);
    }

    const q = qParts.join(" and ");
    const params = new URLSearchParams({
      q,
      fields: "files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink)",
      pageSize: String(options?.pageSize || 30),
      orderBy: "modifiedTime desc",
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Drive API error ${res.status}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (error: any) {
    console.error("Failed to list Google Drive files:", error);
    throw error;
  }
}

/**
 * Download file content as Blob or ArrayBuffer from Google Drive
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string
): Promise<{ blob: Blob; arrayBuffer: ArrayBuffer }> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to download file: ${res.status}`);
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return { blob, arrayBuffer };
  } catch (error: any) {
    console.error("Failed to download Google Drive file:", error);
    throw error;
  }
}

/**
 * Upload converted Unicode Bengali text to user's Google Drive
 */
export async function saveTextToDrive(
  accessToken: string,
  filename: string,
  content: string
): Promise<{ id: string; name: string }> {
  try {
    const metadata = {
      name: filename.endsWith(".txt") ? filename : `${filename}.txt`,
      mimeType: "text/plain",
    };

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
      content +
      closeDelimiter;

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to upload to Drive: ${res.status}`);
    }

    return await res.json();
  } catch (error: any) {
    console.error("Failed to save file to Google Drive:", error);
    throw error;
  }
}
