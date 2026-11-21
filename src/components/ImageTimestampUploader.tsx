"use client";

import React, { useState, useRef } from "react";
import {
  detectTimestampInImage,
  burnTimestampWatermark,
  TimestampDetectionResult,
} from "@/lib/detectTimestamp";
import {
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";

interface ImageTimestampUploaderProps {
  label: string;
  required?: boolean;
  onImageVerified: (data: { imageUrl: string; timestamp: string } | null) => void;
}

export default function ImageTimestampUploader({
  label,
  required = false,
  onImageVerified,
}: ImageTimestampUploaderProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<TimestampDetectionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      setIsAnalyzing(true);
      setDetectionResult(null);

      try {
        const result = await detectTimestampInImage(file, dataUrl);
        setDetectionResult(result);

        if (result.valid && result.timestamp) {
          onImageVerified({
            imageUrl: dataUrl,
            timestamp: result.timestamp,
          });
        } else {
          onImageVerified(null);
        }
      } catch (err) {
        setDetectionResult({
          valid: false,
          reason: "Terjadi kesalahan saat memproses gambar.",
        });
        onImageVerified(null);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }

  // Tambahkan Watermark Otomatis jika foto belum memiliki tanggal & jam:menit:detik
  async function handleAutoStamp() {
    if (!imagePreview) return;
    setIsAnalyzing(true);

    try {
      const stamped = await burnTimestampWatermark(imagePreview);
      setImagePreview(stamped.dataUrl);

      const successResult: TimestampDetectionResult = {
        valid: true,
        source: "Watermark Otomatis",
        timestamp: stamped.timestamp,
        date: stamped.timestamp.split(" ")[0],
        time: stamped.timestamp.split(" ")[1],
      };

      setDetectionResult(successResult);
      onImageVerified({
        imageUrl: stamped.dataUrl,
        timestamp: stamped.timestamp,
      });
    } catch (err) {
      alert("Gagal menambahkan watermark waktu ke gambar.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleReset() {
    setImagePreview(null);
    setDetectionResult(null);
    onImageVerified(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <span>{label}</span>
          {required && (
            <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border border-rose-300">
              * WAJIB
            </span>
          )}
        </label>
        <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Wajib ada Tanggal, Jam & Menit</span>
        </span>
      </div>

      {required && !imagePreview && (
        <div className="bg-rose-50/90 border border-rose-200 text-rose-800 text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Barang masuk & keluar <b>wajib</b> mengunggah foto bukti fisik yang memuat Tanggal, Jam, dan Menit.</span>
        </div>
      )}

      {!imagePreview ? (
        <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/70 rounded-xl p-4 transition-all text-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-full">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Unggah foto bukti</span> atau ambil foto langsung
            </div>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Sistem akan otomatis mendeteksi apakah gambar memiliki tanggal & waktu (HH:MM:SS) dari visual teks (GPS Map Cam) maupun metadata kamera (EXIF).
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Pilih File</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Buka Kamera</span>
              </button>
            </div>

            {/* Hidden File Inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 relative">
          <button
            type="button"
            onClick={handleReset}
            className="absolute top-2 right-2 bg-slate-800/80 hover:bg-slate-900 text-white p-1 rounded-full z-10 cursor-pointer"
            title="Hapus foto"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-56 bg-slate-950 flex items-center justify-center">
            <img
              src={imagePreview}
              alt="Foto Bukti"
              className="max-h-56 w-auto object-contain"
            />

            {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-950/75 flex flex-col items-center justify-center text-white space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-semibold">Memeriksa Tanggal, Jam, Menit & Detik...</span>
              </div>
            )}
          </div>

          {/* Status Hasil Deteksi */}
          {detectionResult && (
            <div>
              {detectionResult.valid ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Valid! Tanggal & Waktu Lengkap Terdeteksi</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 font-mono text-[11px] pl-5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span><b>{detectionResult.timestamp}</b></span>
                    <span className="text-slate-400">({detectionResult.source})</span>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-lg text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Belum Memenuhi Syarat: Waktu Lengkap Tidak Ditemukan</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    {detectionResult.reason}
                  </p>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleAutoStamp}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Beri Stempel Waktu Otomatis Sekarang (Watermark Resmi)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
