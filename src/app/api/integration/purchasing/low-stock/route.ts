import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/purchasing/low-stock?companyId={companyId}
// Digunakan oleh Project Purchasing untuk mengambil daftar barang gudang yang stoknya menipis
// sehingga tim Purchasing bisa otomatis membuat PO (Purchase Order) baru ke supplier
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const targetCompanyId =
      companyId || (await prisma.company.findFirst())?.id;

    if (!targetCompanyId) {
      return NextResponse.json({ error: "Perusahaan tidak ditemukan" }, { status: 404 });
    }

    const products = await prisma.product.findMany({
      where: { companyId: targetCompanyId },
      include: {
        category: true,
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    const lowStockItems = [];

    for (const p of products) {
      const totalStock = p.stocks.reduce((acc, c) => acc + c.quantity, 0);
      if (totalStock <= p.minStock) {
        lowStockItems.push({
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          unit: p.unit,
          currentStock: totalStock,
          minStock: p.minStock,
          deficit: p.minStock - totalStock,
          recommendedReorderQty: Math.max(p.minStock * 2 - totalStock, 10),
          category: p.category?.name || "Umum",
          preferredSupplier: {
            name: p.supplierName,
            phone: p.supplierPhone,
            whatsapp: p.supplierWhatsapp,
            address: p.supplierAddress,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
      message: `${lowStockItems.length} produk butuh restock / pembuatan PO oleh tim Purchasing`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data stok menipis" },
      { status: 500 }
    );
  }
}
