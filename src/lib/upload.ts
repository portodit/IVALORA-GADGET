/**
 * VPS File Upload Utility
 * Menggantikan Supabase Storage — file disimpan langsung di VPS
 *
 * Endpoint : https://ivaloragadget.com/upload-api
 * Folders  : products | proofs | documents
 * GET files: https://ivaloragadget.com/uploads/:folder/:filename
 */

export type UploadFolder = "products" | "proofs" | "documents";

const UPLOAD_URL    = import.meta.env.DEV ? "/upload-api" : (import.meta.env.VITE_UPLOAD_URL as string);
const UPLOAD_SECRET = import.meta.env.VITE_UPLOAD_SECRET as string;

export interface UploadResult {
  url: string;       // full public URL, e.g. /uploads/products/uuid.webp
  filename: string;
  folder: UploadFolder;
}

/**
 * Upload satu file ke VPS storage.
 * Gambar otomatis dikompresi ke WebP oleh server.
 *
 * @param file   - File object dari <input type="file">
 * @param folder - "products" | "proofs" | "documents"
 * @returns      - { url, filename, folder }
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${UPLOAD_URL}/upload/${folder}`, {
    method: "POST",
    headers: {
      "x-api-key": UPLOAD_SECRET,
      "X-Api-Key": UPLOAD_SECRET,
      "Authorization": `Bearer ${UPLOAD_SECRET}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Upload gagal: ${res.status}`);
  }

  const data = await res.json();

  // Bangun URL: kita paksa menjadi path relatif (misal: /uploads/...)
  // agar di lokal bisa ditangkap proxy Vite, dan di production langsung di-handle Nginx.
  let publicUrl = data.url;
  if (publicUrl.startsWith("http")) {
    const urlObj = new URL(publicUrl);
    publicUrl = urlObj.pathname; // Hanya ambil '/uploads/...'
  } else if (!publicUrl.startsWith("/")) {
    publicUrl = "/" + publicUrl;
  }

  return {
    url: publicUrl,
    filename: data.filename,
    folder,
  };
}

/**
 * Hapus file dari VPS storage.
 */
export async function deleteFile(
  folder: UploadFolder,
  filename: string,
): Promise<void> {
  const res = await fetch(`${UPLOAD_URL}/upload/${folder}/${filename}`, {
    method: "DELETE",
    headers: {
      "x-api-key": UPLOAD_SECRET,
      "X-Api-Key": UPLOAD_SECRET,
      "Authorization": `Bearer ${UPLOAD_SECRET}`,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Delete gagal: ${res.status}`);
  }
}

/**
 * Helper: ekstrak filename dari URL VPS
 * "/uploads/products/abc123.webp" → "abc123.webp"
 */
export function filenameFromUrl(url: string): string {
  return url.split("/").pop() ?? "";
}

/**
 * Normalize URL upload agar selalu jadi path relatif.
 * - Di localhost  : Vite proxy tangani /uploads → production VPS
 * - Di VPS        : nginx serve langsung dari /var/www/ivalora/uploads/
 *
 * Menangani data lama yang tersimpan sebagai full URL (https://ivaloragadget.com/uploads/...)
 * maupun data baru yang sudah tersimpan sebagai relative path (/uploads/...).
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Strip domain jika full URL, ambil pathname saja
  if (url.startsWith("http")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  // Pastikan diawali "/"
  return url.startsWith("/") ? url : `/${url}`;
}
