"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  getTelegramConfig,
  sendTelegramMessage,
  broadcastToWarehouseStaff,
  sendTelegramTestMessage,
} from "@/lib/telegram";
import {
  checkNineRouterHealth,
  getNineRouterConfigDto,
  getRawNineRouterConfig,
  normalizeNineRouterUrls,
} from "@/lib/nineRouter";
import { DEFAULT_GUDANG_PREFS, parseGudangPrefs } from "@/lib/dashboardPrefs";

// 1. Ambil semua perusahaan
export async function getCompanies() {
  return await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
  });
}

// 2. Tambah Perusahaan Baru (Multi-tenant)
export async function createCompany(formData: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const slug = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);

  const company = await prisma.company.create({
    data: {
      name: formData.name,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      plan: "FREE",
    },
  });

  // Otomatis buat 1 gudang utama
  await prisma.warehouse.create({
    data: {
      companyId: company.id,
      name: "Gudang Utama",
      code: "WH-MAIN-01",
      location: formData.address || "Pusat",
      isPrimary: true,
    },
  });

  // Otomatis buat 1 kategori umum
  await prisma.category.create({
    data: {
      companyId: company.id,
      name: "Umum",
      description: "Kategori produk default",
    },
  });

  revalidatePath("/");
  return company;
}

// 3. Ambil Data Dashboard per Perusahaan
export async function getDashboardData(companyId: string) {
  if (!companyId) return null;

  const [
    company,
    products,
    warehouses,
    categories,
    transactions,
    notes,
    users,
    purchaseOrders,
    purchaseRequisitions,
  ] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
    }),
    prisma.product.findMany({
      where: { companyId },
      include: {
        category: true,
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { isPrimary: "desc" },
    }),
    prisma.category.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    prisma.stockTransaction.findMany({
      where: { companyId },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.note.findMany({
      where: { companyId },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { companyId },
      orderBy: { idCard: "asc" },
      select: {
        id: true,
        idCard: true,
        name: true,
        role: true,
        position: true,
        companyId: true,
        telegramChatId: true,
        telegramUsername: true,
        telegramEnabled: true,
        dashboardConfigJson: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseRequisition.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!company) return null;

  let totalStockCount = 0;
  let lowStockCount = 0;
  let totalInCount = 0;
  let totalOutCount = 0;

  for (const prod of products) {
    const prodTotalQty = prod.stocks.reduce((acc, curr) => acc + curr.quantity, 0);
    totalStockCount += prodTotalQty;

    if (prodTotalQty <= prod.minStock) {
      lowStockCount++;
    }
  }

  for (const t of transactions) {
    if (t.type === "IN") {
      totalInCount += Math.abs(t.quantity);
    } else if (t.type === "OUT") {
      totalOutCount += Math.abs(t.quantity);
    }
  }

  return {
    company,
    products,
    warehouses,
    categories,
    transactions,
    notes,
    users,
    telegramConfig: await getTelegramConfig(),
    nineRouterConfig: await getNineRouterConfigDto(),
    purchaseOrders,
    purchaseRequisitions,
    stats: {
      totalProducts: products.length,
      totalStockCount,
      lowStockCount,
      totalWarehouses: warehouses.length,
      totalInCount,
      totalOutCount,
      totalNotes: notes.length,
      totalPOs: purchaseOrders.length,
      totalPRs: purchaseRequisitions.length,
    },
  };
}

// 4. Catat Mutasi Stok (IN, OUT, ADJUSTMENT) dengan Tanggal, Satuan & Gambar Berstempel
export async function recordStockMutation(data: {
  companyId: string;
  productId: string;
  warehouseId: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  unit: string;
  date?: string;
  imageUrl?: string;
  imageTimestamp?: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierWhatsapp?: string;
  supplierAddress?: string;
  referenceNumber?: string;
  notes?: string;
  performedBy?: string;
}) {
  const {
    companyId,
    productId,
    warehouseId,
    type,
    unit,
    date,
    imageUrl,
    imageTimestamp,
    supplierName,
    supplierPhone,
    supplierWhatsapp,
    supplierAddress,
    referenceNumber,
    notes,
    performedBy,
  } = data;

  let mutationQty = Number(data.quantity);
  const transactionDate = date ? new Date(date) : new Date();

  // Validasi Wajib Foto + Timestamp untuk Barang Masuk & Barang Keluar
  if (type === "IN" || type === "OUT") {
    if (!imageUrl || !imageTimestamp) {
      throw new Error(
        `Barang ${type === "IN" ? "masuk" : "keluar"} WAJIB mengunggah foto bukti fisik yang memiliki stempel Tanggal, Jam, dan Menit!`
      );
    }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw new Error("Produk tidak ditemukan");

  const currentStock = await prisma.inventoryStock.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId,
        productId,
      },
    },
  });

  const currentQty = currentStock ? currentStock.quantity : 0;
  let newQty = currentQty;

  const productUpdateData: {
    lastInDate?: Date;
    lastOutDate?: Date;
    imageUrl?: string;
    imageTimestamp?: string;
    supplierName?: string;
    supplierPhone?: string;
    supplierWhatsapp?: string;
    supplierAddress?: string;
  } = {};

  if (type === "IN") {
    mutationQty = Math.abs(mutationQty);
    newQty = currentQty + mutationQty;
    productUpdateData.lastInDate = transactionDate;
    if (imageUrl) {
      productUpdateData.imageUrl = imageUrl;
      productUpdateData.imageTimestamp = imageTimestamp;
    }
    if (supplierName) productUpdateData.supplierName = supplierName.trim();
    if (supplierPhone) productUpdateData.supplierPhone = supplierPhone.trim();
    if (supplierWhatsapp) productUpdateData.supplierWhatsapp = supplierWhatsapp.trim();
    if (supplierAddress) productUpdateData.supplierAddress = supplierAddress.trim();
  } else if (type === "OUT") {
    mutationQty = -Math.abs(mutationQty);
    if (currentQty + mutationQty < 0) {
      throw new Error(`Stok fisik tidak mencukupi! Stok saat ini: ${currentQty} ${product.unit}`);
    }
    newQty = currentQty + mutationQty;
    productUpdateData.lastOutDate = transactionDate;
    if (imageUrl) {
      productUpdateData.imageUrl = imageUrl;
      productUpdateData.imageTimestamp = imageTimestamp;
    }
  } else if (type === "ADJUSTMENT") {
    mutationQty = Math.abs(mutationQty) - currentQty;
    newQty = Math.abs(Number(data.quantity));
  }

  await prisma.$transaction([
    prisma.stockTransaction.create({
      data: {
        companyId,
        productId,
        warehouseId,
        type,
        quantity: mutationQty,
        unit: unit || product.unit,
        date: transactionDate,
        imageUrl: imageUrl || null,
        imageTimestamp: imageTimestamp || null,
        supplierName: supplierName?.trim() || null,
        supplierPhone: supplierPhone?.trim() || null,
        supplierWhatsapp: supplierWhatsapp?.trim() || null,
        supplierAddress: supplierAddress?.trim() || null,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        performedBy: performedBy || "Staf Gudang",
      },
    }),
    prisma.inventoryStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId,
          productId,
        },
      },
      update: {
        quantity: newQty,
      },
      create: {
        companyId,
        warehouseId,
        productId,
        quantity: newQty,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: productUpdateData,
    }),
  ]);

  revalidatePath("/");
  return { success: true };
}

// 5. Tambah Produk Baru dengan Bukti Gambar, Timestamp, & Tempat Pembelian
export async function addProduct(data: {
  companyId: string;
  categoryId?: string;
  warehouseId: string;
  barcode?: string;
  name: string;
  unit: string;
  minStock: number;
  initialStock: number;
  initialStockDate?: string;
  imageUrl?: string;
  imageTimestamp?: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierWhatsapp?: string;
  supplierAddress?: string;
}) {
  const {
    companyId,
    categoryId,
    warehouseId,
    barcode,
    name,
    unit,
    minStock,
    initialStock,
    initialStockDate,
    imageUrl,
    imageTimestamp,
    supplierName,
    supplierPhone,
    supplierWhatsapp,
    supplierAddress,
  } = data;

  const inDate = initialStockDate ? new Date(initialStockDate) : new Date();
  const qty = Number(initialStock) || 0;

  // Validasi: Jika memasukkan stok awal barang masuk, wajib ada foto dengan timestamp
  if (qty > 0 && (!imageUrl || !imageTimestamp)) {
    throw new Error(
      "Barang masuk (stok awal pendaftaran) WAJIB mengunggah foto bukti fisik yang memiliki stempel Tanggal, Jam, dan Menit!"
    );
  }

  const product = await prisma.product.create({
    data: {
      companyId,
      categoryId: categoryId || null,
      barcode: barcode?.trim() || null,
      name: name.trim(),
      unit: unit || "pcs",
      minStock: Number(minStock) || 5,
      lastInDate: qty > 0 ? inDate : null,
      lastOutDate: null,
      imageUrl: imageUrl || null,
      imageTimestamp: imageTimestamp || null,
      supplierName: supplierName?.trim() || null,
      supplierPhone: supplierPhone?.trim() || null,
      supplierWhatsapp: supplierWhatsapp?.trim() || null,
      supplierAddress: supplierAddress?.trim() || null,
    },
  });

  if (warehouseId && qty > 0) {
    await prisma.inventoryStock.create({
      data: {
        companyId,
        productId: product.id,
        warehouseId,
        quantity: qty,
      },
    });

    await prisma.stockTransaction.create({
      data: {
        companyId,
        productId: product.id,
        warehouseId,
        type: "IN",
        quantity: qty,
        unit: unit || "pcs",
        date: inDate,
        imageUrl: imageUrl || null,
        imageTimestamp: imageTimestamp || null,
        supplierName: supplierName?.trim() || null,
        supplierPhone: supplierPhone?.trim() || null,
        supplierWhatsapp: supplierWhatsapp?.trim() || null,
        supplierAddress: supplierAddress?.trim() || null,
        referenceNumber: "STOK-AWAL",
        notes: "Stok awal pendaftaran produk",
        performedBy: "Admin",
      },
    });
  }

  revalidatePath("/");
  return product;
}

// 6. Tambah Gudang Baru
export async function addWarehouse(data: {
  companyId: string;
  name: string;
  code: string;
  location?: string;
}) {
  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      code: data.code.toUpperCase(),
      location: data.location || null,
      isPrimary: false,
    },
  });

  revalidatePath("/");
  return warehouse;
}

// 7. Catatan Gudang / Internal Memo
export async function createNote(data: {
  companyId: string;
  title: string;
  content: string;
  category?: string;
  priority?: string;
  author?: string;
  isPinned?: boolean;
}) {
  const note = await prisma.note.create({
    data: {
      companyId: data.companyId,
      title: data.title.trim(),
      content: data.content.trim(),
      category: data.category || "Operasional",
      priority: data.priority || "NORMAL",
      author: data.author?.trim() || "Staf Gudang",
      isPinned: data.isPinned ?? false,
    },
  });

  revalidatePath("/");
  return note;
}

export async function deleteNote(noteId: string) {
  await prisma.note.delete({
    where: { id: noteId },
  });

  revalidatePath("/");
  return { success: true };
}

export async function togglePinNote(noteId: string, isPinned: boolean) {
  await prisma.note.update({
    where: { id: noteId },
    data: { isPinned },
  });

  revalidatePath("/");
  return { success: true };
}

// 11. Autentikasi Menggunakan Nomor ID Card Karyawan Resmi Perusahaan
export async function getAllEmployees() {
  return await prisma.user.findMany({
    orderBy: { idCard: "asc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          plan: true,
        },
      },
    },
  });
}

export async function loginWithIdCard(idCard: string) {
  if (!idCard || !idCard.trim()) {
    return { success: false, error: "Nomor ID Card wajib diisi." };
  }

  const cleanId = idCard.trim().toUpperCase();
  let user = await prisma.user.findFirst({
    where: {
      idCard: {
        equals: cleanId,
      },
    },
    include: {
      company: true,
    },
  });

  // Jika tidak cocok langsung, cari dengan toleransi tanda strip/spasi (misal: WH001 cocok dengan WH-001)
  if (!user) {
    const strippedInput = cleanId.replace(/[^A-Z0-9]/g, "");
    if (strippedInput.length > 0) {
      const allUsers = await prisma.user.findMany({
        include: {
          company: true,
        },
      });
      user =
        allUsers.find(
          (u) => u.idCard.replace(/[^A-Z0-9]/gi, "").toUpperCase() === strippedInput
        ) || null;
    }
  }

  if (!user) {
    return {
      success: false,
      error: `Nomor ID Card "${cleanId}" tidak ditemukan dalam sistem. Pastikan memasukkan Nomor ID Card resmi yang diberikan oleh perusahaan.`,
    };
  }

  return {
    success: true,
    user: {
      id: user.id,
      idCard: user.idCard,
      name: user.name,
      role: user.role,
      position: user.position || "Staf Gudang",
      companyId: user.companyId,
      companyName: user.company.name,
      telegramChatId: user.telegramChatId,
      telegramUsername: user.telegramUsername,
      telegramEnabled: user.telegramEnabled,
      dashboardConfigJson: user.dashboardConfigJson || null,
    },
  };
}

export async function createEmployeeIdCard(data: {
  companyId: string;
  idCard: string;
  name: string;
  position?: string;
  role?: string;
}) {
  if (!data.idCard?.trim() || !data.name?.trim() || !data.companyId) {
    throw new Error("Nomor ID Card, Nama Karyawan, dan Perusahaan wajib diisi.");
  }

  const cleanId = data.idCard.trim().toUpperCase();
  const existing = await prisma.user.findUnique({
    where: { idCard: cleanId },
  });
  if (existing) {
    throw new Error(`Nomor ID Card "${cleanId}" sudah digunakan oleh ${existing.name}.`);
  }

  const user = await prisma.user.create({
    data: {
      companyId: data.companyId,
      idCard: cleanId,
      name: data.name.trim(),
      position: data.position?.trim() || "Staf Gudang",
      role: data.role || "STAFF",
    },
    include: {
      company: true,
    },
  });

  revalidatePath("/");
  return {
    id: user.id,
    idCard: user.idCard,
    name: user.name,
    role: user.role,
    position: user.position,
    companyId: user.companyId,
    companyName: user.company.name,
  };
}

// 12. INTEGRASI DENGAN PROJECT PURCHASING (Purchase Order & Purchase Requisition)

// Penerimaan Barang PO ke Gudang (Goods Receipt)
export async function receivePOIntoWarehouse(data: {
  poId: string;
  warehouseId: string;
  receivedBy: string;
  imageUrl?: string;
  imageTimestamp?: string;
  notes?: string;
  receivedDate?: string; // Tanggal & Waktu kedatangan barang (ISO String atau YYYY-MM-DDTHH:mm)
}) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: data.poId },
  });

  if (!po) {
    throw new Error("Purchase Order tidak ditemukan.");
  }

  if (po.status === "RECEIVED") {
    throw new Error("Purchase Order ini sudah pernah diterima sebelumnya.");
  }

  const items = JSON.parse(po.itemsJson || "[]");
  if (!items.length) {
    throw new Error("Daftar barang pada Purchase Order kosong.");
  }

  const receiveDate = data.receivedDate ? new Date(data.receivedDate) : new Date();

  // Catat setiap item PO menjadi transaksi stok masuk (IN) di gudang terpilih
  for (const item of items) {
    if (!item.quantity) continue;

    // Pastikan produk ada di database Gudang, buat otomatis jika merupakan barang baru
    let targetProductId = item.productId;
    let prod = targetProductId
      ? await prisma.product.findUnique({ where: { id: targetProductId } })
      : null;

    if (!prod && item.productName) {
      prod = await prisma.product.findFirst({
        where: {
          companyId: po.companyId,
          name: { equals: item.productName.trim() },
        },
      });
    }

    if (!prod && item.productName) {
      prod = await prisma.product.create({
        data: {
          companyId: po.companyId,
          name: item.productName.trim(),
          unit: item.unit || "pcs",
          minStock: 5,
          supplierName: po.supplierName,
          supplierPhone: po.supplierPhone,
          supplierAddress: po.supplierAddress,
        },
      });
    }

    if (!prod) continue;
    targetProductId = prod.id;

    // 1. Update/Buat saldo stok di gudang tujuan
    await prisma.inventoryStock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: data.warehouseId,
          productId: targetProductId,
        },
      },
      update: {
        quantity: {
          increment: Number(item.quantity),
        },
      },
      create: {
        companyId: po.companyId,
        productId: targetProductId,
        warehouseId: data.warehouseId,
        quantity: Number(item.quantity),
      },
    });

    // 2. Catat riwayat mutasi stok masuk
    await prisma.stockTransaction.create({
      data: {
        companyId: po.companyId,
        productId: targetProductId,
        warehouseId: data.warehouseId,
        type: "IN",
        quantity: Number(item.quantity),
        unit: item.unit || "pcs",
        date: receiveDate,
        imageUrl: data.imageUrl || undefined,
        imageTimestamp: data.imageTimestamp || undefined,
        supplierName: po.supplierName,
        supplierPhone: po.supplierPhone,
        supplierAddress: po.supplierAddress,
        referenceNumber: po.poNumber,
        notes: data.notes || `Penerimaan Barang PO ${po.poNumber} dari Sistem Purchasing`,
        performedBy: data.receivedBy,
      },
    });

    // 3. Update lastInDate pada produk
    await prisma.product.update({
      where: { id: targetProductId },
      data: { lastInDate: receiveDate },
    });
  }

  // 4. Ambil nama gudang penerima
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: data.warehouseId },
  });
  const warehouseName = warehouse?.name || "Gudang Utama";

  // Update status PO di database Gudang menjadi RECEIVED
  const updatedPo = await prisma.purchaseOrder.update({
    where: { id: data.poId },
    data: {
      status: "RECEIVED",
      receivedAt: receiveDate,
      receivedBy: data.receivedBy,
      receivedWarehouse: warehouseName,
      receiptNotes: data.notes || `Barang PO ${po.poNumber} telah diterima di ${warehouseName} oleh ${data.receivedBy}`,
      receiptPhotoUrl: data.imageUrl || null,
      receiptTimestamp: data.imageTimestamp || null,
    },
  });

  // 5. Kirim data & bukti foto langsung ke Sistem Purchasing (http://localhost:3001)
  const purchasingUrl = process.env.PURCHASING_API_URL || "http://localhost:3001";
  try {
    await fetch(`${purchasingUrl}/api/integration/warehouse/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poNumber: po.poNumber,
        status: "RECEIVED",
        receivedAt: receiveDate.toISOString(),
        receivedBy: data.receivedBy,
        warehouseId: data.warehouseId,
        warehouseName,
        notes: data.notes || `Barang PO ${po.poNumber} telah tiba dan diverifikasi di ${warehouseName} oleh ${data.receivedBy}`,
        imageUrl: data.imageUrl,
        imageTimestamp: data.imageTimestamp,
        items,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err: any) {
    console.warn("Purchasing notification:", err?.message || err);
  }

  // 6. Notifikasi Telegram ke seluruh Staf Gudang yang terhubung
  try {
    const itemNamesText = items.map((it: any) => `• *${it.productName}*: ${it.quantity} ${it.unit}`).join("\n");
    const dateFormatted = receiveDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const timeFormatted = receiveDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";

    const warehouseReceiptMsg =
      `📦 *BUKTI PENERIMAAN BARANG PO DI GUDANG*\n\n` +
      `No. PO: *${po.poNumber}*\n` +
      `Vendor: *${po.supplierName}*\n` +
      `Gudang: *${warehouseName}*\n` +
      `Petugas Penerima: *${data.receivedBy}*\n` +
      `📅 *Tanggal Masuk Barang*: *${dateFormatted}*\n` +
      `🕒 *Jam & Menit*: *${timeFormatted}*\n\n` +
      `📋 *Rincian Item Diterima:*\n${itemNamesText}\n\n` +
      (data.imageTimestamp ? `⏱️ *Stempel Waktu Foto*: \`${data.imageTimestamp}\`\n` : "") +
      (data.imageUrl ? `📸 *Foto Bukti Kedatangan Fisik Terlampir* dan otomatis disinkronkan ke Purchasing.` : "");

    await broadcastToWarehouseStaff(warehouseReceiptMsg);
  } catch (err) {
    console.warn("Warehouse Telegram broadcast error:", err);
  }

  revalidatePath("/");
  return updatedPo;
}

// Buat Purchase Requisition (PR) / Permintaan Pengadaan dari Gudang ke Purchasing
export async function createPurchaseRequisition(data: {
  companyId: string;
  requestedBy: string;
  urgency?: "NORMAL" | "URGENT" | "CRITICAL";
  notes?: string;
  items: Array<{
    productId: string;
    productName: string;
    currentStock: number;
    minStock: number;
    requestedQty: number;
    unit: string;
    reason?: string;
  }>;
}) {
  if (!data.items || data.items.length === 0) {
    throw new Error("Pilih minimal satu barang untuk diajukan pengadaan ke Purchasing.");
  }

  const count = await prisma.purchaseRequisition.count({
    where: { companyId: data.companyId },
  });
  const prNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const pr = await prisma.purchaseRequisition.create({
    data: {
      companyId: data.companyId,
      prNumber,
      status: "SUBMITTED",
      requestedBy: data.requestedBy || "Staf Gudang",
      urgency: data.urgency || "NORMAL",
      notes: data.notes || "Permintaan restock barang gudang untuk Tim Purchasing.",
      itemsJson: JSON.stringify(data.items),
    },
  });

  // Notifikasi Telegram ke Staf Gudang
  try {
    const prMsg =
      `📋 *PENGAJUAN RESTOCK (PR) BARU*\n\n` +
      `No. PR: *${prNumber}*\n` +
      `Diajukan Oleh: *${data.requestedBy || "Staf Gudang"}*\n` +
      `Urgensi: *${data.urgency || "NORMAL"}*\n` +
      `Jumlah Barang: ${data.items.length} jenis item\n` +
      `Catatan: ${data.notes || "Pengajuan restock gudang"}\n\n` +
      `Data telah diteruskan ke Sistem Purchasing untuk diterbitkan PO.`;
    await broadcastToWarehouseStaff(prMsg);
  } catch (err) {
    console.warn("PR Telegram broadcast error:", err);
  }

  revalidatePath("/");
  return pr;
}

// Buat Purchase Order (PO) Baru (Simulasi Input dari Tim Purchasing)
export async function createPurchaseOrder(data: {
  companyId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  notes?: string;
  expectedDate?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    price?: number;
  }>;
}) {
  if (!data.items || data.items.length === 0) {
    throw new Error("Pilih minimal satu barang untuk membuat Purchase Order.");
  }

  const count = await prisma.purchaseOrder.count({
    where: { companyId: data.companyId },
  });
  const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  const po = await prisma.purchaseOrder.create({
    data: {
      companyId: data.companyId,
      poNumber,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      supplierAddress: data.supplierAddress,
      status: "APPROVED",
      notes: data.notes || "Diterbitkan dari Modul Purchasing.",
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      itemsJson: JSON.stringify(data.items),
    },
  });

  revalidatePath("/");
  return po;
}

// 12. Pengaturan & Koneksi Telegram Staf Gudang (Berdasarkan ID Card)
export async function updateUserTelegram(
  idCard: string,
  data: {
    telegramChatId?: string;
    telegramUsername?: string;
    telegramEnabled: boolean;
  }
) {
  try {
    const cleanId = idCard.trim().toUpperCase();
    const user = await prisma.user.findFirst({
      where: { idCard: cleanId },
    });
    if (!user) {
      return { success: false, error: `Karyawan Gudang dengan ID Card "${idCard}" tidak ditemukan.` };
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: data.telegramChatId ? data.telegramChatId.trim() : null,
        telegramUsername: data.telegramUsername ? data.telegramUsername.trim().replace(/^@/, "") : null,
        telegramEnabled: Boolean(data.telegramEnabled),
      },
    });

    revalidatePath("/");
    return {
      success: true,
      message: "Pengaturan Telegram ID Card Anda berhasil disimpan!",
      user: {
        id: updated.id,
        idCard: updated.idCard,
        name: updated.name,
        role: updated.role,
        position: updated.position,
        companyId: updated.companyId,
        telegramChatId: updated.telegramChatId,
        telegramUsername: updated.telegramUsername,
        telegramEnabled: updated.telegramEnabled,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 13. Pengaturan Global Bot Telegram Perusahaan di Modul Gudang
export async function updateTelegramBotConfig(data: {
  botToken?: string;
  botUsername?: string;
  isActive: boolean;
}) {
  try {
    const cleanToken = data.botToken ? data.botToken.trim() : null;
    const cleanUsername = data.botUsername ? data.botUsername.trim().replace(/^@/, "") : null;

    await prisma.telegramConfig.upsert({
      where: { id: "default" },
      update: {
        botToken: cleanToken,
        botUsername: cleanUsername,
        isActive: data.isActive,
      },
      create: {
        id: "default",
        botToken: cleanToken,
        botUsername: cleanUsername,
        isActive: data.isActive,
      },
    });

    revalidatePath("/");
    return { success: true, message: "Konfigurasi Bot Telegram Perusahaan berhasil diperbarui!" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 14. Uji Coba Pengiriman Pesan Notifikasi Telegram ke Staf Gudang
export async function testUserTelegramNotification(
  idCard: string,
  customChatId?: string
) {
  try {
    const cleanId = idCard.trim().toUpperCase();
    const user = await prisma.user.findFirst({
      where: { idCard: cleanId },
    });
    const name = user ? user.name : `Karyawan (${cleanId})`;
    const chatId = customChatId ? customChatId.trim() : user?.telegramChatId;

    if (!chatId) {
      return {
        success: false,
        error: "Nomor Chat ID Telegram belum diisi. Masukkan Chat ID Telegram Anda terlebih dahulu.",
      };
    }

    const result = await sendTelegramTestMessage(
      chatId,
      name,
      cleanId,
      "Sistem Gudang & Logistik"
    );
    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 15. Pengaturan & Verifikasi Koneksi 9Router AI Gateway (Gudang)
export async function saveNineRouterConfig(data: {
  baseUrl: string;
  apiKey?: string;
  clearApiKey?: boolean;
  defaultModel?: string;
  isEnabled: boolean;
  notes?: string;
}) {
  try {
    const existing = await getRawNineRouterConfig();
    const { apiV1Url } = normalizeNineRouterUrls(data.baseUrl);
    const sameEndpoint = apiV1Url === normalizeNineRouterUrls(existing.baseUrl).apiV1Url;
    const nextApiKey = data.clearApiKey
      ? null
      : data.apiKey?.trim()
        ? data.apiKey.trim()
        : sameEndpoint
          ? existing.apiKey
          : null;

    await prisma.nineRouterConfig.upsert({
      where: { id: "default" },
      update: {
        baseUrl: apiV1Url,
        apiKey: nextApiKey,
        defaultModel: data.defaultModel?.trim() || null,
        isEnabled: Boolean(data.isEnabled),
        notes: data.notes?.trim() || null,
      },
      create: {
        id: "default",
        baseUrl: apiV1Url,
        apiKey: nextApiKey,
        defaultModel: data.defaultModel?.trim() || null,
        isEnabled: Boolean(data.isEnabled),
        notes: data.notes?.trim() || null,
      },
    });

    const config = await getNineRouterConfigDto();
    revalidatePath("/");
    return {
      success: true,
      message: "Konfigurasi AI Gateway berhasil disimpan!",
      config,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testNineRouterConnection(data?: {
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  model?: string;
  verifyUsable?: boolean;
}) {
  return await checkNineRouterHealth({
    baseUrl: data?.baseUrl,
    apiKey: data?.apiKey,
    clearApiKey: data?.clearApiKey,
    model: data?.model,
    persistStatus: !data?.baseUrl && !data?.clearApiKey,
    verifyUsable: data?.verifyUsable !== false,
  });
}

// 16. Personalisasi & Restore Default Dashboard Khusus Per User (Berdasarkan ID Card)
export async function saveUserDashboardPrefs(idCard: string, prefsJson: string) {
  try {
    const cleanId = idCard.trim().toUpperCase();
    const user = await prisma.user.findFirst({ where: { idCard: cleanId } });
    if (!user) {
      return { success: false, error: `Akun dengan ID Card "${idCard}" tidak ditemukan.` };
    }
    const normalized = parseGudangPrefs(prefsJson);
    const serialized = JSON.stringify(normalized);
    await prisma.user.update({
      where: { id: user.id },
      data: { dashboardConfigJson: serialized },
    });
    revalidatePath("/");
    return {
      success: true,
      message: `Tampilan dashboard khusus akun ${user.name} (${cleanId}) berhasil disimpan!`,
      dashboardConfigJson: serialized,
      prefs: normalized,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan preferensi tampilan.",
    };
  }
}

export async function resetUserDashboardPrefs(idCard: string) {
  try {
    const cleanId = idCard.trim().toUpperCase();
    const user = await prisma.user.findFirst({ where: { idCard: cleanId } });
    if (!user) {
      return { success: false, error: `Akun dengan ID Card "${idCard}" tidak ditemukan.` };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { dashboardConfigJson: null },
    });
    revalidatePath("/");
    return {
      success: true,
      message: `Tampilan dashboard akun ${user.name} (${cleanId}) telah dikembalikan ke Default!`,
      dashboardConfigJson: null,
      prefs: DEFAULT_GUDANG_PREFS,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengembalikan tampilan default.",
    };
  }
}
