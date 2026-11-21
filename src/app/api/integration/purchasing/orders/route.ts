import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/purchasing/orders?companyId={companyId}
// Digunakan oleh Project Purchasing untuk mengecek status seluruh PO yang dikirim ke Gudang
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const targetCompanyId =
      companyId || (await prisma.company.findFirst())?.id;

    if (!targetCompanyId) {
      return NextResponse.json({ error: "Perusahaan tidak ditemukan" }, { status: 404 });
    }

    const pos = await prisma.purchaseOrder.findMany({
      where: { companyId: targetCompanyId },
      orderBy: { createdAt: "desc" },
    });

    const parsed = pos.map((po) => ({
      ...po,
      items: JSON.parse(po.itemsJson || "[]"),
    }));

    return NextResponse.json({
      success: true,
      count: parsed.length,
      data: parsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data PO" },
      { status: 500 }
    );
  }
}

// POST /api/integration/purchasing/orders
// Digunakan oleh Project Purchasing untuk menerbitkan Purchase Order (PO) baru yang akan diterima oleh Gudang
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, poNumber, supplierName, supplierPhone, supplierAddress, items, notes, expectedDate } = body;
    const finalSupplierName = supplierName || body.vendorName;
    const finalSupplierPhone = supplierPhone || body.vendorPhone || body.vendorWhatsapp;
    const finalSupplierAddress = supplierAddress || body.vendorAddress;

    const targetCompanyId =
      companyId || (await prisma.company.findFirst())?.id;

    if (!targetCompanyId || !finalSupplierName || !items || !items.length) {
      return NextResponse.json(
        { success: false, error: "Data PO tidak lengkap. Wajib menyertakan supplierName dan items." },
        { status: 400 }
      );
    }

    const count = await prisma.purchaseOrder.count({ where: { companyId: targetCompanyId } });
    const finalPoNumber = poNumber || `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        companyId: targetCompanyId,
        poNumber: finalPoNumber,
        supplierName: finalSupplierName,
        supplierPhone: finalSupplierPhone || null,
        supplierAddress: finalSupplierAddress || null,
        status: "APPROVED",
        notes: notes || "Diterbitkan dari Project Purchasing",
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        itemsJson: JSON.stringify(items),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Purchase Order ${po.poNumber} berhasil diterbitkan dan siap diterima oleh staf Gudang.`,
      data: {
        ...po,
        items: JSON.parse(po.itemsJson),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menerbitkan PO" },
      { status: 500 }
    );
  }
}
