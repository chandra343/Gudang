"use client";

import React, { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  recordStockMutation,
  addProduct,
  addWarehouse,
  createCompany,
  createNote,
  deleteNote,
  togglePinNote,
  loginWithIdCard,
  createEmployeeIdCard,
  receivePOIntoWarehouse,
  createPurchaseRequisition,
  createPurchaseOrder,
} from "@/app/actions";
import { ALL_UNITS } from "@/lib/units";
import BarcodeScannerModal from "./BarcodeScannerModal";
import ImageTimestampUploader from "./ImageTimestampUploader";
import LocationMapEmbed from "./LocationMapEmbed";
import {
  Building2,
  Package,
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  Plus,
  Search,
  Layers,
  History,
  CheckCircle2,
  X,
  Camera,
  Calendar,
  Barcode as BarcodeIcon,
  ImageIcon,
  Eye,
  Clock,
  Store,
  Phone,
  MessageCircle,
  MapPin,
  ExternalLink,
  Radio,
  Wifi,
  Filter,
  RotateCcw,
  StickyNote,
  Pin,
  Trash2,
  Sparkles,
  LogOut,
  ChevronDown,
  CreditCard,
  IdCard,
  UserCheck,
  ShieldCheck,
  User,
  ShoppingCart,
  FileText,
  Send,
  Copy,
  Boxes,
  ArrowRight,
  PackageCheck,
  Check,
  Terminal,
} from "lucide-react";

export interface KnownSupplierInfo {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  phone?: string | null;
  address?: string | null;
}

interface ProductWithStock {
  id: string;
  barcode: string | null;
  name: string;
  unit: string;
  minStock: number;
  lastInDate: Date | string | null;
  lastOutDate: Date | string | null;
  imageUrl?: string | null;
  imageTimestamp?: string | null;
  supplierName?: string | null;
  supplierPhone?: string | null;
  supplierWhatsapp?: string | null;
  supplierAddress?: string | null;
  category: { name: string } | null;
  stocks: Array<{
    id: string;
    warehouseId: string;
    quantity: number;
    warehouse: { name: string; code: string };
  }>;
}

interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  location: string | null;
  isPrimary: boolean;
}

interface TransactionItem {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  date: Date | string;
  imageUrl?: string | null;
  imageTimestamp?: string | null;
  supplierName?: string | null;
  supplierPhone?: string | null;
  supplierWhatsapp?: string | null;
  supplierAddress?: string | null;
  referenceNumber: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: Date | string;
  product: { name: string; barcode: string | null; unit: string };
  warehouse: { name: string; code: string };
}

export interface NoteItem {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  author: string;
  isPinned: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EmployeeUserItem {
  id: string;
  idCard: string;
  name: string;
  role: string;
  position: string | null;
  companyId: string;
  company?: {
    id: string;
    name: string;
    plan: string;
  };
}

export interface CurrentUser {
  id: string;
  idCard: string;
  name: string;
  role: string;
  position: string;
  companyId: string;
  companyName: string;
}

interface DashboardClientProps {
  initialCompanies: Company[];
  initialCompanyId: string;
  initialData: any;
  initialEmployees?: EmployeeUserItem[];
}

export default function DashboardClient({
  initialCompanies,
  initialCompanyId,
  initialData,
  initialEmployees = [],
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Authentication State (Login ID Card Karyawan)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [loginIdInput, setLoginIdInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showUserDropdown, setShowUserDropdown] = useState<boolean>(false);
  const [showRegisterUserModal, setShowRegisterUserModal] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState({
    idCard: "",
    name: "",
    position: "Staf Logistik",
    companyId: initialCompanyId || "",
  });

  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Cek sesi login tersimpan di browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gudang_logged_in_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.idCard && parsed.name) {
          setCurrentUser(parsed);
        }
      }
    } catch (e) {
      // ignore JSON parse error
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [activeTab, setActiveTab] = useState<"inventory" | "logs" | "notes" | "purchasing" | "mutation" | "warehouses">("inventory");

  // Modals & Scanner
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showMutationModal, setShowMutationModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"newProduct" | "mutation" | "filterBarcode" | "loginId" | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; timestamp?: string | null; title: string } | null>(null);
  const [activeMapModal, setActiveMapModal] = useState<{
    address: string;
    name?: string;
    phone?: string | null;
    whatsapp?: string | null;
  } | null>(null);
  const [expandedMapProductId, setExpandedMapProductId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Purchasing Integration States
  const [selectedPoForReceive, setSelectedPoForReceive] = useState<any | null>(null);
  const [receivePoWarehouseId, setReceivePoWarehouseId] = useState<string>(
    initialData?.warehouses?.[0]?.id || ""
  );
  const [receivePoImageData, setReceivePoImageData] = useState<{ imageUrl: string; timestamp: string }>({
    imageUrl: "",
    timestamp: "",
  });
  const [isReceivingPo, setIsReceivingPo] = useState<boolean>(false);
  const [copiedApiUrl, setCopiedApiUrl] = useState<boolean>(false);
  const [showCreatePoModal, setShowCreatePoModal] = useState<boolean>(false);
  const [newPoForm, setNewPoForm] = useState({
    supplierName: "",
    supplierPhone: "",
    supplierAddress: "",
    productId: initialData?.products?.[0]?.id || "",
    quantity: 10,
    unit: initialData?.products?.[0]?.unit || "pcs",
    notes: "Pengadaan bahan baku dari Tim Purchasing",
  });

  // Filter & Form States untuk Catatan
  const [noteFilterCategory, setNoteFilterCategory] = useState("all");
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [newNoteForm, setNewNoteForm] = useState({
    title: "",
    content: "",
    category: "Operasional",
    priority: "NORMAL",
    author: "Staf Gudang",
    isPinned: false,
  });

  // State & Data Notifikasi Otomatis Stok Menipis di Atas Kiri (Muncul setiap user masuk website)
  const [showLowStockAlert, setShowLowStockAlert] = useState(true);

  const lowStockProducts = useMemo(() => {
    return (initialData?.products || []).filter((p: ProductWithStock) => {
      const totalQty = p.stocks.reduce((acc, c) => acc + c.quantity, 0);
      return totalQty <= p.minStock;
    });
  }, [initialData?.products]);

  // Reset agar alert selalu muncul jika user berpindah perusahaan atau ada barang menipis baru
  useEffect(() => {
    if (lowStockProducts.length > 0) {
      setShowLowStockAlert(true);
    }
  }, [initialCompanyId, lowStockProducts.length]);

  // Filter States: Nama Barang, Barcode, Nama Perusahaan, & Rentang Tanggal
  const [filterProductName, setFilterProductName] = useState("");
  const [filterBarcode, setFilterBarcode] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterDateType, setFilterDateType] = useState<"all" | "in" | "out">("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Auto-Detect & Live Sync States
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);
  const versionRef = useRef<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Add Product Form State
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    barcode: "",
    unit: "pcs",
    customUnit: "",
    minStock: 5,
    warehouseId: initialData?.warehouses?.[0]?.id || "",
    initialStock: 0,
    initialStockDate: todayStr,
    imageUrl: "",
    imageTimestamp: "",
    supplierName: "",
    supplierPhone: "",
    supplierWhatsapp: "",
    supplierAddress: "",
  });

  // Mutation Form State
  const [mutationForm, setMutationForm] = useState({
    productId: initialData?.products?.[0]?.id || "",
    warehouseId: initialData?.warehouses?.[0]?.id || "",
    type: "IN" as "IN" | "OUT" | "ADJUSTMENT",
    quantity: 1,
    unit: initialData?.products?.[0]?.unit || "pcs",
    date: todayStr,
    imageUrl: "",
    imageTimestamp: "",
    supplierName: "",
    supplierPhone: "",
    supplierWhatsapp: "",
    supplierAddress: "",
    referenceNumber: "",
    notes: "",
    performedBy: "Staf Gudang",
  });

  useEffect(() => {
    if (!mutationForm.productId) return;
    const selectedProd = (initialData?.products || []).find(
      (p: ProductWithStock) => p.id === mutationForm.productId
    );
    if (selectedProd) {
      setMutationForm((prev) => ({
        ...prev,
        unit: selectedProd.unit || "pcs",
      }));
    }
  }, [mutationForm.productId, initialData]);

  function showMessage(type: "success" | "error", text: string) {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  }

  // Auto-Detect Polling Engine (Mendeteksi perubahan data setiap 3 detik)
  useEffect(() => {
    if (!autoRefresh || !initialCompanyId) return;

    let isSubscribed = true;

    async function checkSync() {
      try {
        setIsSyncing(true);
        const res = await fetch(`/api/sync?companyId=${initialCompanyId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isSubscribed) return;

        if (versionRef.current && data.version && versionRef.current !== data.version) {
          versionRef.current = data.version;
          setAutoDetectNotice("⚡ Data baru terdeteksi! Tampilan telah diperbarui otomatis.");
          startTransition(() => {
            router.refresh();
          });
          setTimeout(() => {
            if (isSubscribed) setAutoDetectNotice(null);
          }, 4500);
        } else if (!versionRef.current && data.version) {
          versionRef.current = data.version;
        }
      } catch (e) {
        // silent error handling for network hiccups
      } finally {
        if (isSubscribed) {
          setTimeout(() => setIsSyncing(false), 500);
        }
      }
    }

    // Pengecekan saat pertama kali mount
    checkSync();

    // Deteksi instan saat user membuka kembali tab browser
    const handleFocus = () => {
      checkSync();
    };
    window.addEventListener("focus", handleFocus);

    // Interval polling otomatis setiap 3 detik
    const timer = setInterval(checkSync, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [autoRefresh, initialCompanyId, router]);

  function handleCompanyChange(newCompanyId: string) {
    startTransition(() => {
      router.push(`/?companyId=${newCompanyId}`);
    });
  }

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
      showMessage("success", "Data berhasil diperbarui!");
    });
  }

  // Otomatis sinkronisasi nama staf untuk transaksi dan catatan saat login
  useEffect(() => {
    if (currentUser) {
      setMutationForm((prev) => ({
        ...prev,
        performedBy: currentUser.name,
      }));
      setNewNoteForm((prev) => ({
        ...prev,
        author: currentUser.name,
      }));
    }
  }, [currentUser]);

  // Handler Login Menggunakan Nomor ID Card Karyawan
  const handleLogin = async (idToUse?: string) => {
    const targetId = (idToUse || loginIdInput).trim();
    if (!targetId) {
      setLoginError("Silakan masukkan Nomor ID Card Anda.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await loginWithIdCard(targetId);
      if (!res.success || !res.user) {
        setLoginError(res.error || "Nomor ID Card tidak ditemukan.");
        setIsLoggingIn(false);
        return;
      }

      const loggedUser: CurrentUser = {
        id: res.user.id,
        idCard: res.user.idCard,
        name: res.user.name,
        role: res.user.role,
        position: res.user.position || "Staf Gudang",
        companyId: res.user.companyId,
        companyName: res.user.companyName,
      };

      setCurrentUser(loggedUser);
      localStorage.setItem("gudang_logged_in_user", JSON.stringify(loggedUser));
      setLoginIdInput("");
      showMessage(
        "success",
        `Selamat datang, ${loggedUser.name}! Login berhasil dengan ID Card ${loggedUser.idCard}.`
      );

      // Pindah ke perusahaan milik user jika berbeda
      if (loggedUser.companyId && loggedUser.companyId !== initialCompanyId) {
        router.push(`/?companyId=${loggedUser.companyId}`);
      }
    } catch (err: any) {
      setLoginError(err.message || "Gagal melakukan verifikasi login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handler Log Out (Keluar)
  const handleLogout = () => {
    setCurrentUser(null);
    setShowUserDropdown(false);
    localStorage.removeItem("gudang_logged_in_user");
    showMessage(
      "success",
      "Anda telah berhasil Log Out (Keluar). Silakan masukkan Nomor ID Card untuk masuk kembali."
    );
  };

  // Handler Mendaftarkan ID Card Karyawan Baru oleh Perusahaan
  const handleCreateEmployeeCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.idCard.trim() || !newUserForm.name.trim()) {
      showMessage("error", "Nomor ID Card dan Nama Karyawan wajib diisi.");
      return;
    }
    try {
      const created = await createEmployeeIdCard({
        companyId: newUserForm.companyId || initialCompanyId,
        idCard: newUserForm.idCard.trim(),
        name: newUserForm.name.trim(),
        position: newUserForm.position.trim(),
      });
      setShowRegisterUserModal(false);
      showMessage(
        "success",
        `Kartu ID "${created.idCard}" untuk ${created.name} berhasil diterbitkan!`
      );
      // Auto login dengan kartu ID baru
      await handleLogin(created.idCard);
    } catch (err: any) {
      showMessage("error", err.message || "Gagal mendaftarkan ID Card karyawan.");
    }
  };

  // Handler Terima Barang PO ke Gudang (Goods Receipt)
  const handleConfirmReceivePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoForReceive) return;
    if (!receivePoWarehouseId) {
      showMessage("error", "Pilih gudang penerima terlebih dahulu.");
      return;
    }
    if (!receivePoImageData.imageUrl || !receivePoImageData.timestamp) {
      showMessage("error", "Wajib mengunggah foto fisik barang / surat jalan berstempel tanggal, jam & menit.");
      return;
    }

    setIsReceivingPo(true);
    try {
      const receiverIdentity = currentUser ? `${currentUser.name} (${currentUser.idCard || "WH-001"})` : "Staf Gudang";
      await receivePOIntoWarehouse({
        poId: selectedPoForReceive.id,
        warehouseId: receivePoWarehouseId,
        receivedBy: receiverIdentity,
        imageUrl: receivePoImageData.imageUrl,
        imageTimestamp: receivePoImageData.timestamp,
        notes: `Barang PO ${selectedPoForReceive.poNumber} dari ${selectedPoForReceive.supplierName} telah tiba dan diverifikasi di gudang oleh ${receiverIdentity}`,
      });
      setSelectedPoForReceive(null);
      setReceivePoImageData({ imageUrl: "", timestamp: "" });
      showMessage(
        "success",
        `✓ Barang dari PO ${selectedPoForReceive.poNumber} berhasil diterima ke gudang! Data kedatangan otomatis terkirim ke tim Purchasing.`
      );
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal memproses penerimaan barang PO.");
    } finally {
      setIsReceivingPo(false);
    }
  };

  // Handler Buat Permintaan Pengadaan Otomatis (PR) untuk Barang Menipis
  const handleAutoSubmitPRFromLowStock = async () => {
    if (!lowStockProducts.length) {
      showMessage("success", "Semua stok barang dalam kondisi aman. Belum ada barang yang perlu pengadaan.");
      return;
    }

    try {
      const itemsToRequest = lowStockProducts.map((p: ProductWithStock) => {
        const total = p.stocks.reduce((acc: number, c: any) => acc + c.quantity, 0);
        return {
          productId: p.id,
          productName: p.name,
          currentStock: total,
          minStock: p.minStock,
          requestedQty: Math.max(p.minStock * 2 - total, 10),
          unit: p.unit,
          reason: "Stok fisik di gudang menipis / kritis di bawah batas minimum",
        };
      });

      const pr = await createPurchaseRequisition({
        companyId: initialCompanyId,
        requestedBy: currentUser?.name || "Kepala Gudang",
        urgency: "URGENT",
        notes: `Pengajuan otomatis dari sistem gudang untuk ${itemsToRequest.length} barang yang stoknya menipis.`,
        items: itemsToRequest,
      });

      showMessage(
        "success",
        `⚡ Permintaan Pengadaan (${pr.prNumber}) untuk ${itemsToRequest.length} barang berhasil dikirim ke Tim Purchasing!`
      );
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal mengajukan permintaan pengadaan.");
    }
  };

  // Handler Simulasi Terbitkan PO Baru dari Tim Purchasing
  const handleCreatePOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = (initialData?.products || []).find((p: ProductWithStock) => p.id === newPoForm.productId);
    if (!prod) {
      showMessage("error", "Pilih produk terlebih dahulu.");
      return;
    }

    try {
      const po = await createPurchaseOrder({
        companyId: initialCompanyId,
        supplierName: newPoForm.supplierName || prod.supplierName || "PT Vendor Utama",
        supplierPhone: newPoForm.supplierPhone || prod.supplierPhone || undefined,
        supplierAddress: newPoForm.supplierAddress || prod.supplierAddress || undefined,
        notes: newPoForm.notes,
        items: [
          {
            productId: prod.id,
            productName: prod.name,
            quantity: Number(newPoForm.quantity),
            unit: newPoForm.unit || prod.unit,
          },
        ],
      });

      setShowCreatePoModal(false);
      showMessage(
        "success",
        `Purchase Order ${po.poNumber} berhasil diterbitkan dari Purchasing dan siap diterima Gudang!`
      );
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menerbitkan Purchase Order.");
    }
  };

  function handleBarcodeDetected(scannedCode: string) {
    if (scannerTarget === "newProduct") {
      setNewProductForm((prev) => ({ ...prev, barcode: scannedCode }));
      showMessage("success", `Barcode terdeteksi: ${scannedCode}`);
    } else if (scannerTarget === "mutation") {
      const matched = (initialData?.products || []).find(
        (p: ProductWithStock) => p.barcode && p.barcode.trim() === scannedCode.trim()
      );
      if (matched) {
        setMutationForm((prev) => ({
          ...prev,
          productId: matched.id,
          unit: matched.unit || prev.unit,
        }));
        showMessage("success", `Produk ditemukan: ${matched.name} (${scannedCode})`);
      } else {
        showMessage("error", `Barcode ${scannedCode} belum terdaftar di produk manapun.`);
      }
    } else if (scannerTarget === "filterBarcode") {
      setFilterBarcode(scannedCode);
      showMessage("success", `Filter barcode diterapkan: ${scannedCode}`);
    } else if (scannerTarget === "loginId") {
      const code = scannedCode.trim().toUpperCase();
      setLoginIdInput(code);
      handleLogin(code);
    }
    setScannerTarget(null);
  }

  // Submit Mutation
  async function handleMutationSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validasi WAJIB: Barang masuk dan keluar wajib foto yang memiliki tanggal, jam, dan menit
    if (mutationForm.type === "IN" || mutationForm.type === "OUT") {
      if (!mutationForm.imageUrl || !mutationForm.imageTimestamp) {
        showMessage(
          "error",
          `⚠️ Barang ${mutationForm.type === "IN" ? "Masuk" : "Keluar"} WAJIB mengunggah foto bukti fisik yang memuat Tanggal, Jam, dan Menit!`
        );
        return;
      }
    }

    try {
      await recordStockMutation({
        companyId: initialCompanyId,
        productId: mutationForm.productId || initialData?.products?.[0]?.id,
        warehouseId: mutationForm.warehouseId || initialData?.warehouses?.[0]?.id,
        type: mutationForm.type,
        quantity: Number(mutationForm.quantity),
        unit: mutationForm.unit,
        date: mutationForm.date,
        imageUrl: mutationForm.imageUrl || undefined,
        imageTimestamp: mutationForm.imageTimestamp || undefined,
        supplierName: mutationForm.supplierName || undefined,
        supplierPhone: mutationForm.supplierPhone || undefined,
        supplierWhatsapp: mutationForm.supplierWhatsapp || undefined,
        supplierAddress: mutationForm.supplierAddress || undefined,
        referenceNumber: mutationForm.referenceNumber,
        notes: mutationForm.notes,
        performedBy: mutationForm.performedBy,
      });
      showMessage("success", `Mutasi stok ${mutationForm.type === "IN" ? "masuk" : mutationForm.type === "OUT" ? "keluar" : "opname"} berhasil disimpan!`);
      setShowMutationModal(false);
      setMutationForm((prev) => ({
        ...prev,
        quantity: 1,
        referenceNumber: "",
        notes: "",
        imageUrl: "",
        imageTimestamp: "",
        supplierName: "",
        supplierPhone: "",
        supplierWhatsapp: "",
        supplierAddress: "",
      }));
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menyimpan mutasi");
    }
  }

  // Submit New Product
  async function handleAddProductSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validasi WAJIB: Jika mengisi stok awal masuk, wajib upload foto dengan timestamp
    if (Number(newProductForm.initialStock) > 0 && (!newProductForm.imageUrl || !newProductForm.imageTimestamp)) {
      showMessage(
        "error",
        "⚠️ Barang masuk (stok awal pendaftaran) WAJIB mengunggah foto bukti fisik yang memuat Tanggal, Jam, dan Menit!"
      );
      return;
    }

    const finalUnit =
      newProductForm.unit === "lainnya"
        ? newProductForm.customUnit.trim().toLowerCase() || "pcs"
        : newProductForm.unit;

    try {
      await addProduct({
        companyId: initialCompanyId,
        barcode: newProductForm.barcode || undefined,
        name: newProductForm.name,
        unit: finalUnit,
        minStock: Number(newProductForm.minStock) || 5,
        warehouseId: newProductForm.warehouseId || initialData?.warehouses?.[0]?.id,
        initialStock: Number(newProductForm.initialStock) || 0,
        initialStockDate: newProductForm.initialStockDate,
        imageUrl: newProductForm.imageUrl || undefined,
        imageTimestamp: newProductForm.imageTimestamp || undefined,
        supplierName: newProductForm.supplierName || undefined,
        supplierPhone: newProductForm.supplierPhone || undefined,
        supplierWhatsapp: newProductForm.supplierWhatsapp || undefined,
        supplierAddress: newProductForm.supplierAddress || undefined,
      });
      setShowAddProductModal(false);
      showMessage("success", "Produk baru berhasil ditambahkan!");
      setNewProductForm({
        name: "",
        barcode: "",
        unit: "pcs",
        customUnit: "",
        minStock: 5,
        warehouseId: initialData?.warehouses?.[0]?.id || "",
        initialStock: 0,
        initialStockDate: todayStr,
        imageUrl: "",
        imageTimestamp: "",
        supplierName: "",
        supplierPhone: "",
        supplierWhatsapp: "",
        supplierAddress: "",
      });
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menambah produk");
    }
  }

  // Submit New Company
  async function handleAddCompanySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const newComp = await createCompany({
        name: fd.get("name") as string,
        phone: (fd.get("phone") as string) || undefined,
        email: (fd.get("email") as string) || undefined,
        address: (fd.get("address") as string) || undefined,
      });
      setShowAddCompanyModal(false);
      showMessage("success", `Perusahaan "${newComp.name}" berhasil dibuat!`);
      router.push(`/?companyId=${newComp.id}`);
    } catch (err: any) {
      showMessage("error", err.message || "Gagal membuat perusahaan");
    }
  }

  // Daftar unik perusahaan / retail beserta kontak lengkap untuk Auto-Detect Otomatis
  const knownSuppliers = useMemo<KnownSupplierInfo[]>(() => {
    const map = new Map<string, KnownSupplierInfo>();

    // 1. Dari Products
    (initialData?.products || []).forEach((p: ProductWithStock) => {
      if (p.supplierName && p.supplierName.trim()) {
        const key = p.supplierName.trim().toLowerCase();
        const existing = map.get(key);
        map.set(key, {
          name: p.supplierName.trim(),
          phone: p.supplierPhone?.trim() || existing?.phone || "",
          whatsapp: p.supplierWhatsapp?.trim() || existing?.whatsapp || "",
          address: p.supplierAddress?.trim() || existing?.address || "",
        });
      }
    });

    // 2. Dari Transactions
    (initialData?.transactions || []).forEach((t: TransactionItem) => {
      if (t.supplierName && t.supplierName.trim()) {
        const key = t.supplierName.trim().toLowerCase();
        const existing = map.get(key);
        map.set(key, {
          name: t.supplierName.trim(),
          phone: t.supplierPhone?.trim() || existing?.phone || "",
          whatsapp: t.supplierWhatsapp?.trim() || existing?.whatsapp || "",
          address: t.supplierAddress?.trim() || existing?.address || "",
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialData?.products, initialData?.transactions]);

  // Daftar nama perusahaan untuk opsi filter
  const uniqueSuppliers = useMemo(() => {
    return knownSuppliers.map((s) => s.name);
  }, [knownSuppliers]);

  // Handler Auto-Detect saat mengetik nama perusahaan di Form Tambah Produk Baru
  const handleSupplierNameChangeInNewProduct = (val: string) => {
    const trimmed = val.trim();
    const matched = knownSuppliers.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (matched && trimmed.length > 0) {
      setNewProductForm((prev) => ({
        ...prev,
        supplierName: val,
        supplierPhone: matched.phone || prev.supplierPhone,
        supplierWhatsapp: matched.whatsapp || prev.supplierWhatsapp,
        supplierAddress: matched.address || prev.supplierAddress,
      }));
      showMessage(
        "success",
        `⚡ Auto-Detect Aktif: Data kontak & alamat untuk "${matched.name}" terisi otomatis!`
      );
    } else {
      setNewProductForm((prev) => ({
        ...prev,
        supplierName: val,
      }));
    }
  };

  const applyKnownSupplierToNewProduct = (s: KnownSupplierInfo) => {
    setNewProductForm((prev) => ({
      ...prev,
      supplierName: s.name,
      supplierPhone: s.phone || "",
      supplierWhatsapp: s.whatsapp || "",
      supplierAddress: s.address || "",
    }));
    showMessage(
      "success",
      `⚡ Auto-Detect: Data kontak & alamat "${s.name}" berhasil diterapkan otomatis!`
    );
  };

  // Handler Auto-Detect saat mengetik nama perusahaan di Form Mutasi Barang
  const handleSupplierNameChangeInMutation = (val: string) => {
    const trimmed = val.trim();
    const matched = knownSuppliers.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (matched && trimmed.length > 0) {
      setMutationForm((prev) => ({
        ...prev,
        supplierName: val,
        supplierPhone: matched.phone || prev.supplierPhone,
        supplierWhatsapp: matched.whatsapp || prev.supplierWhatsapp,
        supplierAddress: matched.address || prev.supplierAddress,
      }));
      showMessage(
        "success",
        `⚡ Auto-Detect Aktif: Data kontak & alamat untuk "${matched.name}" terisi otomatis!`
      );
    } else {
      setMutationForm((prev) => ({
        ...prev,
        supplierName: val,
      }));
    }
  };

  const applyKnownSupplierToMutation = (s: KnownSupplierInfo) => {
    setMutationForm((prev) => ({
      ...prev,
      supplierName: s.name,
      supplierPhone: s.phone || "",
      supplierWhatsapp: s.whatsapp || "",
      supplierAddress: s.address || "",
    }));
    showMessage(
      "success",
      `⚡ Auto-Detect: Data kontak & alamat "${s.name}" berhasil diterapkan otomatis!`
    );
  };

  // Cek kecocokan untuk Form Tambah Produk Baru
  const newProdSupplierMatch = useMemo(() => {
    if (!newProductForm.supplierName?.trim()) return null;
    return (
      knownSuppliers.find(
        (s) => s.name.trim().toLowerCase() === newProductForm.supplierName.trim().toLowerCase()
      ) || null
    );
  }, [newProductForm.supplierName, knownSuppliers]);

  const newProdPartialSuggestions = useMemo(() => {
    const query = newProductForm.supplierName?.trim().toLowerCase();
    if (!query || query.length < 2 || newProdSupplierMatch) return [];
    return knownSuppliers.filter((s) => s.name.toLowerCase().includes(query)).slice(0, 3);
  }, [newProductForm.supplierName, newProdSupplierMatch, knownSuppliers]);

  // Cek kecocokan untuk Form Mutasi Barang
  const mutationSupplierMatch = useMemo(() => {
    if (!mutationForm.supplierName?.trim()) return null;
    return (
      knownSuppliers.find(
        (s) => s.name.trim().toLowerCase() === mutationForm.supplierName.trim().toLowerCase()
      ) || null
    );
  }, [mutationForm.supplierName, knownSuppliers]);

  const mutationPartialSuggestions = useMemo(() => {
    const query = mutationForm.supplierName?.trim().toLowerCase();
    if (!query || query.length < 2 || mutationSupplierMatch) return [];
    return knownSuppliers.filter((s) => s.name.toLowerCase().includes(query)).slice(0, 3);
  }, [mutationForm.supplierName, mutationSupplierMatch, knownSuppliers]);

  // Cek apakah ada filter yang sedang aktif
  const hasActiveFilters = Boolean(
    filterProductName.trim() ||
    filterBarcode.trim() ||
    filterCompany.trim() ||
    filterStartDate ||
    filterEndDate ||
    filterDateType !== "all"
  );

  // Reset semua filter
  const handleResetFilters = () => {
    setFilterProductName("");
    setFilterBarcode("");
    setFilterCompany("");
    setFilterDateType("all");
    setFilterStartDate("");
    setFilterEndDate("");
    showMessage("success", "Semua filter telah direset.");
  };

  // Filtered Products: Tanggal, Nama Barang, Barcode, & Nama Perusahaan
  const filteredProducts = useMemo(() => {
    return (initialData?.products || []).filter((p: ProductWithStock) => {
      // 1. Filter Nama Barang
      if (filterProductName.trim()) {
        const nameQuery = filterProductName.trim().toLowerCase();
        if (!p.name.toLowerCase().includes(nameQuery)) {
          return false;
        }
      }

      // 2. Filter Kode Barcode
      if (filterBarcode.trim()) {
        const barcodeQuery = filterBarcode.trim().toLowerCase();
        if (!p.barcode || !p.barcode.toLowerCase().includes(barcodeQuery)) {
          return false;
        }
      }

      // 3. Filter Nama Perusahaan / Retail Tempat Pembelian
      if (filterCompany.trim()) {
        const compQuery = filterCompany.trim().toLowerCase();
        if (!p.supplierName || !p.supplierName.toLowerCase().includes(compQuery)) {
          return false;
        }
      }

      // 4. Filter Rentang Tanggal (Tanggal Masuk / Keluar)
      if (filterStartDate || filterEndDate) {
        const start = filterStartDate ? new Date(filterStartDate + "T00:00:00").getTime() : null;
        const end = filterEndDate ? new Date(filterEndDate + "T23:59:59").getTime() : null;

        const inTime = p.lastInDate ? new Date(p.lastInDate).getTime() : null;
        const outTime = p.lastOutDate ? new Date(p.lastOutDate).getTime() : null;

        if (filterDateType === "in") {
          if (!inTime) return false;
          if (start && inTime < start) return false;
          if (end && inTime > end) return false;
        } else if (filterDateType === "out") {
          if (!outTime) return false;
          if (start && outTime < start) return false;
          if (end && outTime > end) return false;
        } else {
          // Jenis "all": Cocok jika tanggal masuk ATAU tanggal keluar masuk dalam rentang
          const matchIn = inTime && (!start || inTime >= start) && (!end || inTime <= end);
          const matchOut = outTime && (!start || outTime >= start) && (!end || outTime <= end);
          if (!matchIn && !matchOut) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    initialData?.products,
    filterProductName,
    filterBarcode,
    filterCompany,
    filterDateType,
    filterStartDate,
    filterEndDate,
  ]);

  // Filter Catatan berdasarkan Kategori & Pencarian Teks
  const filteredNotes = useMemo(() => {
    return (initialData?.notes || []).filter((note: NoteItem) => {
      const matchCategory =
        noteFilterCategory === "all" ||
        note.category.toLowerCase() === noteFilterCategory.toLowerCase();

      const q = noteSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.author.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [initialData?.notes, noteFilterCategory, noteSearchQuery]);

  // Handler Catatan
  async function handleAddNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteForm.title.trim() || !newNoteForm.content.trim()) {
      showMessage("error", "Judul dan isi catatan wajib diisi!");
      return;
    }
    try {
      await createNote({
        companyId: initialCompanyId,
        title: newNoteForm.title,
        content: newNoteForm.content,
        category: newNoteForm.category,
        priority: newNoteForm.priority,
        author: newNoteForm.author,
        isPinned: newNoteForm.isPinned,
      });
      setShowAddNoteModal(false);
      showMessage("success", "Catatan baru berhasil disimpan!");
      setNewNoteForm({
        title: "",
        content: "",
        category: "Operasional",
        priority: "NORMAL",
        author: "Staf Gudang",
        isPinned: false,
      });
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menyimpan catatan.");
    }
  }

  async function handleDeleteNote(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan ini?")) return;
    try {
      await deleteNote(id);
      showMessage("success", "Catatan berhasil dihapus.");
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menghapus catatan.");
    }
  }

  async function handleTogglePin(id: string, currentPinned: boolean) {
    try {
      await togglePinNote(id, !currentPinned);
      showMessage(
        "success",
        currentPinned ? "Sematkan catatan dicabut." : "Catatan berhasil disematkan di atas!"
      );
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal mengubah status sematan.");
    }
  }

  const formatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderRegisterEmployeeModal = () => (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <IdCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Terbitkan ID Card Karyawan</h3>
              <p className="text-[11px] text-slate-500">Berikan nomor ID resmi kepada staf gudang</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterUserModal(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateEmployeeCard} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor ID Card Baru <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <CreditCard className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="Contoh: WH-004, STAF-01, dll."
                value={newUserForm.idCard}
                onChange={(e) => setNewUserForm({ ...newUserForm, idCard: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Nomor ID Card ini yang akan dimasukkan karyawan saat login ke sistem.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Lengkap Karyawan <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                required
                placeholder="Contoh: Doni Kusuma, Rian Hidayat"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jabatan / Posisi di Gudang
            </label>
            <input
              type="text"
              placeholder="Contoh: Staf Logistik, Operator Forklift, Admin Stok"
              value={newUserForm.position}
              onChange={(e) => setNewUserForm({ ...newUserForm, position: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Perusahaan / Tenant
            </label>
            <select
              value={newUserForm.companyId}
              onChange={(e) => setNewUserForm({ ...newUserForm, companyId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
            >
              {initialCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.plan})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRegisterUserModal(false)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan & Terbitkan ID</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Layar Tunggu Pengecekan Sesi Login
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-semibold tracking-wide">Memeriksa Sesi Login ID Card...</span>
        </div>
      </div>
    );
  }

  // LAYAR LOGIN MENGGUNAKAN NOMOR ID CARD (Sebelum Masuk ke Sistem)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden">
        {/* Pesan Toast Feedback */}
        {feedbackMsg && (
          <div
            className={`fixed top-4 right-4 z-[80] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-medium animate-bounce ${
              feedbackMsg.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Modal Scanner Barcode ID Card */}
        <BarcodeScannerModal
          isOpen={scannerTarget === "loginId"}
          onClose={() => setScannerTarget(null)}
          onScanSuccess={handleBarcodeDetected}
        />

        <div className="w-full max-w-md bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 relative z-10">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 mb-1">
              <Warehouse className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[11px] font-bold rounded-full uppercase tracking-wider">
                Sistem Manajemen Gudang & Inventaris
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Login Nomor ID Card
            </h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Silakan masukkan <strong>Nomor ID Card</strong> resmi yang telah diberikan oleh perusahaan untuk mulai mengakses sistem.
            </p>
          </div>

          {/* Form Input ID Card */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor ID Card Karyawan / Staf
              </label>
              <div className="relative">
                <CreditCard className="w-5 h-5 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Contoh: WH-001, WH-002, BJ-001..."
                  value={loginIdInput}
                  onChange={(e) => {
                    setLoginIdInput(e.target.value.toUpperCase());
                    if (loginError) setLoginError(null);
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl pl-11 pr-24 py-3 text-sm font-mono font-bold tracking-wider uppercase outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setScannerTarget("loginId")}
                  className="absolute right-2 top-2 px-2.5 py-1.5 bg-slate-200/70 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Scan Barcode / QR ID Card Fisik"
                >
                  <BarcodeIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Scan</span>
                </button>
              </div>

              {loginError && (
                <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !loginIdInput.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi ID Card...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Masuk ke Sistem Gudang</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Modal Terbitkan ID Card Baru */}
        {showRegisterUserModal && renderRegisterEmployeeModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* NOTIFIKASI OTOMATIS: PERINGATAN STOK MENIPIS DI ATAS KIRI (Setiap Masuk Website) */}
      {showLowStockAlert && lowStockProducts.length > 0 && (
        <div className="fixed top-4 left-4 z-[60] max-w-sm sm:max-w-md w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md border border-rose-200 border-l-4 border-l-rose-500 rounded-2xl p-4 shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shrink-0 shadow-xs">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-xl bg-rose-400 opacity-40"></span>
                <AlertTriangle className="w-4 h-4 relative z-10" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Peringatan Stok Menipis!
                  </h4>
                  <span className="text-[10px] font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                    {lowStockProducts.length} Produk Kritis
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Stok barang berada pada atau di bawah batas minimum:
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowLowStockAlert(false)}
              className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List Produk yang Stoknya Menipis */}
          <div className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {lowStockProducts.map((p: ProductWithStock) => {
              const total = p.stocks.reduce((acc: number, c: any) => acc + c.quantity, 0);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-rose-50/80 border border-rose-100 px-3 py-1.5 rounded-lg text-xs hover:bg-rose-100/70 transition-colors"
                >
                  <div className="truncate max-w-[170px] sm:max-w-[220px]">
                    <span className="font-semibold text-slate-900 block truncate">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.barcode ? `Barcode: ${p.barcode}` : "Tanpa Barcode"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-rose-600">{total} {p.unit}</span>
                    <span className="text-[10px] text-slate-400 block">Batas Min: {p.minStock} {p.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tombol Aksi Cepat di Notifikasi */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLowStockAlert(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={() => {
                const firstLow = lowStockProducts[0];
                if (firstLow) {
                  setMutationForm((prev) => ({
                    ...prev,
                    productId: firstLow.id,
                    unit: firstLow.unit,
                    type: "IN",
                  }));
                }
                setShowMutationModal(true);
                setShowLowStockAlert(false);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>+ Restock Barang Masuk</span>
            </button>
          </div>
        </div>
      )}

      {/* Chip Pembuka Kembali jika Notifikasi Ditutup */}
      {!showLowStockAlert && lowStockProducts.length > 0 && (
        <button
          type="button"
          onClick={() => setShowLowStockAlert(true)}
          className="fixed top-4 left-4 z-40 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
          title="Klik untuk membuka kembali rincian stok menipis"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>⚠️ {lowStockProducts.length} Stok Menipis</span>
        </button>
      )}
      {/* Toast Notification */}
      {feedbackMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-white text-sm transition-all ${
            feedbackMsg.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Auto-Detect New Data Floating Banner */}
      {autoDetectNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border-2 border-emerald-400 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce">
          <div className="bg-emerald-500 text-white p-2 rounded-xl flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Auto-Detect Berhasil!</span>
            </div>
            <p className="text-xs text-slate-100 font-medium mt-0.5">{autoDetectNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoDetectNotice(null)}
            className="text-slate-400 hover:text-white p-1 ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        onScanSuccess={handleBarcodeDetected}
      />

      {/* Modal Preview Gambar & Timestamp */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl relative overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute top-3 right-3 z-20 bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-slate-900 text-base mb-1">{previewImageModal.title}</h3>
            {previewImageModal.timestamp && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md w-max mb-3 border border-emerald-200">
                <Clock className="w-3.5 h-3.5" />
                <span>Timestamp Terverifikasi: <b>{previewImageModal.timestamp}</b></span>
              </div>
            )}

            <div className="rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[70vh]">
              <img
                src={previewImageModal.url}
                alt="Bukti Foto"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Peta Lokasi Interaktif */}
      {activeMapModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl relative overflow-hidden space-y-3">
            <button
              type="button"
              onClick={() => setActiveMapModal(null)}
              className="absolute top-3 right-3 z-20 bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="bg-rose-100 text-rose-600 p-2.5 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {activeMapModal.name || "Peta Lokasi Pembelian"}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeMapModal.address}
                </p>
              </div>
            </div>

            {/* Kontak Cepat Toko di Modal Peta */}
            {(activeMapModal.whatsapp || activeMapModal.phone) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                {activeMapModal.whatsapp && (
                  <a
                    href={`https://wa.me/${activeMapModal.whatsapp.replace(/[^0-9]/g, "").startsWith("0") ? "62" + activeMapModal.whatsapp.replace(/[^0-9]/g, "").slice(1) : activeMapModal.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg font-semibold transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chat WhatsApp ({activeMapModal.whatsapp})</span>
                  </a>
                )}
                {activeMapModal.phone && (
                  <a
                    href={`tel:${activeMapModal.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg font-medium transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Telepon ({activeMapModal.phone})</span>
                  </a>
                )}
              </div>
            )}

            {/* Frame Peta Interaktif */}
            <LocationMapEmbed
              address={activeMapModal.address}
              name={activeMapModal.name}
              height="380px"
            />
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md flex items-center justify-center">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                Gudang <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">SaaS Multi-Company</span>
              </span>
              <p className="text-xs text-slate-500 hidden sm:block">Sistem Manajemen Stok & Inventaris Perusahaan</p>
            </div>
          </div>

          {/* Tenant Switcher & Auto-Detect Controls */}
          <div className="flex items-center gap-2">
            {/* Tombol Toggle Auto-Detect */}
            <button
              type="button"
              onClick={() => {
                const nextVal = !autoRefresh;
                setAutoRefresh(nextVal);
                showMessage(
                  "success",
                  nextVal
                    ? "Auto-Detect Diaktifkan: Otomatis mendeteksi data baru setiap 3 detik."
                    : "Auto-Detect Dimatikan: Data hanya diperbarui saat tombol refresh ditekan."
                );
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 shadow-xs"
                  : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
              }`}
              title={
                autoRefresh
                  ? "Auto-Detect AKTIF: Otomatis memeriksa & memperbarui saat ada data baru dari perangkat/tab manapun"
                  : "Auto-Detect MATI: Klik untuk mengaktifkan deteksi otomatis"
              }
            >
              <span className="relative flex h-2 w-2">
                {autoRefresh && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    autoRefresh ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                ></span>
              </span>
              <span className="hidden sm:inline">Auto-Detect:</span>
              <span>{autoRefresh ? "ON" : "OFF"}</span>
              {isSyncing && autoRefresh && (
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 ml-0.5" />
              )}
            </button>

            <div className="relative flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
              <Building2 className="w-4 h-4 ml-2 text-slate-500" />
              <select
                value={initialCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 px-2 py-1 outline-none cursor-pointer"
              >
                {initialCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.plan})
                  </option>
                ))}
              </select>
            </div>

            {/* Profil Nama Karyawan & Menu Log Out (ID Card Karyawan) */}
            {currentUser && (
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowUserDropdown((prev) => !prev)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 pl-2 pr-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                  title="Klik nama Anda untuk info profil atau Log Out"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="block text-xs font-bold text-slate-800 leading-tight">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium font-mono">
                      ID: {currentUser.idCard}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
                </button>

                {/* Dropdown Menu Nama User & Log Out */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm uppercase shadow-xs">
                          {currentUser.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{currentUser.position || "Karyawan Gudang"}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Nomor ID Card:</span>
                        <span className="font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[11px]">
                          {currentUser.idCard}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Perusahaan:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[130px]">
                          {currentUser.companyName || initialData?.company?.name}
                        </span>
                      </div>
                    </div>

                    <div className="px-2 pt-1.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowRegisterUserModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <IdCard className="w-4 h-4 text-indigo-600" />
                        <span>+ Terbitkan ID Card Baru</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Log Out (Keluar)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Company Banner */}
        {initialData?.company ? (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{initialData.company.name}</h1>
                <span className="text-xs uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-semibold">
                  {initialData.company.plan} TIER
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                📍 {initialData.company.address || "Lokasi belum diatur"} • 📞 {initialData.company.phone || "-"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Badge Status Live Auto-Detect */}
              <div
                className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  autoRefresh
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                    : "bg-white/5 border-white/10 text-slate-400"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {autoRefresh && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      autoRefresh ? "bg-emerald-400" : "bg-slate-500"
                    }`}
                  ></span>
                </span>
                <span>{autoRefresh ? "Live Auto-Detect Aktif" : "Auto-Detect Mati"}</span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPending || isSyncing ? "animate-spin" : ""}`} />
                <span>Refresh Data</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMutationModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                title="Buka form input mutasi barang masuk atau keluar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Input Barang Masuk / Keluar</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Produk</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
            Silakan pilih atau tambahkan perusahaan terlebih dahulu.
          </div>
        )}

        {/* Metric Cards */}
        {initialData?.stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Fisik Stok</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                {initialData.stats.totalStockCount} <span className="text-xs font-normal text-slate-500">item fisik</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Seluruh gudang</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Barang Masuk</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2">
                +{initialData.stats.totalInCount || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Riwayat penerimaan</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Barang Keluar</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-rose-700 mt-2">
                -{initialData.stats.totalOutCount || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Riwayat pengeluaran</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Stok Kritis / Menipis</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className={`text-xl sm:text-2xl font-bold mt-2 ${initialData.stats.lowStockCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {initialData.stats.lowStockCount} <span className="text-xs font-normal text-slate-500">perlu restock</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">&le; Batas minimal stok</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Lokasi Gudang</span>
                <Warehouse className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                {initialData.stats.totalWarehouses} <span className="text-xs font-normal text-slate-500">titik</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Gudang & cabang aktif</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "inventory" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Katalog & Stok Barang</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "logs" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Mutasi & Tanggal</span>
          </button>

          {/* TAB 3: CATATAN (Permintaan User: Tambahkan 1 lagi yaitu Catatan) */}
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "notes" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <StickyNote className="w-4 h-4" />
            <span>Catatan</span>
            {(initialData?.notes?.length ?? 0) > 0 && (
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full">
                {initialData?.notes?.length}
              </span>
            )}
          </button>

          {/* TAB 4: INTEGRASI PURCHASING */}
          <button
            type="button"
            onClick={() => setActiveTab("purchasing")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "purchasing" ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Boxes className="w-4 h-4 text-indigo-600" />
            <span>Integrasi Purchasing</span>
            {(initialData?.purchaseOrders?.filter((po: any) => po.status === "APPROVED")?.length ?? 0) > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                {initialData?.purchaseOrders?.filter((po: any) => po.status === "APPROVED")?.length} PO Siap Diterima
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: INVENTORY LIST (Dengan Foto Bukti Timestamp) */}
        {activeTab === "inventory" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* PANEL FILTER LENGKAP: TANGGAL, NAMA BARANG, KODE BARCODE, NAMA PERUSAHAAN */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-xs">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Filter & Pencarian Stok Barang</span>
                      {hasActiveFilters && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                          Filter Aktif
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Saring produk berdasarkan tanggal, nama barang, kode barcode, dan nama perusahaan/retail.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filter</span>
                    </button>
                  )}
                  <div className="text-slate-500 font-medium">
                    Menampilkan <b>{filteredProducts.length}</b> dari {initialData?.products?.length || 0} barang
                  </div>
                </div>
              </div>

              {/* Grid 4 Kolom Filter Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Filter Nama Barang */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Nama Barang</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari nama barang..."
                      value={filterProductName}
                      onChange={(e) => setFilterProductName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-7 py-2 text-xs outline-none focus:border-indigo-500 font-medium shadow-2xs"
                    />
                    {filterProductName && (
                      <button
                        type="button"
                        onClick={() => setFilterProductName("")}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus filter nama barang"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Filter Kode Barcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <BarcodeIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kode Barcode</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setScannerTarget("filterBarcode")}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer bg-indigo-50 px-1.5 py-0.5 rounded"
                      title="Scan Barcode dengan Kamera"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Scan</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik atau scan barcode..."
                      value={filterBarcode}
                      onChange={(e) => setFilterBarcode(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-7 py-2 text-xs outline-none focus:border-indigo-500 font-mono shadow-2xs"
                    />
                    {filterBarcode && (
                      <button
                        type="button"
                        onClick={() => setFilterBarcode("")}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus filter barcode"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Filter Nama Perusahaan / Retail Tempat Pembelian */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Nama Perusahaan / Retail</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Pilih atau ketik PT/Retail..."
                      value={filterCompany}
                      onChange={(e) => setFilterCompany(e.target.value)}
                      list="supplier-filter-list"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-7 py-2 text-xs outline-none focus:border-indigo-500 font-medium shadow-2xs"
                    />
                    <datalist id="supplier-filter-list">
                      {uniqueSuppliers.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    {filterCompany && (
                      <button
                        type="button"
                        onClick={() => setFilterCompany("")}
                        className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus filter perusahaan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Filter Tanggal (Rentang Tanggal & Tipe Tanggal) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Filter Tanggal</span>
                    </label>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setFilterDateType("all")}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          filterDateType === "all"
                            ? "bg-indigo-600 text-white font-bold"
                            : "text-slate-500 hover:text-slate-800 bg-slate-200/60"
                        }`}
                      >
                        Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterDateType("in")}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          filterDateType === "in"
                            ? "bg-emerald-600 text-white font-bold"
                            : "text-slate-500 hover:text-slate-800 bg-slate-200/60"
                        }`}
                      >
                        Masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterDateType("out")}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          filterDateType === "out"
                            ? "bg-rose-600 text-white font-bold"
                            : "text-slate-500 hover:text-slate-800 bg-slate-200/60"
                        }`}
                      >
                        Keluar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500 shadow-2xs font-medium"
                      title="Tanggal Mulai"
                    />
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-indigo-500 shadow-2xs font-medium"
                      title="Tanggal Akhir"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Foto / Bukti</th>
                    <th className="px-4 py-3">Nama Produk & Barcode</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3 bg-emerald-50/40 text-emerald-900">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tanggal Masuk</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 bg-rose-50/40 text-rose-900">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-rose-600" />
                        <span>Tanggal Keluar</span>
                      </div>
                    </th>
                    <th className="px-4 py-3">Tempat Beli (Retail / Maps / WA)</th>
                    <th className="px-4 py-3">Stok Tiap Gudang</th>
                    <th className="px-4 py-3">Total Stok</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p: ProductWithStock) => {
                    const totalQty = p.stocks.reduce((acc, c) => acc + c.quantity, 0);
                    const isLow = totalQty <= p.minStock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          {p.imageUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImageModal({
                                  url: p.imageUrl!,
                                  timestamp: p.imageTimestamp,
                                  title: p.name,
                                })
                              }
                              className="group relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-400"
                            >
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.barcode ? (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                              <BarcodeIcon className="w-3 h-3 text-slate-400" />
                              <span>{p.barcode}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tanpa barcode</span>
                          )}
                          {p.imageTimestamp && (
                            <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-emerald-500" />
                              <span>{p.imageTimestamp}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                            {p.category?.name || "Umum"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-700">
                          <span className="uppercase text-xs bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                            {p.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 bg-emerald-50/20 text-slate-700 font-medium">
                          {formatDate(p.lastInDate)}
                        </td>
                        <td className="px-4 py-3 bg-rose-50/20 text-slate-700 font-medium">
                          {formatDate(p.lastOutDate)}
                        </td>
                        <td className="px-4 py-3 text-xs min-w-[200px]">
                          {p.supplierName ? (
                            <div className="space-y-1">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="truncate max-w-[190px]">{p.supplierName}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                {p.supplierWhatsapp && (
                                  <a
                                    href={`https://wa.me/${p.supplierWhatsapp.replace(/[^0-9]/g, "").startsWith("0") ? "62" + p.supplierWhatsapp.replace(/[^0-9]/g, "").slice(1) : p.supplierWhatsapp.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold transition-colors"
                                    title="Chat WhatsApp"
                                  >
                                    <MessageCircle className="w-3 h-3 text-emerald-600" />
                                    <span>WA: {p.supplierWhatsapp}</span>
                                  </a>
                                )}
                                {p.supplierPhone && (
                                  <a
                                    href={`tel:${p.supplierPhone}`}
                                    className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded transition-colors"
                                    title="Telepon"
                                  >
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    <span>{p.supplierPhone}</span>
                                  </a>
                                )}
                              </div>
                              {p.supplierAddress && (
                                <div className="pt-1 space-y-1.5">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveMapModal({
                                          address: p.supplierAddress!,
                                          name: p.supplierName || p.name,
                                          phone: p.supplierPhone,
                                          whatsapp: p.supplierWhatsapp,
                                        })
                                      }
                                      className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs cursor-pointer group flex-1 text-left"
                                      title="Klik untuk membuka peta ukuran penuh"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform shrink-0" />
                                      <span className="truncate max-w-[110px]">{p.supplierAddress}</span>
                                      <span className="ml-auto text-[10px] bg-rose-200 text-rose-900 px-1 py-0.2 rounded font-bold shrink-0">
                                        Peta 🗺️
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedMapProductId(expandedMapProductId === p.id ? null : p.id)
                                      }
                                      className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer shrink-0 ${
                                        expandedMapProductId === p.id
                                          ? "bg-slate-900 text-white border-slate-900"
                                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                                      }`}
                                      title={expandedMapProductId === p.id ? "Tutup preview peta di tabel" : "Lihat peta langsung di tabel"}
                                    >
                                      {expandedMapProductId === p.id ? "Tutup" : "Lihat"}
                                    </button>
                                  </div>

                                  {/* Peta Tampil Langsung di Tabel jika Di-Expand */}
                                  {expandedMapProductId === p.id && (
                                    <div className="pt-1 min-w-[240px]">
                                      <LocationMapEmbed
                                        address={p.supplierAddress}
                                        name={p.supplierName || p.name}
                                        height="160px"
                                        onOpenModal={() =>
                                          setActiveMapModal({
                                            address: p.supplierAddress!,
                                            name: p.supplierName || p.name,
                                            phone: p.supplierPhone,
                                            whatsapp: p.supplierWhatsapp,
                                          })
                                        }
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Belum diisi</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {p.stocks.length === 0 ? (
                              <span className="text-slate-400 text-xs">Kosong</span>
                            ) : (
                              p.stocks.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700"
                                >
                                  {s.warehouse.code}: <b>{s.quantity}</b> {p.unit}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {totalQty} <span className="text-xs font-normal text-slate-500">{p.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> Stok Menipis (&le;{p.minStock})
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setMutationForm((prev) => ({
                                ...prev,
                                productId: p.id,
                                unit: p.unit,
                                type: "IN",
                              }));
                              setShowMutationModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-transparent transition-all shadow-xs cursor-pointer active:scale-95"
                            title="Input Barang Masuk atau Keluar untuk produk ini"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>+ / - Mutasi</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-400 text-sm">
                        Tidak ada barang yang cocok dengan pencarian Anda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: INPUT BARANG MASUK / KELUAR (Dengan Upload Gambar Timestamp) */}
        {activeTab === "mutation" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                Input Barang Masuk & Keluar
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Catat tanggal dan kuantitas barang masuk atau keluar. Label input akan otomatis berganti mengikuti satuan yang Anda pilih.
              </p>

              <form onSubmit={handleMutationSubmit} className="space-y-4">
                {/* Tipe Transaksi */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">Tipe Transaksi</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMutationForm({ ...mutationForm, type: "IN" })}
                      className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        mutationForm.type === "IN"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      <span>Barang Masuk (IN)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMutationForm({ ...mutationForm, type: "OUT" })}
                      className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        mutationForm.type === "OUT"
                          ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      <span>Barang Keluar (OUT)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMutationForm({ ...mutationForm, type: "ADJUSTMENT" })}
                      className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        mutationForm.type === "ADJUSTMENT"
                          ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <History className="w-4 h-4 text-amber-600" />
                      <span>Stock Opname</span>
                    </button>
                  </div>
                </div>

                {/* Pilih Produk & Auto-Detect Barcode Scanner */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Pilih Produk *</label>
                    <button
                      type="button"
                      onClick={() => setScannerTarget("mutation")}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Auto-Detect Barcode (Scan Kamera)</span>
                    </button>
                  </div>
                  <select
                    value={mutationForm.productId || initialData?.products?.[0]?.id || ""}
                    onChange={(e) => setMutationForm({ ...mutationForm, productId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                    required
                  >
                    {(initialData?.products || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.barcode ? `[Barcode: ${p.barcode}]` : ""} (Default: {p.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kolom Tanggal Masuk / Keluar Produk */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {mutationForm.type === "IN" ? "Kolom Tanggal Masuk Produk *" : mutationForm.type === "OUT" ? "Kolom Tanggal Keluar Produk *" : "Tanggal Opname *"}
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        value={mutationForm.date}
                        onChange={(e) => setMutationForm({ ...mutationForm, date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gudang / Lokasi *</label>
                    <select
                      value={mutationForm.warehouseId || initialData?.warehouses?.[0]?.id || ""}
                      onChange={(e) => setMutationForm({ ...mutationForm, warehouseId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                      required
                    >
                      {(initialData?.warehouses || []).map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PILIHAN SATUAN & KOLOM BERAPA BANYAK BARANG */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Pilih Satuan {mutationForm.type === "IN" ? "Barang Masuk" : mutationForm.type === "OUT" ? "Barang Keluar" : "Opname"}
                      </label>
                      <select
                        value={mutationForm.unit}
                        onChange={(e) => setMutationForm({ ...mutationForm, unit: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-semibold text-indigo-700 cursor-pointer"
                      >
                        {ALL_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label} [{u.category}]
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        Pilih satuan untuk mengubah kolom kuantitas di samping secara otomatis.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        {mutationForm.type === "IN"
                          ? `Berapa banyak barang yang masuk (${mutationForm.unit}) *`
                          : mutationForm.type === "OUT"
                          ? `Berapa banyak barang yang keluar (${mutationForm.unit}) *`
                          : `Hasil hitungan fisik aktual (${mutationForm.unit}) *`}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={mutationForm.quantity}
                          onChange={(e) => setMutationForm({ ...mutationForm, quantity: Number(e.target.value) })}
                          placeholder={`Masukkan jumlah dalam ${mutationForm.unit}`}
                          className="w-full bg-white border-2 border-indigo-500 rounded-lg pl-3 pr-16 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
                          required
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                          {mutationForm.unit}
                        </span>
                      </div>
                      <span className="text-[11px] text-indigo-600 mt-0.5 block font-medium">
                        ✓ Kolom otomatis disesuaikan menjadi: <b>{mutationForm.unit}</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* UPLOAD FOTO BUKTI DENGAN DETEKSI TANGGAL, JAM, MENIT (WAJIB UNTUK IN & OUT) */}
                <ImageTimestampUploader
                  label={
                    mutationForm.type === "IN"
                      ? "Foto Bukti Fisik Barang Masuk / Surat Jalan"
                      : mutationForm.type === "OUT"
                      ? "Foto Bukti Fisik Barang Keluar / Pengeluaran"
                      : "Foto Bukti Fisik Opname"
                  }
                  required={mutationForm.type === "IN" || mutationForm.type === "OUT"}
                  onImageVerified={(data) => {
                    setMutationForm((prev) => ({
                      ...prev,
                      imageUrl: data?.imageUrl || "",
                      imageTimestamp: data?.timestamp || "",
                    }));
                  }}
                />

                {/* INFORMASI PERUSAHAAN / RETAIL TEMPAT PEMBELIAN (JIKA BARANG MASUK) */}
                {mutationForm.type === "IN" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Store className="w-4 h-4 text-indigo-600" />
                      <span>Informasi Perusahaan / Retail Tempat Pembelian (Barang Masuk)</span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nama Perusahaan atau Retail Tempat Pembelian
                        </label>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          Auto-Detect Aktif
                        </span>
                      </div>
                      <div className="relative">
                        <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          list="known-suppliers-datalist"
                          placeholder="Ketik / pilih nama perusahaan (HP, WA & Alamat akan terisi otomatis)..."
                          value={mutationForm.supplierName}
                          onChange={(e) => handleSupplierNameChangeInMutation(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>

                      {/* Indikator Jika Perusahaan Terdeteksi */}
                      {mutationSupplierMatch && (
                        <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[11px] animate-fadeIn">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Perusahaan Terdeteksi:</strong> Nomor HP, WhatsApp, dan Alamat terisi otomatis.
                          </span>
                        </div>
                      )}

                      {/* Rekomendasi jika sebagian nama cocok */}
                      {mutationPartialSuggestions.length > 0 && (
                        <div className="mt-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs space-y-1">
                          <span className="text-[11px] font-semibold text-indigo-800 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Ditemukan perusahaan tersimpan yang cocok:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {mutationPartialSuggestions.map((s) => (
                              <button
                                key={s.name}
                                type="button"
                                onClick={() => applyKnownSupplierToMutation(s)}
                                className="text-[11px] bg-white border border-indigo-300 hover:bg-indigo-600 hover:text-white text-indigo-700 px-2.5 py-1 rounded-md transition font-medium cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <span>⚡ Isi Otomatis: {s.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Chips Perusahaan Tersimpan (Quick Select) */}
                      {knownSuppliers.length > 0 && !mutationSupplierMatch && mutationPartialSuggestions.length === 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                          <span className="text-[10px] text-slate-400">Pilih Cepat:</span>
                          {knownSuppliers.slice(0, 4).map((s) => (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => applyKnownSupplierToMutation(s)}
                              className="bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-slate-600 truncate max-w-[170px]"
                              title={`${s.name} (HP: ${s.phone || '-'}, Alamat: ${s.address || '-'})`}
                            >
                              + {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nomor Handphone
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                          <input
                            type="tel"
                            placeholder="Contoh: 0812-3456-7890"
                            value={mutationForm.supplierPhone}
                            onChange={(e) => setMutationForm({ ...mutationForm, supplierPhone: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Nomor WhatsApp
                          </label>
                          {mutationForm.supplierPhone && (
                            <button
                              type="button"
                              onClick={() => setMutationForm({ ...mutationForm, supplierWhatsapp: mutationForm.supplierPhone })}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                            >
                              Samakan dengan HP
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <MessageCircle className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500 pointer-events-none" />
                          <input
                            type="tel"
                            placeholder="Contoh: 0812-3456-7890"
                            value={mutationForm.supplierWhatsapp}
                            onChange={(e) => setMutationForm({ ...mutationForm, supplierWhatsapp: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-rose-500 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Alamat lengkap (contoh: Jl. Gajah Mada No. 45 Jakarta) ATAU link Google Maps"
                          value={mutationForm.supplierAddress}
                          onChange={(e) => setMutationForm({ ...mutationForm, supplierAddress: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                      {/* Preview Peta Langsung saat Mengisi Form */}
                      {mutationForm.supplierAddress && mutationForm.supplierAddress.trim().length > 2 && (
                        <div className="pt-2">
                          <span className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            <span>Peta Lokasi Pembelian (Tampil Otomatis):</span>
                          </span>
                          <LocationMapEmbed
                            address={mutationForm.supplierAddress}
                            name={mutationForm.supplierName}
                            height="180px"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">No. Surat Jalan / Bukti Referensi</label>
                    <input
                      type="text"
                      placeholder="Contoh: SJ-2026-001, PO-990"
                      value={mutationForm.referenceNumber}
                      onChange={(e) => setMutationForm({ ...mutationForm, referenceNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Petugas / Operator</label>
                    <input
                      type="text"
                      value={mutationForm.performedBy}
                      onChange={(e) => setMutationForm({ ...mutationForm, performedBy: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Kondisi barang baik, diterima di pintu loading dock B"
                    value={mutationForm.notes}
                    onChange={(e) => setMutationForm({ ...mutationForm, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                {(mutationForm.type === "IN" || mutationForm.type === "OUT") && (!mutationForm.imageUrl || !mutationForm.imageTimestamp) && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <b>Foto Bukti Wajib:</b> Transaksi barang {mutationForm.type === "IN" ? "masuk" : "keluar"} wajib melampirkan foto yang memuat tanggal, jam, dan menit di atas.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Simpan {mutationForm.type === "IN" ? "Barang Masuk" : mutationForm.type === "OUT" ? "Barang Keluar" : "Opname"} ({mutationForm.quantity} {mutationForm.unit})
                  </span>
                </button>
              </form>
            </div>

            {/* Panduan Cepat Satuan, Barcode & Deteksi Waktu */}
            <div className="bg-indigo-50/60 p-6 rounded-xl border border-indigo-100 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-indigo-950 text-sm mb-2">Panduan Sistem Deteksi Waktu Gambar</h3>
                <ul className="text-xs text-indigo-900/80 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-indigo-700">🔍 Cara Deteksi Timestamp:</span>
                    <span>Sistem menggunakan 2 lapis deteksi otomatis:
                      <br />1. <b>Visual OCR:</b> Membaca teks stempel visual (seperti hasil aplikasi GPS Map Camera atau CCTV) dengan pola <i>Tanggal + Jam:Menit:Detik</i>.
                      <br />2. <b>Metadata EXIF:</b> Membaca waktu jepretan asli internal file foto dari kamera smartphone.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-600">✨ Watermark Otomatis:</span>
                    <span>Jika foto biasa tidak memiliki stempel waktu, tombol <i>"Beri Stempel Waktu Otomatis"</i> akan langsung mencetak stempel tanggal, jam, menit, dan detik resmi ke atas foto secara permanen.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-purple-700">📷 Auto-Detect Barcode:</span>
                    <span>Gunakan kamera HP/laptop untuk scan kode barcode produk dalam sekejap.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-indigo-200/60 text-xs text-indigo-900">
                🔒 <b>Audit Trail Valid:</b> Seluruh foto yang tersimpan memiliki bukti waktu transaksi otentik hingga ke detik.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WAREHOUSES */}
        {activeTab === "warehouses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Lokasi Gudang & Titik Distribusi</h2>
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Gudang / Cabang</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(initialData?.warehouses || []).map((w: WarehouseItem) => (
                <div key={w.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
                  {w.isPrimary && (
                    <span className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Gudang Utama
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-lg">
                      <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{w.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">Kode: {w.code}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    📍 {w.location || "Lokasi spesifik belum diatur"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: STOCK TRANSACTION LOGS (Dengan Foto Bukti & Tanggal) */}
        {activeTab === "logs" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Riwayat Mutasi & Bukti Foto Terverifikasi</h2>
              <p className="text-xs text-slate-500">Mencakup tanggal transaksi, kuantitas, satuan, dan bukti foto bertimestamp.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Bukti Foto</th>
                    <th className="px-4 py-3">Tanggal Mutasi</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3">Nama Produk</th>
                    <th className="px-4 py-3">Gudang</th>
                    <th className="px-4 py-3">Berapa Banyak (Kuantitas)</th>
                    <th className="px-4 py-3">No. Bukti / Referensi</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(initialData?.transactions || []).map((t: TransactionItem) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        {t.imageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImageModal({
                                url: t.imageUrl!,
                                timestamp: t.imageTimestamp,
                                title: `Bukti Mutasi: ${t.product.name} (${t.type})`,
                              })
                            }
                            className="group relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer shadow-sm hover:ring-2 hover:ring-indigo-400"
                          >
                            <img src={t.imageUrl} alt="Bukti" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        <div>{formatDate(t.date || t.createdAt)}</div>
                        {t.imageTimestamp && (
                          <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-emerald-500" />
                            <span>{t.imageTimestamp}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.type === "IN" ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                            <ArrowDownLeft className="w-3 h-3" /> MASUK (IN)
                          </span>
                        ) : t.type === "OUT" ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                            <ArrowUpRight className="w-3 h-3" /> KELUAR (OUT)
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 w-max">
                            <History className="w-3 h-3" /> OPNAME
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{t.product.name}</div>
                        {t.product.barcode && (
                          <div className="text-[11px] text-slate-400 font-mono">Barcode: {t.product.barcode}</div>
                        )}
                        {t.supplierName && (
                          <div className="text-[11px] text-indigo-700 font-medium flex items-center gap-1 mt-0.5">
                            <Store className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>Beli di: {t.supplierName}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {t.warehouse.name}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <span className={t.quantity > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {t.quantity > 0 ? `+${t.quantity}` : t.quantity} {t.unit || t.product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-slate-800">{t.referenceNumber || "-"}</div>
                        <div className="text-slate-400">{t.notes || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {t.performedBy || "Sistem"}
                      </td>
                    </tr>
                  ))}
                  {(!initialData?.transactions || initialData.transactions.length === 0) && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                        Belum ada catatan mutasi barang masuk atau keluar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CATATAN GUDANG & MEMO INTERNAL */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            {/* Header Catatan & Tombol Tambah */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <StickyNote className="w-5 h-5 text-indigo-600" />
                  <span>Catatan & Memo Internal Gudang</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instruksi operasional, serah terima shift, catatan vendor, dan pengumuman untuk seluruh tim {initialData?.company?.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddNoteModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Buat Catatan Baru</span>
              </button>
            </div>

            {/* Filter Kategori & Pencarian Catatan */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {[
                  { id: "all", label: "Semua Kategori" },
                  { id: "Operasional", label: "📦 Operasional" },
                  { id: "Penting", label: "🔥 Penting / Urgent" },
                  { id: "Shift", label: "🔄 Serah Terima Shift" },
                  { id: "Supplier", label: "🏬 Supplier / Vendor" },
                  { id: "Umum", label: "📌 Catatan Umum" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setNoteFilterCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      noteFilterCategory === cat.id
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari judul atau isi catatan..."
                  value={noteSearchQuery}
                  onChange={(e) => setNoteSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* Grid Daftar Catatan */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note: NoteItem) => {
                const isUrgent = note.priority === "URGENT" || note.category === "Penting";
                const createdDate = new Date(note.createdAt).toLocaleString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={note.id}
                    className={`bg-white rounded-2xl p-5 border shadow-sm transition-all duration-200 flex flex-col justify-between relative group hover:shadow-md ${
                      note.isPinned
                        ? "border-amber-300 ring-2 ring-amber-100/80 bg-amber-50/20"
                        : isUrgent
                        ? "border-rose-200 bg-rose-50/15"
                        : "border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Baris Badge & Pin Toggle */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {note.isPinned && (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                              <Pin className="w-3 h-3 fill-amber-700 text-amber-700" />
                              <span>Disematkan</span>
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              note.category === "Penting"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : note.category === "Operasional"
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                : note.category === "Shift"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : note.category === "Supplier"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                            }`}
                          >
                            {note.category}
                          </span>

                          {isUrgent && (
                            <span className="text-[10px] font-extrabold bg-rose-600 text-white px-1.5 py-0.2 rounded uppercase tracking-wider">
                              Urgent
                            </span>
                          )}
                        </div>

                        {/* Aksi Pin & Hapus */}
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(note.id, note.isPinned)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              note.isPinned
                                ? "text-amber-600 hover:bg-amber-100"
                                : "text-slate-400 hover:text-amber-600 hover:bg-slate-100"
                            }`}
                            title={note.isPinned ? "Lepas sematan" : "Sematkan di atas"}
                          >
                            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? "fill-amber-600" : ""}`} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Judul & Isi Catatan */}
                      <h3 className="font-bold text-slate-900 text-sm mb-2 leading-snug">
                        {note.title}
                      </h3>
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed line-clamp-6">
                        {note.content}
                      </p>
                    </div>

                    {/* Footer Info: Penulis & Waktu */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-600">✍️ {note.author}</span>
                      <span>{createdDate}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredNotes.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <StickyNote className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1">Belum Ada Catatan</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Gunakan tab Catatan ini untuk mencatat instruksi bongkar muat, pesan shift berikutnya, memo vendor, atau peringatan operasional.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddNoteModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Catatan Pertama</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HUB INTEGRASI DENGAN PROJECT PURCHASING */}
        {activeTab === "purchasing" && (
          <div className="space-y-6">
            {/* Header Status Koneksi & API Endpoint */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-900/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <span className="text-xs uppercase tracking-wider font-bold text-indigo-300">
                      Integrasi Multi-Project
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      REST API Ready & Terhubung
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                    Hub Integrasi Sistem Gudang ⇄ Project Purchasing
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Sistem ini terhubung secara native dengan project Purchasing. Anda dapat menerima Purchase Order (PO) masuk langsung ke stok gudang, atau mengirimkan Permintaan Pengadaan (PR) saat stok barang menipis.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCreatePoModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Terbitkan PO dari Purchasing</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoSubmitPRFromLowStock}
                    disabled={lowStockProducts.length === 0}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>⚡ Kirim PR Otomatis ({lowStockProducts.length} Barang Menipis)</span>
                  </button>
                </div>
              </div>

              {/* Endpoint URL Box */}
              <div className="mt-5 pt-4 border-t border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-xl border border-indigo-500/20">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-slate-400 font-medium shrink-0">Endpoint API Purchasing:</span>
                  <code className="text-emerald-400 font-mono text-[11px] truncate">
                    http://localhost:3000/api/integration/purchasing
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("http://localhost:3000/api/integration/purchasing");
                    setCopiedApiUrl(true);
                    showMessage("success", "URL Endpoint Integrasi Purchasing berhasil disalin!");
                    setTimeout(() => setCopiedApiUrl(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  {copiedApiUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedApiUrl ? "Tersalin ke Clipboard!" : "Salin URL Endpoint"}</span>
                </button>
              </div>
            </div>

            {/* Dua Kolom: PO Masuk & PR Pengadaan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* KOLOM 1: PURCHASE ORDERS (PO) DARI PURCHASING */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Purchase Orders (PO) Masuk dari Purchasing
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Pesanan barang dari tim Purchasing yang siap diterima ke stok gudang
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                    {initialData?.purchaseOrders?.length ?? 0} PO
                  </span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {(initialData?.purchaseOrders || []).map((po: any) => {
                    const items = JSON.parse(po.itemsJson || "[]");
                    const isReceived = po.status === "RECEIVED";

                    return (
                      <div
                        key={po.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isReceived
                            ? "bg-slate-50/60 border-slate-200"
                            : "bg-white border-amber-300 shadow-xs ring-1 ring-amber-200/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                {po.poNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isReceived
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                }`}
                              >
                                {isReceived ? "✓ Telah Diterima Gudang" : "⏳ Siap Diterima Gudang"}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 mt-1">
                              Vendor: {po.supplierName}
                            </h4>
                            {po.supplierPhone && (
                              <p className="text-[10px] text-slate-500">📞 {po.supplierPhone}</p>
                            )}
                          </div>

                          {!isReceived && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPoForReceive(po);
                                setReceivePoWarehouseId(initialData?.warehouses?.[0]?.id || "");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Terima Barang</span>
                            </button>
                          )}
                        </div>

                        {/* List Items in PO */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1 text-xs">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                            Daftar Barang Pesanan:
                          </span>
                          {items.map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-slate-800 truncate max-w-[200px]">
                                • {it.productName}
                              </span>
                              <span className="font-bold text-indigo-700">
                                {it.quantity} {it.unit}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Footer status receipt */}
                        {isReceived ? (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Diterima oleh: <b>{po.receivedBy || "-"}</b></span>
                            <span>{formatDate(po.receivedAt)}</span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-2 italic">
                            Catatan: {po.notes || "Belum ada catatan."}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {(initialData?.purchaseOrders?.length ?? 0) === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Belum ada Purchase Order dari sistem Purchasing.
                    </div>
                  )}
                </div>
              </div>

              {/* KOLOM 2: PURCHASE REQUISITION (PR) DARI GUDANG */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Permintaan Pengadaan (PR) ke Purchasing
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Pengajuan restock barang dari gudang yang dikirim ke tim Purchasing
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                    {initialData?.purchaseRequisitions?.length ?? 0} PR
                  </span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {(initialData?.purchaseRequisitions || []).map((pr: any) => {
                    const items = JSON.parse(pr.itemsJson || "[]");

                    return (
                      <div key={pr.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              {pr.prNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                pr.urgency === "CRITICAL"
                                  ? "bg-rose-100 text-rose-800"
                                  : pr.urgency === "URGENT"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {pr.urgency}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            Status: {pr.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          {items.map((it: any, idx: number) => (
                            <div key={idx} className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-800 block">{it.productName}</span>
                                <span className="text-[10px] text-slate-400">
                                  Sisa Stok: {it.currentStock} {it.unit} (Min: {it.minStock} {it.unit})
                                </span>
                              </div>
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                Minta: +{it.requestedQty} {it.unit}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Diajukan oleh: <b>{pr.requestedBy}</b></span>
                          <span>{formatDate(pr.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {(initialData?.purchaseRequisitions?.length ?? 0) === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Belum ada Permintaan Pengadaan (PR) yang diajukan ke Purchasing.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panduan & Dokumentasi Arsitektur untuk Membangun Project Purchasing */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Dokumentasi REST API & Panduan Membangun Project Purchasing
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gunakan endpoint di bawah ini saat Anda membuat project Purchasing (misal di folder terpisah atau port 3001)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-mono font-bold text-indigo-700">
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">GET</span>
                    <span>/api/integration/purchasing/low-stock</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Digunakan oleh Project Purchasing untuk mendeteksi barang apa saja yang stoknya menipis di gudang, sehingga otomatis memicu pembuatan Purchase Order (PO).
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-mono font-bold text-indigo-700">
                    <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[10px]">POST</span>
                    <span>/api/integration/purchasing/orders</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Project Purchasing mengirim Purchase Order (PO) yang telah disetujui agar langsung tampil di sistem Gudang sebagai barang yang akan tiba.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-mono font-bold text-indigo-700">
                    <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[10px]">POST</span>
                    <span>/api/integration/purchasing/receive</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Ketika barang fisik tiba, memanggil endpoint ini otomatis menambah saldo stok gudang dan mencatat mutasi barang masuk lengkap dengan foto & timestamp.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 font-mono font-bold text-indigo-700">
                    <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">GET</span>
                    <span>/api/integration/purchasing/products</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Mengambil seluruh katalog produk, satuan, barcode, dan data pemasok / supplier yang terdaftar di sistem gudang.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: TAMBAH PRODUK KE KATALOG DENGAN UPLOAD FOTO TIMESTAMP */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">Tambah Produk ke Katalog</h2>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan produk baru untuk {initialData?.company?.name}.
            </p>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  placeholder="Contoh: Laptop ThinkPad T14 Gen 4, Semen Gresik 50kg, dll."
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Barcode dengan Auto-Detect Perangkat */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Kode Barcode</label>
                  <button
                    type="button"
                    onClick={() => setScannerTarget("newProduct")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Auto-Detect (Scan Kamera)</span>
                  </button>
                </div>
                <div className="relative">
                  <BarcodeIcon className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ketik manual atau klik 'Auto-Detect' untuk scan kamera"
                    value={newProductForm.barcode}
                    onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Pilihan Satuan Lengkap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan Produk *</label>
                  <select
                    value={newProductForm.unit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-semibold text-indigo-700 cursor-pointer"
                  >
                    {ALL_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                    <option value="lainnya">+ Satuan Lainnya (Ketik Manual)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batas Minimal Stok (Alert)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.minStock}
                    onChange={(e) => setNewProductForm({ ...newProductForm, minStock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {newProductForm.unit === "lainnya" && (
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 mb-1">Ketik Nama Satuan Khusus Anda</label>
                  <input
                    type="text"
                    placeholder="Contoh: bundle, tabung, bal, jerigen"
                    value={newProductForm.customUnit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, customUnit: e.target.value })}
                    className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              {/* Upload Foto Produk dengan Deteksi Waktu (Wajib Jika Ada Stok Masuk Awal) */}
              <ImageTimestampUploader
                label="Foto Produk / Bukti Fisik Barang Masuk"
                required={Number(newProductForm.initialStock) > 0}
                onImageVerified={(data) => {
                  setNewProductForm((prev) => ({
                    ...prev,
                    imageUrl: data?.imageUrl || "",
                    imageTimestamp: data?.timestamp || "",
                  }));
                }}
              />

              {/* INFORMASI TEMPAT PEMBELIAN (PERUSAHAAN / RETAIL / SUPPLIER) */}
              <div className="border-t border-slate-100 pt-3 space-y-3 bg-slate-50 p-4 rounded-xl border">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>Informasi Tempat Pembelian (Perusahaan / Retail / Toko)</span>
                </div>

                {/* Kolom 1: Nama Perusahaan atau Retail Tempat Pembelian */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Perusahaan atau Retail Tempat Pembelian
                    </label>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      Auto-Detect Aktif
                    </span>
                  </div>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      list="known-suppliers-datalist"
                      placeholder="Ketik / pilih nama perusahaan (HP, WA & Alamat akan terisi otomatis)..."
                      value={newProductForm.supplierName}
                      onChange={(e) => handleSupplierNameChangeInNewProduct(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  {/* Indikator Jika Perusahaan Terdeteksi */}
                  {newProdSupplierMatch && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[11px] animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Perusahaan Terdeteksi:</strong> Nomor HP, WhatsApp, dan Alamat terisi otomatis.
                      </span>
                    </div>
                  )}

                  {/* Rekomendasi jika sebagian nama cocok */}
                  {newProdPartialSuggestions.length > 0 && (
                    <div className="mt-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs space-y-1">
                      <span className="text-[11px] font-semibold text-indigo-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Ditemukan perusahaan tersimpan yang cocok:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {newProdPartialSuggestions.map((s) => (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => applyKnownSupplierToNewProduct(s)}
                            className="text-[11px] bg-white border border-indigo-300 hover:bg-indigo-600 hover:text-white text-indigo-700 px-2.5 py-1 rounded-md transition font-medium cursor-pointer shadow-sm flex items-center gap-1"
                          >
                            <span>⚡ Isi Otomatis: {s.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chips Perusahaan Tersimpan (Quick Select) */}
                  {knownSuppliers.length > 0 && !newProdSupplierMatch && newProdPartialSuggestions.length === 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <span className="text-[10px] text-slate-400">Pilih Cepat:</span>
                      {knownSuppliers.slice(0, 4).map((s) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => applyKnownSupplierToNewProduct(s)}
                          className="bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-slate-600 truncate max-w-[170px]"
                          title={`${s.name} (HP: ${s.phone || '-'}, Alamat: ${s.address || '-'})`}
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Kolom 2: Nomor Handphone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Handphone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="Contoh: 0812-3456-7890"
                        value={newProductForm.supplierPhone}
                        onChange={(e) => setNewProductForm({ ...newProductForm, supplierPhone: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Kolom 3: Nomor WhatsApp */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nomor WhatsApp
                      </label>
                      {newProductForm.supplierPhone && (
                        <button
                          type="button"
                          onClick={() => setNewProductForm({ ...newProductForm, supplierWhatsapp: newProductForm.supplierPhone })}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                        >
                          Samakan dengan HP
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <MessageCircle className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500 pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="Contoh: 0812-3456-7890 (Bisa langsung WA)"
                        value={newProductForm.supplierWhatsapp}
                        onChange={(e) => setNewProductForm({ ...newProductForm, supplierWhatsapp: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Kolom 4: Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-rose-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Alamat lengkap (contoh: Jl. Sudirman No. 10 Jakarta) ATAU link Google Maps (https://maps.app.goo.gl/...)"
                      value={newProductForm.supplierAddress}
                      onChange={(e) => setNewProductForm({ ...newProductForm, supplierAddress: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Ketik alamat fisik toko/retail atau tempelkan tautan Google Maps untuk navigasi instan.
                  </span>

                  {/* Preview Peta Langsung saat Mengetik Alamat / Link */}
                  {newProductForm.supplierAddress && newProductForm.supplierAddress.trim().length > 2 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>Peta Lokasi Toko / Retail (Tampil Otomatis):</span>
                      </span>
                      <LocationMapEmbed
                        address={newProductForm.supplierAddress}
                        name={newProductForm.supplierName || newProductForm.name}
                        height="180px"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Stok Awal & Tanggal Masuk Produk */}
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <span className="block text-xs font-bold text-slate-800">Stok Awal Saat Pendaftaran (Opsional)</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Kolom Tanggal Masuk Produk</label>
                    <input
                      type="date"
                      value={newProductForm.initialStockDate}
                      onChange={(e) => setNewProductForm({ ...newProductForm, initialStockDate: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Gudang Penyimpanan</label>
                    <select
                      value={newProductForm.warehouseId}
                      onChange={(e) => setNewProductForm({ ...newProductForm, warehouseId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {(initialData?.warehouses || []).map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Kolom Berapa Banyak Barang Yang Masuk */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    Berapa banyak barang yang masuk ({newProductForm.unit === "lainnya" ? newProductForm.customUnit || "unit" : newProductForm.unit})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={newProductForm.initialStock}
                      onChange={(e) => setNewProductForm({ ...newProductForm, initialStock: Number(e.target.value) })}
                      placeholder={`Jumlah barang masuk (${newProductForm.unit})`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-16 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold uppercase text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                      {newProductForm.unit === "lainnya" ? newProductForm.customUnit || "unit" : newProductForm.unit}
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-600 mt-0.5 block">
                    ✓ Kolom otomatis disesuaikan menjadi satuan: <b>{newProductForm.unit === "lainnya" ? newProductForm.customUnit || "unit" : newProductForm.unit}</b>
                  </span>
                </div>
              </div>

              <div className="pt-2">
                {Number(newProductForm.initialStock) > 0 && (!newProductForm.imageUrl || !newProductForm.imageTimestamp) && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium mb-3">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <b>Foto Bukti Wajib:</b> Karena Anda mengisi kuantitas barang masuk awal ({newProductForm.initialStock} {newProductForm.unit}), wajib unggah foto berstempel tanggal dan jam:menit.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md cursor-pointer"
                >
                  Simpan Produk Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INPUT BARANG MASUK / KELUAR (TOMBOL ACTION MODAL) */}
      {showMutationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowMutationModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Input Barang Masuk / Keluar</h2>
                <p className="text-xs text-slate-500">
                  Catat mutasi barang masuk atau keluar dengan tanggal, satuan dinamis, foto bukti ber-timestamp, dan supplier/retail.
                </p>
              </div>
            </div>

            <form onSubmit={handleMutationSubmit} className="space-y-4 mt-4">
              {/* Tipe Transaksi */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Tipe Transaksi</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMutationForm({ ...mutationForm, type: "IN" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      mutationForm.type === "IN"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>Barang Masuk (IN)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMutationForm({ ...mutationForm, type: "OUT" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      mutationForm.type === "OUT"
                        ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Barang Keluar (OUT)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMutationForm({ ...mutationForm, type: "ADJUSTMENT" })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      mutationForm.type === "ADJUSTMENT"
                        ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <History className="w-4 h-4 text-amber-600" />
                    <span>Stock Opname</span>
                  </button>
                </div>
              </div>

              {/* Pilih Produk & Auto-Detect Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Pilih Produk *</label>
                  <button
                    type="button"
                    onClick={() => setScannerTarget("mutation")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Auto-Detect Barcode (Scan Kamera)</span>
                  </button>
                </div>
                <select
                  value={mutationForm.productId || initialData?.products?.[0]?.id || ""}
                  onChange={(e) => {
                    const selProd = (initialData?.products || []).find((p: any) => p.id === e.target.value);
                    setMutationForm({
                      ...mutationForm,
                      productId: e.target.value,
                      unit: selProd?.unit || mutationForm.unit,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  required
                >
                  {(initialData?.products || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.barcode ? `[Barcode: ${p.barcode}]` : ""} (Default: {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Kolom Tanggal Masuk / Keluar Produk & Gudang */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {mutationForm.type === "IN" ? "Kolom Tanggal Masuk Produk *" : mutationForm.type === "OUT" ? "Kolom Tanggal Keluar Produk *" : "Tanggal Opname *"}
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      value={mutationForm.date}
                      onChange={(e) => setMutationForm({ ...mutationForm, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gudang Penyimpanan *</label>
                  <select
                    value={mutationForm.warehouseId || initialData?.warehouses?.[0]?.id || ""}
                    onChange={(e) => setMutationForm({ ...mutationForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                    required
                  >
                    {(initialData?.warehouses || []).map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Satuan Dinamis & Berapa Banyak Barang */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Pilih Satuan {mutationForm.type === "IN" ? "Barang Masuk" : mutationForm.type === "OUT" ? "Barang Keluar" : "Opname"}
                    </label>
                    <select
                      value={mutationForm.unit}
                      onChange={(e) => setMutationForm({ ...mutationForm, unit: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-semibold text-indigo-700 cursor-pointer"
                    >
                      {ALL_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label} [{u.category}]
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Otomatis mengubah label kuantitas di samping.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      {mutationForm.type === "IN"
                        ? `Berapa banyak barang yang masuk (${mutationForm.unit}) *`
                        : mutationForm.type === "OUT"
                        ? `Berapa banyak barang yang keluar (${mutationForm.unit}) *`
                        : `Hasil hitungan fisik aktual (${mutationForm.unit}) *`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={mutationForm.quantity}
                        onChange={(e) => setMutationForm({ ...mutationForm, quantity: Number(e.target.value) })}
                        placeholder={`Jumlah dalam ${mutationForm.unit}`}
                        className="w-full bg-white border-2 border-indigo-500 rounded-lg pl-3 pr-16 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-300 shadow-xs"
                        required
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {mutationForm.unit}
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-600 mt-0.5 block font-medium">
                      ✓ Kolom otomatis disesuaikan menjadi: <b>{mutationForm.unit}</b>
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload Foto Bukti dengan Timestamp (Wajib untuk Barang Masuk & Keluar) */}
              <ImageTimestampUploader
                label={
                  mutationForm.type === "IN"
                    ? "Foto Bukti Fisik Barang Masuk / Surat Jalan"
                    : mutationForm.type === "OUT"
                    ? "Foto Bukti Fisik Barang Keluar / Pengeluaran"
                    : "Foto Bukti Fisik Stock Opname"
                }
                required={mutationForm.type === "IN" || mutationForm.type === "OUT"}
                onImageVerified={(data) => {
                  setMutationForm((prev) => ({
                    ...prev,
                    imageUrl: data?.imageUrl || "",
                    imageTimestamp: data?.timestamp || "",
                  }));
                }}
              />

              {/* Informasi Supplier / Retail jika IN */}
              {mutationForm.type === "IN" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Store className="w-4 h-4 text-indigo-600" />
                    <span>Informasi Tempat Pembelian (Perusahaan / Retail)</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nama Perusahaan atau Retail Tempat Pembelian
                      </label>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        Auto-Detect Aktif
                      </span>
                    </div>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        list="known-suppliers-datalist"
                        placeholder="Ketik / pilih nama perusahaan (HP, WA & Alamat akan terisi otomatis)..."
                        value={mutationForm.supplierName}
                        onChange={(e) => handleSupplierNameChangeInMutation(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>

                    {/* Indikator Jika Perusahaan Terdeteksi */}
                    {mutationSupplierMatch && (
                      <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[11px] animate-fadeIn">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Perusahaan Terdeteksi:</strong> Nomor HP, WhatsApp, dan Alamat terisi otomatis.
                        </span>
                      </div>
                    )}

                    {/* Rekomendasi jika sebagian nama cocok */}
                    {mutationPartialSuggestions.length > 0 && (
                      <div className="mt-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs space-y-1">
                        <span className="text-[11px] font-semibold text-indigo-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Ditemukan perusahaan tersimpan yang cocok:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {mutationPartialSuggestions.map((s) => (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => applyKnownSupplierToMutation(s)}
                              className="text-[11px] bg-white border border-indigo-300 hover:bg-indigo-600 hover:text-white text-indigo-700 px-2.5 py-1 rounded-md transition font-medium cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              <span>⚡ Isi Otomatis: {s.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chips Perusahaan Tersimpan (Quick Select) */}
                    {knownSuppliers.length > 0 && !mutationSupplierMatch && mutationPartialSuggestions.length === 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="text-[10px] text-slate-400">Pilih Cepat:</span>
                        {knownSuppliers.slice(0, 4).map((s) => (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => applyKnownSupplierToMutation(s)}
                            className="bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-slate-600 truncate max-w-[170px]"
                            title={`${s.name} (HP: ${s.phone || '-'}, Alamat: ${s.address || '-'})`}
                          >
                            + {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nomor Handphone
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          placeholder="Contoh: 0812-3456-7890"
                          value={mutationForm.supplierPhone}
                          onChange={(e) => setMutationForm({ ...mutationForm, supplierPhone: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Nomor WhatsApp
                        </label>
                        {mutationForm.supplierPhone && (
                          <button
                            type="button"
                            onClick={() => setMutationForm({ ...mutationForm, supplierWhatsapp: mutationForm.supplierPhone })}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                          >
                            Samakan dengan HP
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <MessageCircle className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500 pointer-events-none" />
                        <input
                          type="tel"
                          placeholder="Contoh: 0812-3456-7890"
                          value={mutationForm.supplierWhatsapp}
                          onChange={(e) => setMutationForm({ ...mutationForm, supplierWhatsapp: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-rose-500 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Alamat lengkap ATAU link Google Maps"
                        value={mutationForm.supplierAddress}
                        onChange={(e) => setMutationForm({ ...mutationForm, supplierAddress: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                      />
                    </div>
                    {mutationForm.supplierAddress && mutationForm.supplierAddress.trim().length > 2 && (
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>Peta Lokasi Pembelian (Tampil Otomatis):</span>
                        </span>
                        <LocationMapEmbed
                          address={mutationForm.supplierAddress}
                          name={mutationForm.supplierName}
                          height="160px"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">No. Surat Jalan / Bukti Referensi</label>
                  <input
                    type="text"
                    placeholder="Contoh: SJ-2026-001, PO-990"
                    value={mutationForm.referenceNumber}
                    onChange={(e) => setMutationForm({ ...mutationForm, referenceNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Petugas / Operator</label>
                  <input
                    type="text"
                    value={mutationForm.performedBy}
                    onChange={(e) => setMutationForm({ ...mutationForm, performedBy: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan kondisi barang, nomor batch, dll."
                  value={mutationForm.notes}
                  onChange={(e) => setMutationForm({ ...mutationForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                {(mutationForm.type === "IN" || mutationForm.type === "OUT") && (!mutationForm.imageUrl || !mutationForm.imageTimestamp) && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <b>Foto Bukti Wajib:</b> Transaksi barang {mutationForm.type === "IN" ? "masuk" : "keluar"} wajib melampirkan foto yang memuat tanggal, jam, dan menit di atas.
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Simpan {mutationForm.type === "IN" ? "Barang Masuk" : mutationForm.type === "OUT" ? "Barang Keluar" : "Opname"} ({mutationForm.quantity} {mutationForm.unit})
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH PERUSAHAAN BARU */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddCompanyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="bg-slate-100 p-2 rounded-lg text-slate-800">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Daftarkan Perusahaan Baru</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Setiap perusahaan akan memiliki ruang lingkup database dan stok yang terpisah (Multi-Tenant).
            </p>

            <form onSubmit={handleAddCompanySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Perusahaan / Bisnis *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Contoh: PT Global Logistik Nusantara"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon / Kontak</label>
                <input
                  type="text"
                  name="phone"
                  placeholder="Contoh: 021-8889990"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Email Perusahaan</label>
                <input
                  type="email"
                  name="email"
                  placeholder="admin@perusahaan.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Kantor / Gudang Utama</label>
                <textarea
                  rows={2}
                  name="address"
                  placeholder="Jl. Sudirman Kav 21, Jakarta"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md cursor-pointer"
                >
                  Buat Ruang Kerja Perusahaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH GUDANG / CABANG */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddWarehouseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="bg-purple-100 p-2 rounded-lg text-purple-700">
                <Warehouse className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Tambah Gudang / Cabang</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Menambah titik gudang baru untuk {initialData?.company?.name}.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                try {
                  await addWarehouse({
                    companyId: initialCompanyId,
                    name: fd.get("name") as string,
                    code: fd.get("code") as string,
                    location: (fd.get("location") as string) || undefined,
                  });
                  setShowAddWarehouseModal(false);
                  showMessage("success", "Gudang baru berhasil ditambahkan!");
                  router.refresh();
                } catch (err: any) {
                  showMessage("error", err.message || "Gagal menambah gudang");
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Gudang *</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Contoh: Gudang Cabang Semarang"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Gudang (Singkat) *</label>
                <input
                  type="text"
                  name="code"
                  placeholder="Contoh: WH-SMG-01"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi / Alamat</label>
                <input
                  type="text"
                  name="location"
                  placeholder="Kawasan Industri Wijayakusuma"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md cursor-pointer"
                >
                  Simpan Gudang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BUAT CATATAN GUDANG BARU */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAddNoteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">
                <StickyNote className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Buat Catatan / Memo Baru</h2>
                <p className="text-xs text-slate-500">
                  Tambahkan memo atau catatan operasional gudang untuk {initialData?.company?.name}.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddNoteSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Catatan *</label>
                <input
                  type="text"
                  placeholder="Contoh: Instruksi Penataan Palet Semen, Peringatan Stok Tipis, dll."
                  value={newNoteForm.title}
                  onChange={(e) => setNewNoteForm({ ...newNoteForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newNoteForm.category}
                    onChange={(e) => setNewNoteForm({ ...newNoteForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="Operasional">📦 Operasional</option>
                    <option value="Penting">🔥 Penting / Urgent</option>
                    <option value="Shift">🔄 Serah Terima Shift</option>
                    <option value="Supplier">🏬 Supplier / Vendor</option>
                    <option value="Umum">📌 Catatan Umum</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Prioritas</label>
                  <select
                    value={newNoteForm.priority}
                    onChange={(e) => setNewNoteForm({ ...newNoteForm, priority: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Mendesak / Urgent ⚠️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Penulis / Petugas</label>
                <input
                  type="text"
                  value={newNoteForm.author}
                  onChange={(e) => setNewNoteForm({ ...newNoteForm, author: e.target.value })}
                  placeholder="Nama staf pembuat catatan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Isi Catatan / Memo *</label>
                <textarea
                  rows={4}
                  placeholder="Tuliskan detail instruksi, nomor faktur/surat jalan yang perlu dipantau, nomor rak, kondisi barang, dll."
                  value={newNoteForm.content}
                  onChange={(e) => setNewNoteForm({ ...newNoteForm, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-indigo-500 font-normal leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinNoteCheckbox"
                  checked={newNoteForm.isPinned}
                  onChange={(e) => setNewNoteForm({ ...newNoteForm, isPinned: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="pinNoteCheckbox" className="text-xs font-medium text-slate-700 cursor-pointer flex items-center gap-1">
                  <Pin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sematkan catatan ini di urutan paling atas (Pinned)</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Catatan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL PENERIMAAN BARANG PO KE GUDANG (Goods Receipt) */}
      {selectedPoForReceive && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setSelectedPoForReceive(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Penerimaan Barang Masuk (Goods Receipt)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Konfirmasi kedatangan barang fisik untuk No. PO: <b>{selectedPoForReceive.poNumber}</b>
                  </p>
                </div>
              </div>
            </div>

            {/* Ringkasan PO */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vendor / Supplier:</span>
                <span className="font-bold text-slate-800">{selectedPoForReceive.supplierName}</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2 space-y-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Barang yang Masuk:
                </span>
                {JSON.parse(selectedPoForReceive.itemsJson || "[]").map((it: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between font-medium">
                    <span>{it.productName}</span>
                    <span className="font-bold text-indigo-700">+{it.quantity} {it.unit}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleConfirmReceivePO} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Gudang Penyimpanan Tujuan *
                </label>
                <select
                  value={receivePoWarehouseId}
                  onChange={(e) => setReceivePoWarehouseId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                >
                  {(initialData?.warehouses || []).map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) {w.location ? `- ${w.location}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Foto Bukti dengan Timestamp Wajib */}
              <ImageTimestampUploader
                label="Foto Bukti Fisik Barang Masuk / Surat Jalan PO"
                required={true}
                onImageVerified={(data) => {
                  setReceivePoImageData({
                    imageUrl: data?.imageUrl || "",
                    timestamp: data?.timestamp || "",
                  });
                }}
              />

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPoForReceive(null)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isReceivingPo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {isReceivingPo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Stok...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Konfirmasi Barang Masuk ke Gudang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SIMULASI TERBITKAN PO BARU DARI PURCHASING */}
      {showCreatePoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setShowCreatePoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Terbitkan Purchase Order (PO)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Simulasi pengiriman pesanan pembelian dari tim Purchasing ke Gudang
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreatePOSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Produk yang Dipesan *
                </label>
                <select
                  value={newPoForm.productId}
                  onChange={(e) => {
                    const sel = (initialData?.products || []).find((p: any) => p.id === e.target.value);
                    setNewPoForm({
                      ...newPoForm,
                      productId: e.target.value,
                      unit: sel?.unit || "pcs",
                      supplierName: sel?.supplierName || newPoForm.supplierName,
                      supplierPhone: sel?.supplierPhone || newPoForm.supplierPhone,
                      supplierAddress: sel?.supplierAddress || newPoForm.supplierAddress,
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                >
                  {(initialData?.products || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Satuan: {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Pesanan *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPoForm.quantity}
                    onChange={(e) => setNewPoForm({ ...newPoForm, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    disabled
                    value={newPoForm.unit}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Vendor / Supplier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Chandra Asri, PT Lenovo, dll."
                  value={newPoForm.supplierName}
                  onChange={(e) => setNewPoForm({ ...newPoForm, supplierName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Pengadaan
                </label>
                <textarea
                  rows={2}
                  value={newPoForm.notes}
                  onChange={(e) => setNewPoForm({ ...newPoForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePoModal(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kirim PO ke Gudang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terbitkan ID Card Baru (Saat di dalam Dashboard) */}
      {showRegisterUserModal && renderRegisterEmployeeModal()}

      {/* DATALIST AUTO-DETECT PERUSAHAAN/RETAIL */}
      <datalist id="known-suppliers-datalist">
        {knownSuppliers.map((s) => (
          <option key={s.name} value={s.name}>
            {s.phone ? `HP: ${s.phone}` : ""} {s.address ? `• ${s.address.slice(0, 40)}...` : ""}
          </option>
        ))}
      </datalist>
    </div>
  );
}
