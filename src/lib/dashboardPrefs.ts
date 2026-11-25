import type { CSSProperties } from "react";

export type GudangThemeColor = "indigo" | "emerald" | "slate" | "violet";
export type DashboardBgPreset =
  | "default"
  | "dark"
  | "ocean"
  | "emerald"
  | "violet"
  | "sunset"
  | "custom";
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
  bgPreset: DashboardBgPreset;
  bgCustomColor: string;
  bgImageData: string;
  bgOverlayOpacity: number;
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

export interface BackgroundPresetOption {
  key: DashboardBgPreset;
  label: string;
  swatchClass: string;
  containerClass: string;
}

export const BACKGROUND_PRESET_OPTIONS: BackgroundPresetOption[] = [
  {
    key: "default",
    label: "Default Terang",
    swatchClass: "bg-slate-100 border-slate-300",
    containerClass: "bg-slate-50 text-slate-800",
  },
  {
    key: "dark",
    label: "Gelap (Night)",
    swatchClass: "bg-slate-900 border-slate-700",
    containerClass: "bg-slate-950 text-slate-800",
  },
  {
    key: "ocean",
    label: "Samudra Biru",
    swatchClass: "bg-gradient-to-br from-sky-700 to-indigo-900 border-sky-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-slate-800",
  },
  {
    key: "emerald",
    label: "Hijau Zamrud",
    swatchClass: "bg-gradient-to-br from-emerald-700 to-teal-900 border-emerald-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-slate-800",
  },
  {
    key: "violet",
    label: "Ungu Modern",
    swatchClass: "bg-gradient-to-br from-violet-700 to-indigo-900 border-violet-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 text-slate-800",
  },
  {
    key: "sunset",
    label: "Senja Hangat",
    swatchClass: "bg-gradient-to-br from-amber-200 to-rose-200 border-amber-300",
    containerClass: "bg-gradient-to-br from-amber-50 via-rose-50 to-orange-100 text-slate-800",
  },
];

export const DEFAULT_GUDANG_PREFS: GudangDashboardPrefs = {
  customTitle: "",
  themeColor: "indigo",
  bgPreset: "default",
  bgCustomColor: "",
  bgImageData: "",
  bgOverlayOpacity: 35,
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
const VALID_BG_PRESETS = new Set<DashboardBgPreset>([
  "default",
  "dark",
  "ocean",
  "emerald",
  "violet",
  "sunset",
  "custom",
]);
const VALID_TABS = new Set<GudangTabKey>(["inventory", "logs", "notes", "purchasing"]);

export function sanitizeHexColor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned.toLowerCase() : "";
}

export function sanitizeBgImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 350000) return "";
  if (/["'()<>\\;\n\r]/.test(trimmed)) return "";
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\/[^\s"'<>()]+$/i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

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

    const bgOverlayNum =
      typeof parsed.bgOverlayOpacity === "number" && Number.isFinite(parsed.bgOverlayOpacity)
        ? Math.min(85, Math.max(0, Math.round(parsed.bgOverlayOpacity)))
        : DEFAULT_GUDANG_PREFS.bgOverlayOpacity;

    return {
      customTitle: typeof parsed.customTitle === "string" ? parsed.customTitle.slice(0, 80) : "",
      themeColor:
        parsed.themeColor && VALID_THEMES.has(parsed.themeColor)
          ? parsed.themeColor
          : DEFAULT_GUDANG_PREFS.themeColor,
      bgPreset:
        parsed.bgPreset && VALID_BG_PRESETS.has(parsed.bgPreset)
          ? parsed.bgPreset
          : DEFAULT_GUDANG_PREFS.bgPreset,
      bgCustomColor: sanitizeHexColor(parsed.bgCustomColor),
      bgImageData: sanitizeBgImageUrl(parsed.bgImageData),
      bgOverlayOpacity: bgOverlayNum,
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

export function getDashboardBackgroundStyle(prefs: {
  bgPreset: DashboardBgPreset;
  bgCustomColor: string;
  bgImageData: string;
  bgOverlayOpacity: number;
}): {
  containerClass: string;
  containerStyle?: CSSProperties;
  safeImageUrl: string;
  overlayOpacity: number;
  isCustomBg: boolean;
} {
  const safeImageUrl = sanitizeBgImageUrl(prefs.bgImageData);
  const safeColor = sanitizeHexColor(prefs.bgCustomColor);
  const overlayOpacity = Math.min(85, Math.max(0, prefs.bgOverlayOpacity)) / 100;

  if (safeImageUrl) {
    return {
      containerClass: "bg-slate-900 text-slate-800",
      safeImageUrl,
      overlayOpacity,
      isCustomBg: true,
    };
  }

  if (prefs.bgPreset === "custom" && safeColor) {
    return {
      containerClass: "text-slate-800",
      containerStyle: { backgroundColor: safeColor },
      safeImageUrl: "",
      overlayOpacity: 0,
      isCustomBg: true,
    };
  }

  const matched =
    BACKGROUND_PRESET_OPTIONS.find((p) => p.key === prefs.bgPreset) ||
    BACKGROUND_PRESET_OPTIONS[0];

  return {
    containerClass: matched.containerClass,
    safeImageUrl: "",
    overlayOpacity: 0,
    isCustomBg: matched.key !== "default",
  };
}
