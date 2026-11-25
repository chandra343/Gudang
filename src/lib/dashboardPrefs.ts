export type GudangThemeColor = "indigo" | "emerald" | "slate" | "violet";
export type GudangTabKey = "inventory" | "logs" | "notes" | "purchasing";
export type GudangStatKey =
  | "totalStock"
  | "totalIn"
  | "totalOut"
  | "lowStock"
  | "warehouses";

export interface GudangDashboardPrefs {
  customTitle: string;
  themeColor: GudangThemeColor;
  defaultTab: GudangTabKey;
  showBanner: boolean;
  showStats: boolean;
  showFilterPanel: boolean;
  showChatbot: boolean;
  compactTable: boolean;
  visibleStatKeys: Record<GudangStatKey, boolean>;
  statOrder: GudangStatKey[];
}

export const ALL_GUDANG_STAT_KEYS: GudangStatKey[] = [
  "totalStock",
  "totalIn",
  "totalOut",
  "lowStock",
  "warehouses",
];

export const GUDANG_STAT_LABELS: Record<GudangStatKey, string> = {
  totalStock: "Total Fisik Stok",
  totalIn: "Total Barang Masuk",
  totalOut: "Total Barang Keluar",
  lowStock: "Stok Kritis / Menipis",
  warehouses: "Lokasi Gudang",
};

export const DEFAULT_GUDANG_PREFS: GudangDashboardPrefs = {
  customTitle: "",
  themeColor: "indigo",
  defaultTab: "inventory",
  showBanner: true,
  showStats: true,
  showFilterPanel: true,
  showChatbot: true,
  compactTable: false,
  visibleStatKeys: {
    totalStock: true,
    totalIn: true,
    totalOut: true,
    lowStock: true,
    warehouses: true,
  },
  statOrder: [...ALL_GUDANG_STAT_KEYS],
};

const VALID_THEMES = new Set<GudangThemeColor>(["indigo", "emerald", "slate", "violet"]);
const VALID_TABS = new Set<GudangTabKey>(["inventory", "logs", "notes", "purchasing"]);

export function parseGudangPrefs(raw?: string | null): GudangDashboardPrefs {
  if (!raw) {
    return {
      ...DEFAULT_GUDANG_PREFS,
      visibleStatKeys: { ...DEFAULT_GUDANG_PREFS.visibleStatKeys },
      statOrder: [...DEFAULT_GUDANG_PREFS.statOrder],
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GudangDashboardPrefs>;
    const rawOrder = Array.isArray(parsed.statOrder) ? parsed.statOrder : [];
    const seen = new Set<GudangStatKey>();
    const normalizedOrder: GudangStatKey[] = [];
    for (const k of rawOrder) {
      if (ALL_GUDANG_STAT_KEYS.includes(k) && !seen.has(k)) {
        seen.add(k);
        normalizedOrder.push(k);
      }
    }
    for (const k of ALL_GUDANG_STAT_KEYS) {
      if (!seen.has(k)) normalizedOrder.push(k);
    }

    return {
      customTitle: typeof parsed.customTitle === "string" ? parsed.customTitle.slice(0, 80) : "",
      themeColor:
        parsed.themeColor && VALID_THEMES.has(parsed.themeColor)
          ? parsed.themeColor
          : DEFAULT_GUDANG_PREFS.themeColor,
      defaultTab:
        parsed.defaultTab && VALID_TABS.has(parsed.defaultTab)
          ? parsed.defaultTab
          : DEFAULT_GUDANG_PREFS.defaultTab,
      showBanner: typeof parsed.showBanner === "boolean" ? parsed.showBanner : true,
      showStats: typeof parsed.showStats === "boolean" ? parsed.showStats : true,
      showFilterPanel: typeof parsed.showFilterPanel === "boolean" ? parsed.showFilterPanel : true,
      showChatbot: typeof parsed.showChatbot === "boolean" ? parsed.showChatbot : true,
      compactTable: typeof parsed.compactTable === "boolean" ? parsed.compactTable : false,
      visibleStatKeys: {
        totalStock: parsed.visibleStatKeys?.totalStock ?? true,
        totalIn: parsed.visibleStatKeys?.totalIn ?? true,
        totalOut: parsed.visibleStatKeys?.totalOut ?? true,
        lowStock: parsed.visibleStatKeys?.lowStock ?? true,
        warehouses: parsed.visibleStatKeys?.warehouses ?? true,
      },
      statOrder: normalizedOrder,
    };
  } catch {
    return {
      ...DEFAULT_GUDANG_PREFS,
      visibleStatKeys: { ...DEFAULT_GUDANG_PREFS.visibleStatKeys },
      statOrder: [...DEFAULT_GUDANG_PREFS.statOrder],
    };
  }
}

export function isGudangPrefsCustomized(prefs: GudangDashboardPrefs): boolean {
  return JSON.stringify(prefs) !== JSON.stringify(DEFAULT_GUDANG_PREFS);
}

export function getGudangBannerClass(theme: GudangThemeColor): string {
  switch (theme) {
    case "emerald":
      return "from-slate-900 via-emerald-950 to-slate-900";
    case "slate":
      return "from-slate-900 via-slate-800 to-slate-900";
    case "violet":
      return "from-slate-900 via-violet-950 to-slate-900";
    case "indigo":
    default:
      return "from-slate-900 via-indigo-950 to-slate-900";
  }
}
