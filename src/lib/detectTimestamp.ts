import exifr from "exifr/dist/lite.esm.mjs";

export interface TimestampDetectionResult {
  valid: boolean;
  timestamp?: string; // Format: YYYY-MM-DD HH:mm:ss
  date?: string;
  time?: string;
  source?: "EXIF (Metadata Kamera Asli)" | "OCR (Teks Stempel Visual)" | "Watermark Otomatis";
  reason?: string;
}

/**
 * 1. Mendeteksi Tanggal, Jam, Menit, dan Detik dari Metadata EXIF Foto
 */
export async function detectFromExif(file: File): Promise<TimestampDetectionResult | null> {
  try {
    const exifData = await exifr.parse(file, [
      "DateTimeOriginal",
      "CreateDate",
      "ModifyDate",
    ]);

    if (exifData) {
      const dt = exifData.DateTimeOriginal || exifData.CreateDate || exifData.ModifyDate;
      if (dt instanceof Date && !isNaN(dt.getTime())) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        const ss = String(dt.getSeconds()).padStart(2, "0");

        return {
          valid: true,
          source: "EXIF (Metadata Kamera Asli)",
          date: `${y}-${m}-${d}`,
          time: `${hh}:${mm}:${ss}`,
          timestamp: `${y}-${m}-${d} ${hh}:${mm}:${ss}`,
        };
      } else if (typeof dt === "string") {
        const parts = dt.trim().split(" ");
        if (parts.length >= 2) {
          const datePart = parts[0].replace(/:/g, "-");
          const timePart = parts[1];
          if (/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
            return {
              valid: true,
              source: "EXIF (Metadata Kamera Asli)",
              date: datePart,
              time: timePart,
              timestamp: `${datePart} ${timePart}`,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Gagal membaca EXIF:", err);
  }
  return null;
}

/**
 * 2. Mendeteksi Tanggal, Jam, Menit, dan Detik dari Teks Visual di dalam Gambar (OCR)
 * Dilengkapi batas waktu timeout agar tidak pernah menggantung / hang jika CDN lambat.
 */
export async function detectFromOcr(imageSource: string | File): Promise<TimestampDetectionResult | null> {
  const ocrPromise = (async () => {
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret.data.text || "";

      // Cari Jam:Menit atau Jam:Menit:Detik (HH:MM atau HH:MM:SS)
      const timeMatch = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\b/);

      // Cari Tanggal (YYYY-MM-DD atau DD/MM/YYYY atau DD-MM-YYYY)
      const dateMatch =
        text.match(/\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/) ||
        text.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/);

      if (timeMatch && dateMatch) {
        const hh = timeMatch[1].padStart(2, "0");
        const mm = timeMatch[2].padStart(2, "0");
        const ss = timeMatch[3] ? timeMatch[3].padStart(2, "0") : "00";
        const timeStr = `${hh}:${mm}:${ss}`;
        const dateStr = dateMatch[0].replace(/\//g, "-").replace(/\./g, "-");

        return {
          valid: true,
          source: "OCR (Teks Stempel Visual)" as const,
          date: dateStr,
          time: timeStr,
          timestamp: `${dateStr} ${timeStr}`,
        };
      }
    } catch (err) {
      console.warn("OCR visual dilewati:", err);
    }
    return null;
  })();

  // Timeout maksimal 5 detik untuk OCR
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));

  return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * 3. Fungsi Utama: Evaluasi Gabungan (EXIF + OCR)
 */
export async function detectTimestampInImage(
  file: File,
  imageDataUrl: string
): Promise<TimestampDetectionResult> {
  // Cek Metode 1: EXIF Kamera
  const exifRes = await detectFromExif(file);
  if (exifRes && exifRes.valid) {
    return exifRes;
  }

  // Cek Metode 2: Visual OCR
  const ocrRes = await detectFromOcr(imageDataUrl);
  if (ocrRes && ocrRes.valid) {
    return ocrRes;
  }

  // Tidak ditemukan stempel waktu lengkap
  return {
    valid: false,
    reason:
      "Gambar belum terdeteksi memiliki cap Tanggal, Jam, Menit, dan Detik (HH:MM:SS) yang lengkap. Silakan gunakan foto berstempel waktu (misal GPS Map Camera) atau gunakan tombol 'Beri Stempel Waktu Otomatis'.",
  };
}

/**
 * 4. Fitur Watermarker: Otomatis Menempelkan Stempel Tanggal, Jam, Menit, dan Detik Resmi
 */
export function burnTimestampWatermark(dataUrl: string): Promise<{ dataUrl: string; timestamp: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context tidak tersedia"));

      ctx.drawImage(img, 0, 0);

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");

      const timestampText = `${y}-${m}-${d} ${hh}:${mm}:${ss}`;

      const fontSize = Math.max(16, Math.floor(img.width * 0.035));
      ctx.font = `bold ${fontSize}px monospace`;

      const line1 = `BUKTI INVENTARIS RESMI`;
      const line2 = `TANGGAL: ${d}/${m}/${y}`;
      const line3 = `WAKTU  : ${hh}:${mm}:${ss} WIB`;

      const boxPadding = fontSize * 0.8;
      const lineHeight = fontSize * 1.35;
      const boxWidth = Math.max(
        ctx.measureText(line1).width,
        ctx.measureText(line2).width,
        ctx.measureText(line3).width
      ) + boxPadding * 2;
      const boxHeight = lineHeight * 3 + boxPadding * 1.5;

      const posX = 20;
      const posY = img.height - boxHeight - 20;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = "rgba(99, 102, 241, 0.9)";
      ctx.lineWidth = 3;
      ctx.fillRect(posX, posY, boxWidth, boxHeight);
      ctx.strokeRect(posX, posY, boxWidth, boxHeight);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(line1, posX + boxPadding, posY + boxPadding + fontSize * 0.8);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(line2, posX + boxPadding, posY + boxPadding + fontSize * 0.8 + lineHeight);

      ctx.fillStyle = "#4ade80";
      ctx.fillText(line3, posX + boxPadding, posY + boxPadding + fontSize * 0.8 + lineHeight * 2);

      const stampedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      resolve({
        dataUrl: stampedDataUrl,
        timestamp: timestampText,
      });
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}
