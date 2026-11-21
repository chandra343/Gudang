import { NextResponse } from "next/server";
import { receivePOIntoWarehouse } from "@/app/actions";

// POST /api/integration/purchasing/receive
// Digunakan saat barang fisik hasil pembelian PO tiba di gudang
// Otomatis menambah stok fisik di gudang dan mencatat mutasi masuk (IN) dengan foto & timestamp
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { poId, warehouseId, receivedBy, imageUrl, imageTimestamp, notes } = body;

    if (!poId || !warehouseId) {
      return NextResponse.json(
        { success: false, error: "poId dan warehouseId wajib disertakan" },
        { status: 400 }
      );
    }

    const result = await receivePOIntoWarehouse({
      poId,
      warehouseId,
      receivedBy: receivedBy || "Staf Penerimaan Gudang",
      imageUrl,
      imageTimestamp,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: `Barang dari PO ${result.poNumber} berhasil diterima ke gudang. Stok otomatis bertambah!`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses penerimaan PO" },
      { status: 500 }
    );
  }
}
