import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/purchasing/products?companyId={companyId}
// Digunakan oleh Project Purchasing untuk mengambil daftar master produk & total stok saat ini
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
      orderBy: { name: "asc" },
    });

    const result = products.map((p) => {
      const totalStock = p.stocks.reduce((acc, c) => acc + c.quantity, 0);
      return {
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit: p.unit,
        minStock: p.minStock,
        totalStock,
        isLowStock: totalStock <= p.minStock,
        category: p.category?.name || "Umum",
        supplier: {
          name: p.supplierName,
          phone: p.supplierPhone,
          whatsapp: p.supplierWhatsapp,
          address: p.supplierAddress,
        },
        warehouseStocks: p.stocks.map((s) => ({
          warehouseName: s.warehouse.name,
          warehouseCode: s.warehouse.code,
          quantity: s.quantity,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data produk" },
      { status: 500 }
    );
  }
}
