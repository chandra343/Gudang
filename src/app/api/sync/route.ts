import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json({ error: "companyId parameter is required" }, { status: 400 });
  }

  try {
    // Ambil timestamp pembaruan terakhir & jumlah data secara paralel
    const [latestProduct, latestTx, productCount, txCount] = await Promise.all([
      prisma.product.findFirst({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, id: true },
      }),
      prisma.stockTransaction.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, id: true },
      }),
      prisma.product.count({ where: { companyId } }),
      prisma.stockTransaction.count({ where: { companyId } }),
    ]);

    const pTime = latestProduct?.updatedAt ? new Date(latestProduct.updatedAt).getTime() : 0;
    const txTime = latestTx?.createdAt ? new Date(latestTx.createdAt).getTime() : 0;
    const pId = latestProduct?.id || "";
    const txId = latestTx?.id || "";

    // Versi unik data gabungan untuk mendeteksi perubahan
    const version = `${pTime}_${txTime}_${productCount}_${txCount}_${pId}_${txId}`;

    return NextResponse.json(
      {
        version,
        productCount,
        txCount,
        lastUpdated: Math.max(pTime, txTime),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to check sync status" }, { status: 500 });
  }
}
