export interface UnitOption {
  value: string;
  label: string;
  category: "Jumlah / Kemasan" | "Berat / Massa" | "Volume / Cairan" | "Panjang / Luas";
}

export const ALL_UNITS: UnitOption[] = [
  // 1. Jumlah & Kemasan
  { value: "pcs", label: "Pcs (Pieces / Buah)", category: "Jumlah / Kemasan" },
  { value: "unit", label: "Unit", category: "Jumlah / Kemasan" },
  { value: "box", label: "Box / Dus", category: "Jumlah / Kemasan" },
  { value: "karton", label: "Karton", category: "Jumlah / Kemasan" },
  { value: "pack", label: "Pack", category: "Jumlah / Kemasan" },
  { value: "lusin", label: "Lusin (12 pcs)", category: "Jumlah / Kemasan" },
  { value: "kodi", label: "Kodi (20 pcs)", category: "Jumlah / Kemasan" },
  { value: "gross", label: "Gross (144 pcs)", category: "Jumlah / Kemasan" },
  { value: "rim", label: "Rim (Kertas)", category: "Jumlah / Kemasan" },
  { value: "set", label: "Set", category: "Jumlah / Kemasan" },
  { value: "koli", label: "Koli", category: "Jumlah / Kemasan" },
  { value: "palet", label: "Palet", category: "Jumlah / Kemasan" },
  { value: "karung", label: "Karung / Sak", category: "Jumlah / Kemasan" },
  { value: "ikat", label: "Ikat", category: "Jumlah / Kemasan" },

  // 2. Berat & Massa
  { value: "kg", label: "Kg (Kilogram)", category: "Berat / Massa" },
  { value: "gram", label: "Gram", category: "Berat / Massa" },
  { value: "ton", label: "Ton", category: "Berat / Massa" },
  { value: "kuintal", label: "Kuintal (100 kg)", category: "Berat / Massa" },
  { value: "mg", label: "Mg (Miligram)", category: "Berat / Massa" },
  { value: "ons", label: "Ons (100 g)", category: "Berat / Massa" },

  // 3. Volume & Cairan
  { value: "liter", label: "Liter", category: "Volume / Cairan" },
  { value: "ml", label: "Ml (Mililiter)", category: "Volume / Cairan" },
  { value: "galon", label: "Galon", category: "Volume / Cairan" },
  { value: "drum", label: "Drum", category: "Volume / Cairan" },
  { value: "botol", label: "Botol", category: "Volume / Cairan" },
  { value: "kaleng", label: "Kaleng", category: "Volume / Cairan" },

  // 4. Panjang & Luas
  { value: "meter", label: "Meter (m)", category: "Panjang / Luas" },
  { value: "cm", label: "Cm (Centimeter)", category: "Panjang / Luas" },
  { value: "roll", label: "Roll / Gulungan", category: "Panjang / Luas" },
  { value: "lembar", label: "Lembar", category: "Panjang / Luas" },
  { value: "m2", label: "Meter Persegi (m²)", category: "Panjang / Luas" },
  { value: "m3", label: "Meter Kubik (m³)", category: "Panjang / Luas" },
];
