// Graduation date — May 28, 2026 at 18:00 (Mongolia time, UTC+8)
// Adjust freely. Stored as ISO string with offset.
export const GRADUATION_DATE_ISO = "2026-05-28T18:00:00+08:00";
export const GRADUATION_LABEL = "Төгсөлтийн ёслол · 2026.05.28";
export const SITE_NAME = "CS · Төгсөгчид 2026";

// Төгсөлтийн санд төлөх нэг хүний хураамж (₮)
// ⚠️ Local test: түр 500₮ болгосон. Production-д буцаагаад 15_000 болгоно.
export const FUND_FEE = 500;

// Бүх курсын нэр (admin табд эрэмбэлэхэд хэрэглэнэ)
export const CLASS_NAMES = ["КУ-1", "КУ-2", "КУ-3", "КУ-4", "КУ-5"] as const;
export type ClassName = (typeof CLASS_NAMES)[number];
