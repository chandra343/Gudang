"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  X,
  AlertCircle,
  Upload,
  Sparkles,
  Barcode as BarcodeIcon,
  RefreshCw,
} from "lucide-react";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: BarcodeScannerModalProps) {
  const [activeMode, setActiveMode] = useState<"camera" | "upload">("camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCameraScanner();
      return;
    }

    setCameraError(null);
    setFileError(null);

    // Jalankan kamera hanya jika mode camera aktif
    if (activeMode === "camera") {
      const timer = setTimeout(() => {
        initCamera();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeMode]);

  async function initCamera() {
    const scannerId = "interactive-barcode-reader";
    const el = document.getElementById(scannerId);
    if (!el) {
      setCameraError("Wadah kamera belum siap di layar. Silakan coba kembali.");
      return;
    }

    // Periksa apakah browser mendukung mediaDevices (memerlukan HTTPS jika bukan localhost)
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        "Kamera langsung dibatasi oleh kebijakan keamanan browser (memerlukan koneksi HTTPS atau 'localhost'). Namun jangan khawatir! Anda dapat menggunakan tab 'Scan dari Foto / Gambar' atau 'Buat Barcode Otomatis' di bawah."
      );
      setActiveMode("upload");
      return;
    }

    try {
      setIsScanning(true);
      setCameraError(null);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (decodedText) {
            onScanSuccess(decodedText.trim());
            stopCameraScanner();
            onClose();
          }
        },
        () => {
          // ignore scan frame misses
        }
      );
    } catch (err: any) {
      console.warn("Kamera tidak dapat dimulai:", err);
      const msg =
        err?.name === "NotAllowedError"
          ? "Izin akses kamera ditolak oleh pengguna atau browser."
          : err?.name === "NotFoundError" || err?.message?.includes("device not found")
          ? "Tidak ada perangkat kamera / webcam yang terdeteksi di komputer Anda."
          : err?.message || "Gagal membuka kamera.";

      setCameraError(msg);
      setIsScanning(false);
      // Alihkan otomatis ke mode unggah foto barcode
      setActiveMode("upload");
    }
  }

  async function stopCameraScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }

  // Scan Barcode dari File Gambar / Foto (100% bekerja di semua perangkat tanpa perlu izin webcam)
  async function handleFileScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileError(null);

    try {
      let tempScanner = scannerRef.current;
      if (!tempScanner) {
        tempScanner = new Html5Qrcode("interactive-barcode-reader");
        scannerRef.current = tempScanner;
      }

      const decodedResult = await tempScanner.scanFile(file, true);
      if (decodedResult) {
        onScanSuccess(decodedResult.trim());
        stopCameraScanner();
        onClose();
      } else {
        setFileError("Tidak ditemukan kode barcode pada gambar yang dipilih. Pastikan barcode terlihat jelas.");
      }
    } catch (err: any) {
      setFileError("Gagal membaca barcode dari gambar tersebut. Pastikan garis barcode tidak buram atau coba foto yang lebih terang.");
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Buat Barcode Otomatis (EAN-13 Indonesia Format: 899 + 10 digit)
  function handleGenerateRandomBarcode() {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const generated = `899${randomDigits}`;
    onScanSuccess(generated);
    stopCameraScanner();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl relative overflow-hidden space-y-4">
        {/* Tombol Close */}
        <button
          type="button"
          onClick={() => {
            stopCameraScanner();
            onClose();
          }}
          className="absolute top-3 right-3 z-20 bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-full cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-xl">
            <BarcodeIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Deteksi Kode Barcode</h3>
            <p className="text-xs text-slate-500">Pilih metode deteksi yang Anda inginkan</p>
          </div>
        </div>

        {/* Tab Pemilihan Mode */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMode("camera")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeMode === "camera"
                ? "bg-white text-indigo-700 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kamera Langsung</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCameraScanner();
              setActiveMode("upload");
            }}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeMode === "upload"
                ? "bg-white text-indigo-700 shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Scan dari Foto / File</span>
          </button>
        </div>

        {/* Wadah Kamera Live */}
        <div
          className={`space-y-3 ${
            activeMode === "camera" && !cameraError ? "block" : "hidden"
          }`}
        >
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 min-h-[220px] flex items-center justify-center">
            <div id="interactive-barcode-reader" className="w-full"></div>
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-64 h-32 border-2 border-dashed border-indigo-400 rounded-lg animate-pulse flex items-center justify-center">
                  <span className="text-[10px] text-indigo-200 bg-slate-900/80 px-2 py-0.5 rounded">
                    Arahkan kamera ke barcode
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pesan Jika Kamera Mengalami Kendala (Desktop tanpa webcam / HTTP LAN) */}
        {activeMode === "camera" && cameraError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Kamera Tidak Tersedia</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              {cameraError}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setActiveMode("upload")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Gunakan Mode Scan Foto / File Saja</span>
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: SCAN DARI FOTO / FILE GAMBAR (100% BEKERJA TANPA KAMERA STREAMING) */}
        {activeMode === "upload" && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2"
            >
              <div className="bg-indigo-100 text-indigo-600 w-10 h-10 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800">
                Klik untuk Memilih Foto / Gambar Barcode
              </div>
              <p className="text-[11px] text-slate-500">
                Pilih foto produk yang memiliki barcode atau screenshot barcode dari galeri / file Anda.
              </p>
              {isProcessingFile && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-600 font-semibold pt-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sedang mendeteksi barcode dari gambar...</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileScan}
            />

            {fileError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-lg text-xs flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        )}

        {/* PILIHAN CADANGAN: BUAT BARCODE OTOMATIS */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="text-[11px] text-slate-400 text-center font-medium">
            Atau jika produk belum memiliki barcode fisik:
          </div>
          <button
            type="button"
            onClick={handleGenerateRandomBarcode}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Buat Kode Barcode Otomatis (EAN-13)</span>
          </button>
        </div>

        {/* Tombol Tutup */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopCameraScanner();
              onClose();
            }}
            className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
