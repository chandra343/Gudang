import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Mulai seeding data inventaris...");

  await prisma.stockTransaction.deleteMany({});
  await prisma.inventoryStock.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});

  const now = new Date();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // 1. Perusahaan A
  const companyA = await prisma.company.create({
    data: {
      name: "PT Sumber Makmur Sentosa",
      slug: "sumber-makmur",
      phone: "021-5551234",
      email: "admin@sumbermakmur.co.id",
      address: "Kawasan Industri Pulogadung, Jakarta Timur",
      plan: "PRO",
    },
  });

  const whA1 = await prisma.warehouse.create({
    data: {
      companyId: companyA.id,
      name: "Gudang Utama Jakarta",
      code: "WH-JKT-01",
      location: "Blok B3, Pulogadung",
      isPrimary: true,
    },
  });

  const whA2 = await prisma.warehouse.create({
    data: {
      companyId: companyA.id,
      name: "Gudang Cabang Surabaya",
      code: "WH-SBY-02",
      location: "Rungkut Industri, Surabaya",
      isPrimary: false,
    },
  });

  const catA1 = await prisma.category.create({
    data: { companyId: companyA.id, name: "Perangkat & Elektronik" },
  });
  const catA2 = await prisma.category.create({
    data: { companyId: companyA.id, name: "Material & Logistik" },
  });

  const prodA1 = await prisma.product.create({
    data: {
      companyId: companyA.id,
      categoryId: catA1.id,
      barcode: "899123456001",
      name: "Laptop ThinkPad T14 Gen 4",
      unit: "unit",
      minStock: 5,
      lastInDate: fiveDaysAgo,
      lastOutDate: twoDaysAgo,
      supplierName: "PT Lenovo Distribusi Indonesia",
      supplierPhone: "021-2998888",
      supplierWhatsapp: "081288991122",
      supplierAddress: "Wisma GKBI Lt. 12, Jl. Jend. Sudirman No. 28, Jakarta Pusat",
    },
  });

  const prodA2 = await prisma.product.create({
    data: {
      companyId: companyA.id,
      categoryId: catA2.id,
      barcode: "899123456002",
      name: "Kabel Tembaga Industri NYY 4x16mm",
      unit: "meter",
      minStock: 100,
      lastInDate: fiveDaysAgo,
      lastOutDate: null,
      supplierName: "Toko Kabel Jaya Makmur Glodok",
      supplierPhone: "081377889900",
      supplierWhatsapp: "081377889900",
      supplierAddress: "https://maps.app.goo.gl/glodok-kabel-jaya",
    },
  });

  const prodA3 = await prisma.product.create({
    data: {
      companyId: companyA.id,
      categoryId: catA2.id,
      barcode: "899123456003",
      name: "Biji Plastik HDPE Virgin Granule",
      unit: "ton",
      minStock: 10,
      lastInDate: twoDaysAgo,
      lastOutDate: now,
      supplierName: "PT Chandra Asri Petrochemical Tbk",
      supplierPhone: "021-5307950",
      supplierWhatsapp: "081199223344",
      supplierAddress: "Wisma Barito Pacific Tower B, Jl. Letjen S. Parman Kav. 62, Jakarta Barat",
    },
  });

  await prisma.inventoryStock.createMany({
    data: [
      { companyId: companyA.id, productId: prodA1.id, warehouseId: whA1.id, quantity: 24 },
      { companyId: companyA.id, productId: prodA1.id, warehouseId: whA2.id, quantity: 3 },
      { companyId: companyA.id, productId: prodA2.id, warehouseId: whA1.id, quantity: 350 },
      { companyId: companyA.id, productId: prodA3.id, warehouseId: whA1.id, quantity: 4 }, // MinStock: 10 -> Stok menipis (4 ton)
    ],
  });

  await prisma.stockTransaction.createMany({
    data: [
      {
        companyId: companyA.id,
        productId: prodA1.id,
        warehouseId: whA1.id,
        type: "IN",
        quantity: 25,
        unit: "unit",
        date: fiveDaysAgo,
        referenceNumber: "PO-JKT-001",
        notes: "Penerimaan impor dari distributor",
        performedBy: "Budi Santoso",
        supplierName: "PT Lenovo Distribusi Indonesia",
        supplierPhone: "021-2998888",
        supplierWhatsapp: "081288991122",
        supplierAddress: "Wisma GKBI Lt. 12, Jl. Jend. Sudirman No. 28, Jakarta Pusat",
      },
      {
        companyId: companyA.id,
        productId: prodA1.id,
        warehouseId: whA1.id,
        type: "OUT",
        quantity: -1,
        unit: "unit",
        date: twoDaysAgo,
        referenceNumber: "SJ-JKT-102",
        notes: "Pengiriman ke client PT Maju Bersama",
        performedBy: "Budi Santoso",
      },
      {
        companyId: companyA.id,
        productId: prodA3.id,
        warehouseId: whA1.id,
        type: "IN",
        quantity: 20,
        unit: "ton",
        date: twoDaysAgo,
        referenceNumber: "PO-JKT-002",
        notes: "Pengadaan bahan baku pabrik",
        performedBy: "Budi Santoso",
        supplierName: "PT Chandra Asri Petrochemical Tbk",
        supplierPhone: "021-5307950",
        supplierWhatsapp: "081199223344",
        supplierAddress: "Wisma Barito Pacific Tower B, Jl. Letjen S. Parman Kav. 62, Jakarta Barat",
      },
      {
        companyId: companyA.id,
        productId: prodA3.id,
        warehouseId: whA1.id,
        type: "OUT",
        quantity: -2,
        unit: "ton",
        date: now,
        referenceNumber: "SJ-RAW-99",
        notes: "Pengambilan ke lini produksi",
        performedBy: "Staf Logistik",
      },
    ],
  });

  // 2. Perusahaan B
  const companyB = await prisma.company.create({
    data: {
      name: "CV Berkah Jaya Abadi",
      slug: "berkah-jaya",
      phone: "022-8765432",
      email: "info@berkahjaya.com",
      address: "Jl. Soekarno Hatta No. 120, Bandung",
      plan: "FREE",
    },
  });

  const whB1 = await prisma.warehouse.create({
    data: {
      companyId: companyB.id,
      name: "Gudang Distribusi Bandung",
      code: "WH-BDG-01",
      location: "Gedebage, Bandung",
      isPrimary: true,
    },
  });

  const catB1 = await prisma.category.create({
    data: { companyId: companyB.id, name: "Pangan & Sembako" },
  });

  const prodB1 = await prisma.product.create({
    data: {
      companyId: companyB.id,
      categoryId: catB1.id,
      barcode: "899987654001",
      name: "Beras Rojolele Super",
      unit: "karung",
      minStock: 50,
      lastInDate: fiveDaysAgo,
      lastOutDate: twoDaysAgo,
    },
  });

  const prodB2 = await prisma.product.create({
    data: {
      companyId: companyB.id,
      categoryId: catB1.id,
      barcode: "899987654002",
      name: "Gula Pasir Kristal Putih",
      unit: "kg",
      minStock: 200,
      lastInDate: twoDaysAgo,
      lastOutDate: null,
    },
  });

  await prisma.inventoryStock.createMany({
    data: [
      { companyId: companyB.id, productId: prodB1.id, warehouseId: whB1.id, quantity: 180 },
      { companyId: companyB.id, productId: prodB2.id, warehouseId: whB1.id, quantity: 850 },
    ],
  });

  await prisma.stockTransaction.createMany({
    data: [
      {
        companyId: companyB.id,
        productId: prodB1.id,
        warehouseId: whB1.id,
        type: "IN",
        quantity: 200,
        unit: "karung",
        date: fiveDaysAgo,
        referenceNumber: "SJ-PETANI-1",
        notes: "Panen raya dari mitra",
        performedBy: "Siti Rahmawati",
      },
      {
        companyId: companyB.id,
        productId: prodB1.id,
        warehouseId: whB1.id,
        type: "OUT",
        quantity: -20,
        unit: "karung",
        date: twoDaysAgo,
        referenceNumber: "DO-GROSIR-05",
        notes: "Pengiriman ke Toko Berkah 2",
        performedBy: "Siti Rahmawati",
      },
    ],
  });

  await prisma.note.createMany({
    data: [
      {
        companyId: companyA.id,
        title: "Peringatan Restock Biji Plastik HDPE",
        content: "Stok sisa 4 ton di Gudang Utama Pulogadung (WH-JKT-01). Batas minimal stok adalah 10 ton. PO pengadaan sudah diajukan ke PT Chandra Asri Petrochemical.",
        category: "Penting",
        priority: "URGENT",
        author: "Budi Santoso",
        isPinned: true,
      },
      {
        companyId: companyA.id,
        title: "Instruksi Penempatan Kabel Tembaga NYY",
        content: "Seluruh gulungan kabel tembaga harus ditempatkan di atas palet kayu blok A3 untuk menghindari kelembaban lantai dasar.",
        category: "Operasional",
        priority: "NORMAL",
        author: "Ahmad Rifai",
        isPinned: false,
      },
      {
        companyId: companyA.id,
        title: "Jadwal Serah Terima Shift & Stock Opname Akhir Pekan",
        content: "Stock opname fisik bulanan akan dilaksanakan Sabtu pukul 15.00 WIB. Seluruh operator gudang WH-JKT-01 wajib hadir tepat waktu.",
        category: "Shift",
        priority: "NORMAL",
        author: "Admin Gudang",
        isPinned: false,
      },
    ],
  });

  console.log("✅ Seeding selesai!");
}

main().finally(async () => {
  await prisma.$disconnect();
});
