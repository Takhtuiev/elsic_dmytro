// Единая цветовая схема температурных зон материала.
// Используется везде, где есть температура материала: заливка зон на изотермах сечения,
// полосы зон на графиках температуры, линии-границы (Tg, T min, T max, разложение).
//
// Границы берутся из материала:
//   Tg (glassTransitionTemp) · T min (minFormingTemp) · T max (maxFormingTemp) · разложение (decompositionTemp)
//
// Как читать (два признака — цвет и характер заливки):
//   ЦВЕТ — сторона шкалы:  синий — холодно, зелёный — норма, тёплый (жёлтый) — горячо, красный — опасно.
//   ЗАЛИВКА — определённость:
//     сплошная     — однозначное состояние: гнуть нельзя (синий), рабочее окно (зелёный), разложение (красный);
//     штриховка    — «можно, но не оптимально»: недогрев (синяя) и перегрев (жёлтая).
//   Штриховка — привычный в инженерной графике знак переходной / предупредительной области
//   и не спорит с цветом: обе неоптимальные зоны различаются цветом, но одинаково «не сплошные».

// Границы зон: ключ, поле материала, тон палитры MUI.
// Цвет границы — цвет зоны, которую она ограничивает
export const TEMPERATURE_LEVELS = [
    { key: "Tg", field: "glassTransitionTemp", tone: "info" },
    { key: "T min", field: "minFormingTemp", tone: "success" },
    { key: "T max", field: "maxFormingTemp", tone: "success" },
    { key: "Decomposition", field: "decompositionTemp", tone: "error" },
];


// Зоны по возрастанию температуры; зона k лежит между границами k−1 и k (крайние — до ±∞).
// tone / mix — цвет; opacity — плотность сплошной заливки;
// hatch — штриховка поверх лёгкой подложки (opacity у hatch — плотность линий)
export const TEMPERATURE_ZONES = [
    { key: "Solid Plastic", tone: "info", opacity: 0.13 },
    { key: "High Elastic", mix: ["info", "success", 0.6], opacity: 0.06},
    { key: "Optimal Bending", tone: "success", opacity: 0.15 }, // как в исходной версии
    { key: "High Temperature", mix: ["success", "error", 0.6], opacity: 0.07},
    { key: "Decomposition Risk", tone: "error", opacity: 0.17 },
];

// Штриховка: шаг и толщина линий в пикселях экрана, наклон 45°
export const HATCH = { spacing: 7, width: 1, angle: 45 };

// --- цвета ------------------------------------------------------------------------

const parseColor = (c) => {
    const s = String(c || "").trim();
    let m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) return m[1].split("").map((h) => parseInt(h + h, 16));
    m = s.match(/^#([0-9a-f]{6})/i);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    m = s.match(/^rgba?\(([^)]+)\)/i);
    if (m) return m[1].split(",").slice(0, 3).map((v) => parseFloat(v));
    return [128, 128, 128];
};

const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
};

const hslToHex = ([h, s, l]) => {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};

// Смешение по оттенку (короткая дуга по кругу оттенков), цвет остаётся чистым:
// насыщенность ≤ 0.75, светлость 0.45…0.55 — без «неона» и без хаки
export const mixColor = (c1, c2, t) => {
    const [h1, s1, l1] = rgbToHsl(parseColor(c1));
    const [h2, s2, l2] = rgbToHsl(parseColor(c2));
    let dh = h2 - h1;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = (h1 + dh * t + 360) % 360;
    const s = Math.min(0.75, Math.max(s1, s2));
    const l = Math.min(0.55, Math.max(0.45, l1 + (l2 - l1) * t));
    return hslToHex([h, s, l]);
};

const toneColor = (tone, colors) => colors?.[`${tone}Main`];
const zoneDef = (key) => TEMPERATURE_ZONES.find((z) => z.key === key);
const zoneColor = (z, colors) => (z.mix
    ? mixColor(toneColor(z.mix[0], colors), toneColor(z.mix[1], colors), z.mix[2])
    : toneColor(z.tone, colors));

/**
 * Заливка зоны: { color, opacity, hatch? } — hatch: { color, opacity, spacing, width, angle }.
 * colors — extractThemeColors(theme.palette)
 */
export const temperatureZoneStyle = (key, colors) => {
    const z = zoneDef(key);
    if (!z) return { color: colors?.successMain, opacity: 0.15 };
    const color = zoneColor(z, colors);
    return {
        color,
        opacity: z.opacity,
        ...(z.hatch ? { hatch: { ...HATCH, color, ...z.hatch } } : {}),
    };
};

// Цвет линии-границы (изотермы и пределы на осях)
export const temperatureLevelColor = (key, colors) => {
    const l = TEMPERATURE_LEVELS.find((it) => it.key === key);
    return l ? toneColor(l.tone, colors) : colors?.textPrimary;
};

// --- границы и полосы -------------------------------------------------------------

// Значения границ из материала: [{ key, value }] (только заданные)
export const temperatureLevels = (material) =>
    TEMPERATURE_LEVELS
        .map((l) => ({ key: l.key, value: Number(material?.[l.field]) }))
        .filter((l) => Number.isFinite(l.value));

// Полосы зон: [{ key, lo, hi }], lo < hi, ±Infinity у крайних.
// Незаданная граница убирает полосу (соседние не склеиваются, чтобы не врать о материале).
export const temperatureZoneBands = (material) => {
    const edges = [
        -Infinity,
        ...TEMPERATURE_LEVELS.map((l) => Number(material?.[l.field])),
        Infinity,
    ];
    return TEMPERATURE_ZONES
        .map((z, k) => ({ key: z.key, lo: edges[k], hi: edges[k + 1] }))
        .filter((b) => !Number.isNaN(b.lo) && !Number.isNaN(b.hi) && b.lo < b.hi);
};

// --- подписи и легенда ------------------------------------------------------------

const deg = (v) => `${Math.round(v)}°`;

// Подпись зоны в легенде: «<80°», «110°–140°», «>180°»
export const temperatureZoneLabel = ({ lo, hi }) => (
    !Number.isFinite(lo) ? `<${deg(hi)}`
        : !Number.isFinite(hi) ? `>${deg(lo)}`
            : `${deg(lo)}–${deg(hi)}`
);

// Элемент легенды: маркер плотнее заливки, чтобы читался; у штрихованной зоны — штриховка
export const temperatureZoneLegendItem = (zone, colors) => {
    const { color, opacity, hatch } = temperatureZoneStyle(zone.key, colors);
    return {
        label: temperatureZoneLabel(zone),
        color,
        opacity: Math.min(1, opacity * 2.2),
        stroke: color,
        ...(hatch ? { hatch: { ...hatch, spacing: 3, opacity: Math.min(1, hatch.opacity * 1.3) } } : {}),
    };
};

/**
 * Ось температуры материала для линейных графиков: полосы всех зон и линии границ.
 * Окно формования (T min…T max) всегда попадает в видимый диапазон, остальные зоны
 * заливаются только там, где их видно, и шкалу не растягивают.
 */
export const temperatureAxis = (material, colors) => {
    const bands = temperatureZoneBands(material);
    if (!bands.length) return { unit: "°", lines: [], ranges: [] };
    return {
        unit: "°",
        lines: temperatureLevels(material).map((l) => ({ value: l.value, color: temperatureLevelColor(l.key, colors) })),
        ranges: bands.map((b) => ({
            from: b.lo,
            to: b.hi,
            ...temperatureZoneStyle(b.key, colors),
            marks: false,
            extendDomain: b.key === "Optimal Bending",
        })),
    };
};
