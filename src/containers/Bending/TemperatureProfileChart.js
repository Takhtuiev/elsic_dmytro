import React, { memo, useMemo } from "react";
import { Paper, useTheme } from "@mui/material";

const GRID_STEP_C = 10;
const LABEL_DISTANCES = [6, 10, 14];
const LABEL_RAY_DISTANCE = 4;
const LABEL_ACCEPTABLE_SCORE = 100;

const LABEL_PENALTIES = {
    placedOverlap: 4000,      // перекрытие с уже размещённой подписью
    placedNear: 500,          // слишком маленький зазор до другой подписи
    curveOverlap: 4000,       // перекрытие с температурной кривой
    pointInside: 1000,        // исходная точка температуры попала внутрь подписи
    topOverflowBase: 50,      // базовый штраф за выход подписи сверху
    topOverflowFactor: 8,     // дополнительный штраф за каждый пиксель выхода сверху
    bottomOverflowBase: 50,   // базовый штраф за выход подписи снизу
    bottomOverflowFactor: 8,  // дополнительный штраф за каждый пиксель выхода снизу
    direction: 15,            // штраф за отклонение от предпочтительного направления
    rayDistance: 4,           // штраф за расстояние от точки до подписи
    distance: 5                // штраф за общее расстояние подписи от точки
};

// 16 фиксированных предсчитанных направлений, заменяющих шаги по 22.5 градуса.
// Каждое направление содержит предсчитанные компоненты вектора vx (cos) и vy (sin).
// Индексы упорядочены по кругу (от 0 до 15), что соответствует углам от 0° до 337.5° с шагом 22.5°.
// Направления по оси Y учитывают SVG-специфику: вверх — минус, вниз — плюс.
const STATIC_DIRECTIONS = [
    { idx: 0,  angle: 0,     vx: 1.0,               vy: 0.0 },              // 0° (Вправо)
    { idx: 1,  angle: 22.5,  vx: 0.92387953251128,  vy: 0.38268343236508 },  // 22.5°
    { idx: 2,  angle: 45,    vx: 0.70710678118654,  vy: 0.70710678118654 },  // 45°
    { idx: 3,  angle: 67.5,  vx: 0.38268343236508,  vy: 0.92387953251128 },  // 67.5°
    { idx: 4,  angle: 90,    vx: 0.0,               vy: 1.0 },              // 90° (Вниз)
    { idx: 5,  angle: 112.5, vx: -0.38268343236508, vy: 0.92387953251128 }, // 112.5°
    { idx: 6,  angle: 135,   vx: -0.70710678118654, vy: 0.70710678118654 }, // 135°
    { idx: 7,  angle: 157.5, vx: -0.92387953251128, vy: 0.38268343236508 }, // 157.5°
    { idx: 8,  angle: 180,   vx: -1.0,              vy: 0.0 },              // 180° (Влево)
    { idx: 9,  angle: -157.5,vx: -0.92387953251128, vy: -0.38268343236508 },// 202.5° (-157.5°)
    { idx: 10, angle: -135,  vx: -0.70710678118654, vy: -0.70710678118654 },// 225° (-135°)
    { idx: 11, angle: -112.5,vx: -0.38268343236508, vy: -0.92387953251128 },// 247.5° (-112.5°)
    { idx: 12, angle: -90,   vx: 0.0,               vy: -1.0 },             // 270° (-90°, Вверх)
    { idx: 13, angle: -67.5, vx: 0.38268343236508,  vy: -0.92387953251128 },// 292.5° (-67.5°)
    { idx: 14, angle: -45,   vx: 0.70710678118654,  vy: -0.70710678118654 },// 315° (-45°)
    { idx: 15, angle: -22.5, vx: 0.92387953251128,  vy: -0.38268343236508 } // 337.5° (-22.5°)
];

const getLabelSize = p => {
    const fontSize = p.type === "cooldown" ? 8.5 : 9;
    const text = `${Math.round(p.val)}°`;
    const textWidth = text.length * fontSize * 0.52;
    const textHeight = fontSize;
    return { fontSize, textWidth, textHeight };
};

export const formatTime = seconds => {
    if (!seconds || seconds < 0) return "0m 00s";
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

const segmentIntersectsRect = (x1, y1, x2, y2, rect) => {
    let tMin = 0;
    let tMax = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (Math.abs(dx) < 0.00001) {
        if (x1 < rect.left || x1 > rect.right) return false;
    } else {
        const tx1 = (rect.left - x1) / dx;
        const tx2 = (rect.right - x1) / dx;
        tMin = Math.max(tMin, Math.min(tx1, tx2));
        tMax = Math.min(tMax, Math.max(tx1, tx2));
        if (tMin > tMax) return false;
    }

    if (Math.abs(dy) < 0.00001) {
        if (y1 < rect.top || y1 > rect.bottom) return false;
    } else {
        const ty1 = (rect.top - y1) / dy;
        const ty2 = (rect.bottom - y1) / dy;
        tMin = Math.max(tMin, Math.min(ty1, ty2));
        tMax = Math.min(tMax, Math.max(ty1, ty2));
        if (tMin > tMax) return false;
    }

    return tMax >= 0 && tMin <= 1;
};

const segmentIntersectsSegment = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const cross = (ax, ay, bx, by) => ax * by - ay * bx;
    const rX = x2 - x1;
    const rY = y2 - y1;
    const sX = x4 - x3;
    const sY = y4 - y3;

    const denominator = cross(rX, rY, sX, sY);
    if (Math.abs(denominator) < 0.00001) return false;

    const qpx = x3 - x1;
    const qpy = y3 - y1;
    const t = cross(qpx, qpy, sX, sY) / denominator;
    const u = cross(qpx, qpy, rX, rY) / denominator;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

// Геометрический расчет расстояния до периметра прямоугольника БЕЗ ТРИГОНОМЕТРИИ.
// Полностью сохраняет исходную логику расчета на основе деления компонент луча.
const getRayToRectPerimeterDistance = (point, rect) => {
    const centerX = (rect.left + rect.right) * 0.5;
    const centerY = (rect.top + rect.bottom) * 0.5;
    const rayX = centerX - point.x;
    const rayY = centerY - point.y;
    const rayLength = Math.hypot(rayX, rayY);

    if (rayLength < 0.00001) return 0;

    const ux = rayX / rayLength;
    const uy = rayY / rayLength;
    let minT = rayLength;
    let found = false;

    if (Math.abs(ux) > 0.00001) {
        const tLeft = (rect.left - point.x) / ux;
        if (tLeft >= 0) {
            const yLeft = point.y + uy * tLeft;
            if (yLeft >= rect.top && yLeft <= rect.bottom) {
                if (tLeft < minT) { minT = tLeft; found = true; }
            }
        }
        const tRight = (rect.right - point.x) / ux;
        if (tRight >= 0) {
            const yRight = point.y + uy * tRight;
            if (yRight >= rect.top && yRight <= rect.bottom) {
                if (tRight < minT) { minT = tRight; found = true; }
            }
        }
    }

    if (Math.abs(uy) > 0.00001) {
        const tTop = (rect.top - point.y) / uy;
        if (tTop >= 0) {
            const xTop = point.x + ux * tTop;
            if (xTop >= rect.left && xTop <= rect.right) {
                if (tTop < minT) { minT = tTop; found = true; }
            }
        }
        const tBottom = (rect.bottom - point.y) / uy;
        if (tBottom >= 0) {
            const xBottom = point.x + ux * tBottom;
            if (xBottom >= rect.left && xBottom <= rect.right) {
                if (tBottom < minT) { minT = tBottom; found = true; }
            }
        }
    }

    return found ? minT : rayLength;
};

const getSegmentRectOverlapRatio = (x1, y1, x2, y2, rect) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (Math.hypot(dx, dy) <= 0) return 0;

    let t0 = 0, t1 = 1;
    const clip = (p, q) => {
        if (Math.abs(p) < 0.00001) return q >= 0;
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };

    if (!clip(-dx, x1 - rect.left) || !clip(dx, rect.right - x1) ||
        !clip(-dy, y1 - rect.top) || !clip(dy, rect.bottom - y1)) {
        return 0;
    }
    return Math.max(0, t1 - t0);
};

const getRectOverlapRatio = (a, b) => {
    const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    if (overlapWidth <= 0) return 0;
    const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    if (overlapHeight <= 0) return 0;

    const overlapArea = overlapWidth * overlapHeight;
    const areaA = (a.right - a.left) * (a.bottom - a.top);
    const areaB = (b.right - b.left) * (b.bottom - b.top);
    return overlapArea / Math.min(areaA, areaB);
};

export const TemperatureProfileChart = memo(({ data, material }) => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        const temps = data?.temperatureProfile?.temperaturesC;
        const cooldownTemps = data?.temperatureProfile?.cooldownProfileC;
        const dxMm = data?.temperatureProfile?.dxMm;

        if (!temps?.length || temps.length < 2 || typeof dxMm !== "number" || dxMm <= 0) return null;

        const width = 300, height = 150, len = temps.length;
        const hasCooldown = cooldownTemps?.length === len;

        const pad = { left: 36, right: 16, top: 27, bottom: 39 };
        const wPlot = width - pad.left - pad.right;
        const hPlot = height - pad.top - pad.bottom;
        const xMax = (len - 1) * dxMm;
        const xDelta = xMax || 1;

        let minIdx = 0, maxIdx = 0, minV = Infinity, maxV = -Infinity;
        let minCoolIdx = 0, maxCoolIdx = 0, minCoolV = Infinity, maxCoolV = -Infinity;

        for (let i = 0; i < len; i++) {
            if (temps[i] < minV) { minV = temps[i]; minIdx = i; }
            if (temps[i] > maxV) { maxV = temps[i]; maxIdx = i; }
            if (hasCooldown) {
                if (cooldownTemps[i] < minCoolV) { minCoolV = cooldownTemps[i]; minCoolIdx = i; }
                if (cooldownTemps[i] > maxCoolV) { maxCoolV = cooldownTemps[i]; maxCoolIdx = i; }
            }
        }

        const minFormingTemp = material?.minFormingTemp;
        const maxFormingTemp = material?.maxFormingTemp;
        const decompositionTemp = material?.decompositionTemp;
        const hasFormingRange = typeof minFormingTemp === "number" && typeof maxFormingTemp === "number" && maxFormingTemp > minFormingTemp;

        const rangeTemps = [
            ...temps,
            ...(hasCooldown ? cooldownTemps : []),
            ...(typeof minFormingTemp === "number" ? [minFormingTemp] : []),
            ...(typeof maxFormingTemp === "number" ? [maxFormingTemp] : [])
        ];

        let tMin = Math.floor(Math.min(...rangeTemps) / GRID_STEP_C) * GRID_STEP_C;
        let tMax = Math.ceil(Math.max(...rangeTemps) / GRID_STEP_C) * GRID_STEP_C;

        if (typeof decompositionTemp === "number" && decompositionTemp > tMax && decompositionTemp - tMax <= GRID_STEP_C * 1.5) {
            tMax = decompositionTemp;
        }
        if (tMax === tMin) { tMin -= GRID_STEP_C; tMax += GRID_STEP_C; }

        const tDelta = tMax - tMin;
        const xs = x => pad.left + (x / xDelta) * wPlot;
        const ys = t => pad.top + ((tMax - t) / tDelta) * hPlot;
        const xCenter = xs(xMax / 2);

        const formingTop = hasFormingRange ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(maxFormingTemp))) : null;
        const formingBottom = hasFormingRange ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(minFormingTemp))) : null;

        const isSpecialTemperature = t => [minFormingTemp, maxFormingTemp, decompositionTemp].some(b => typeof b === "number" && Math.abs(b - t) < 0.1);

        const makePath = values => {
            let d = `M ${xs(0)} ${ys(values[0])}`;
            for (let i = 0; i < values.length - 1; i++) {
                const x0 = xs((i > 0 ? i - 1 : 0) * dxMm);
                const x1 = xs(i * dxMm);
                const x2 = xs((i + 1) * dxMm);
                const x3 = xs(Math.min(i + 2, values.length - 1) * dxMm);

                const y0 = ys(values[i > 0 ? i - 1 : 0]);
                const y1 = ys(values[i]);
                const y2 = ys(values[i + 1]);
                const y3 = ys(values[Math.min(i + 2, values.length - 1)]);

                d += ` C ${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
            }
            return d;
        };

        const chartColor = theme.palette.text.primary;
        const cooldownColor = theme.palette.text.secondary;

        const getCurveOverlapRatio = (curve, startIdx, endIdx, rect) => {
            if (!curve || endIdx <= startIdx) return 0;
            let totalLength = 0, insideLength = 0;

            for (let i = startIdx; i < endIdx; i++) {
                const x1 = xs(i * dxMm), y1 = ys(curve[i]);
                const x2 = xs((i + 1) * dxMm), y2 = ys(curve[i + 1]);
                const length = Math.hypot(x2 - x1, y2 - y1);

                if (length <= 0) continue;
                totalLength += length;

                const overlapRatio = getSegmentRectOverlapRatio(x1, y1, x2, y2, rect);
                insideLength += length * overlapRatio;
            }
            return totalLength > 0 ? Math.min(1, insideLength / totalLength) : 0;
        };

        const makeLabels = (values, minI, minVal, maxI, maxVal, type) => {
            const raw = [
                { id: maxI, val: maxVal, p: 4 },
                { id: minI, val: minVal, p: 4 },
                { id: 0, val: values[0], p: 2 },
                { id: len - 1, val: values[len - 1], p: 2 }
            ];
            const res = [], seen = new Set();
            raw.sort((a, b) => b.p - a.p);
            for (let i = 0; i < raw.length; i++) {
                const p = raw[i];
                if (!seen.has(p.id)) {
                    seen.add(p.id);
                    res.push({
                        ...p, type, order: p.id === 0 || p.id === len - 1 ? 0 : 1,
                        color: type === "cooldown" ? cooldownColor : chartColor,
                        x: xs(p.id * dxMm), y: ys(p.val)
                    });
                }
            }
            return res;
        };

        const labels = [
            ...makeLabels(temps, minIdx, minV, maxIdx, maxV, "main"),
            ...(hasCooldown ? makeLabels(cooldownTemps, minCoolIdx, minCoolV, maxCoolIdx, maxCoolV, "cooldown") : [])
        ];

        const placed = [];
        const sortedLabels = [...labels].sort((a, b) => a.order - b.order);

        const plotTop = pad.top, plotBottom = height - pad.bottom;
        const plotLeft = pad.left, plotRight = width - pad.right;

        for (let labelIdx = 0; labelIdx < sortedLabels.length; labelIdx++) {
            const p = sortedLabels[labelIdx];
            const { textWidth, textHeight } = getLabelSize(p);
            const halfWidth = textWidth / 2;

            const isLeftEdge = p.id === 0;
            const isRightEdge = p.id === len - 1;
            const isMain = p.type === "main";

            const currentCurve = isMain ? temps : cooldownTemps;
            const otherCurve = isMain ? cooldownTemps : temps;

            const prevY = p.id > 0 ? ys(currentCurve[p.id - 1]) : null;
            const nextY = p.id < len - 1 ? ys(currentCurve[p.id + 1]) : null;
            const currentY = p.y;

            const isPeak = prevY !== null && nextY !== null && currentY < prevY && currentY < nextY;
            const isPit = prevY !== null && nextY !== null && currentY > prevY && currentY > nextY;

            let preferredAngle = 0;
            if (isLeftEdge) {
                preferredAngle = nextY < currentY ? 90 : -90;
            } else if (isRightEdge) {
                preferredAngle = prevY < currentY ? 90 : -90;
            } else {
                preferredAngle = isPeak ? -90 : isPit ? 90 : 0;
            }

            // Переупорядочивание статических 16-ти направлений на основе оригинального спирального смещения (offset)
            const orderedDirections = [];
            const angleOffsets = [0, 22.5, -22.5, 45, -45, 67.5, -67.5, 90];

            for (const side of [preferredAngle, preferredAngle + 180]) {
                for (const offset of angleOffsets) {
                    const targetAngle = ((side + offset + 180) % 360) - 180;

                    let match = STATIC_DIRECTIONS[0];
                    let minDiff = Infinity;

                    for (let d = 0; d < STATIC_DIRECTIONS.length; d++) {
                        let diff = Math.abs(STATIC_DIRECTIONS[d].angle - targetAngle);
                        if (diff > 180) diff = 360 - diff;
                        if (diff < minDiff) {
                            minDiff = diff;
                            match = STATIC_DIRECTIONS[d];
                        }
                    }

                    if (!orderedDirections.some(d => d.idx === match.idx)) {
                        orderedDirections.push(match);
                    }
                }
            }

            const getCandidate = (dirObj, distance) => {
                const dx = dirObj.vx * distance;
                const dy = dirObj.vy * distance;

                let textAnchor = "middle";
                if (isLeftEdge && dx < 0) return null;
                if (isRightEdge && dx > 0) return null;
                if (isLeftEdge && dx > 0.01) textAnchor = "start";
                if (isRightEdge && dx < -0.01) textAnchor = "end";

                const tx = p.x + dx;
                const ty = p.y + dy;

                let left, right;
                if (textAnchor === "start") { left = tx; right = tx + textWidth; }
                else if (textAnchor === "end") { right = tx; left = tx - textWidth; }
                else { left = tx - halfWidth; right = tx + halfWidth; }

                return {
                    angleDeg: dirObj.angle, dx, dy, textAnchor,
                    rect: {
                        left: left - 1, right: right + 1,
                        top: ty - textHeight / 2 - 0.5, bottom: ty + textHeight / 2 + 0.5
                    }
                };
            };

            let best = null;
            let bestScore = Infinity;

            for (let dIdx = 0; dIdx < orderedDirections.length; dIdx++) {
                const dirObj = orderedDirections[dIdx];

                for (let distIdx = 0; distIdx < LABEL_DISTANCES.length; distIdx++) {
                    const baseDistance = LABEL_DISTANCES[distIdx];
                    const angle = Math.abs(dirObj.angle) % 90;
                    const angleDistance = Math.min(angle, 90 - angle);
                    const distance = baseDistance + LABEL_RAY_DISTANCE * (1 - angleDistance / 45);
                    const candidate = getCandidate(dirObj, distance);

                    if (!candidate) continue;

                    const { rect } = candidate;
                    const labelCenter = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };

                    let score = dIdx * LABEL_PENALTIES.direction;

                    const rayDistance = getRayToRectPerimeterDistance(p, rect);
                    score += Math.pow(Math.max(0, rayDistance - 6), 2) * LABEL_PENALTIES.rayDistance;
                    score += distIdx * LABEL_PENALTIES.distance;

                    if (rect.left < plotLeft || rect.right > plotRight) continue;

                    if (rect.top < plotTop) {
                        const overflow = plotTop - rect.top;
                        score += LABEL_PENALTIES.topOverflowBase + overflow * overflow * LABEL_PENALTIES.topOverflowFactor;
                    }
                    if (rect.bottom > plotBottom) {
                        const overflow = rect.bottom - plotBottom;
                        score += LABEL_PENALTIES.bottomOverflowBase + overflow * overflow * LABEL_PENALTIES.bottomOverflowFactor;
                    }
                    if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
                        score += LABEL_PENALTIES.pointInside;
                    }

                    if (otherCurve) {
                        let rayCrossesOtherCurve = false;
                        for (let i = 0; i < len - 1; i++) {
                            if (segmentIntersectsSegment(p.x, p.y, labelCenter.x, labelCenter.y, xs(i * dxMm), ys(otherCurve[i]), xs((i + 1) * dxMm), ys(otherCurve[i + 1]))) {
                                rayCrossesOtherCurve = true;
                                break;
                            }
                        }
                        if (rayCrossesOtherCurve) score += 5000;
                    }

                    const minXPlot = rect.left - pad.left;
                    const maxXPlot = rect.right - pad.left;
                    const startIdx = Math.max(0, Math.floor((minXPlot / wPlot) * xMax / dxMm) - 1);
                    const endIdx = Math.min(len - 1, Math.floor((maxXPlot / wPlot) * xMax / dxMm) + 1);

                    score += getCurveOverlapRatio(currentCurve, startIdx, endIdx, rect) * LABEL_PENALTIES.curveOverlap;
                    if (otherCurve) {
                        score += getCurveOverlapRatio(otherCurve, startIdx, endIdx, rect) * LABEL_PENALTIES.curveOverlap;
                    }

                    let selfSegmentIntersects = false;
                    const selfStart = Math.max(0, p.id - 1);
                    const selfEnd = Math.min(len - 2, p.id + 1);
                    for (let i = selfStart; i <= selfEnd; i++) {
                        if (segmentIntersectsRect(xs(i * dxMm), ys(currentCurve[i]), xs((i + 1) * dxMm), ys(currentCurve[i + 1]), rect)) {
                            selfSegmentIntersects = true;
                            break;
                        }
                    }
                    if (selfSegmentIntersects) score += 2500;

                    for (let qIdx = 0; qIdx < placed.length; qIdx++) {
                        const q = placed[qIdx];
                        const overlapRatio = getRectOverlapRatio(rect, q);
                        if (overlapRatio > 0) {
                            score += overlapRatio * LABEL_PENALTIES.placedOverlap;
                        } else {
                            const gapX = Math.max(q.left - rect.right, rect.left - q.right, 0);
                            const gapY = Math.max(q.top - rect.bottom, rect.top - q.bottom, 0);
                            if (gapX < 4 && gapY < 4) score += LABEL_PENALTIES.placedNear;
                        }
                    }

                    if (score < bestScore) { best = candidate; bestScore = score; }
                    if (score <= LABEL_ACCEPTABLE_SCORE) break;
                }
                if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
            }

            if (!best) {
                // Фоллбэк-направление берем из статического массива (индексы 12 для -90° вверх и 4 для 90° вниз)
                const fallbackDirObj = isPeak ? STATIC_DIRECTIONS[12] : isPit ? STATIC_DIRECTIONS[4] : STATIC_DIRECTIONS[12];
                best = getCandidate(fallbackDirObj, 12) || {
                    dx: 0, dy: isPeak ? -12 : isPit ? 12 : -12, textAnchor: "middle",
                    rect: {
                        left: p.x - halfWidth - 2, right: p.x + halfWidth + 2,
                        top: p.y - textHeight / 2 - 1, bottom: p.y + textHeight / 2 + 1
                    }
                };
                bestScore = Infinity;
            }

            placed.push({
                ...p, dx: best.dx, dy: best.dy, score: bestScore,
                left: best.rect.left, right: best.rect.right,
                top: best.rect.top, bottom: best.rect.bottom, textAnchor: best.textAnchor
            });
        }

        const linesCount = Math.floor((tMax - tMin) / GRID_STEP_C) + 1;
        const gridLinesY = [];
        for (let i = 0; i < linesCount; i++) {
            const t = tMin + i * GRID_STEP_C;
            gridLinesY.push({ id: t, y: ys(t), isSpecial: isSpecialTemperature(t) });
        }

        return {
            width, height, pad, wPlot, xMax, xCenter, formingTop, formingBottom, tMin, tMax, gridLinesY,
            yDecomposition: typeof decompositionTemp === "number" ? ys(decompositionTemp) : null,
            yMaxForming: hasFormingRange ? ys(maxFormingTemp) : null,
            yMinForming: hasFormingRange ? ys(minFormingTemp) : null,
            yTopEdge: ys(tMax), yBottomEdge: ys(tMin),
            dPath: makePath(temps), cooldownPath: hasCooldown ? makePath(cooldownTemps) : null,
            hasCooldown, chartColor, cooldownColor,
            minColor: theme.palette.info.main, maxColor: theme.palette.error.main,
            minIdx, maxIdx, minCoolIdx, maxCoolIdx, placed,
            borderColor: data?.status?.type === "error" ? theme.palette.error.main : data?.status?.type === "warning" ? theme.palette.warning.main : theme.palette.divider,
            decompositionTemp, minFormingTemp, maxFormingTemp, hasFormingRange,
            heatingSec: formatTime(data?.heatingTimeSeconds), cooldownSec: data?.cooldownTimeSec,
            maxV, minV, maxCoolV, minCoolV
        };
    }, [data, material, theme]);

    if (!chartData) return null;

    const {
        width, height, pad, wPlot, xMax, xCenter, formingTop, formingBottom, tMin, tMax, gridLinesY,
        yDecomposition, yMaxForming, yMinForming, yTopEdge, yBottomEdge, dPath, cooldownPath, hasCooldown,
        chartColor, cooldownColor, minColor, maxColor, minIdx, maxIdx, minCoolIdx, maxCoolIdx, placed,
        borderColor, decompositionTemp, minFormingTemp, maxFormingTemp, hasFormingRange, heatingSec,
        cooldownSec, maxV, minV, maxCoolV, minCoolV
    } = chartData;

    return (
        <Paper sx={{ border: "1px solid", borderColor, p: 0.5, fontFamily: '"Roboto Mono","SF Mono",monospace', boxShadow: "none" }}>
            <svg width={width} height={height} style={{ display: "block" }} shapeRendering="geometricPrecision">
                {hasFormingRange && (
                    <>
                        <rect x={pad.left} y={formingTop} width={wPlot} height={formingBottom - formingTop} fill={theme.palette.success.main} opacity=".05" />
                        <line x1={pad.left} y1={formingTop} x2={width - pad.right} y2={formingTop} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />
                        <line x1={pad.left} y1={formingBottom} x2={width - pad.right} y2={formingBottom} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />
                    </>
                )}

                {gridLinesY.map(({ id, y, isSpecial }, i) =>
                    i > 0 && !isSpecial && <line key={id} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                )}

                <line x1={xCenter} y1={pad.top} x2={xCenter} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />

                {typeof decompositionTemp === "number" && decompositionTemp >= tMin && decompositionTemp <= tMax && (
                    <>
                        <line x1={pad.left} y1={yDecomposition} x2={width - pad.right} y2={yDecomposition} stroke={theme.palette.error.main} strokeWidth={1} strokeDasharray="4 2" opacity=".5" />
                        <text x={pad.left - 5} y={yDecomposition + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.error.main}>{decompositionTemp}°</text>
                    </>
                )}

                {hasFormingRange && (
                    <>
                        <text x={pad.left - 5} y={yMaxForming + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>{maxFormingTemp}°</text>
                        <text x={pad.left - 5} y={yMinForming + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>{minFormingTemp}°</text>
                    </>
                )}

                {hasCooldown && <path d={cooldownPath} fill="none" stroke={cooldownColor} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />}
                <path d={dPath} fill="none" stroke={chartColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                {placed.map(p => {
                    const isMin = p.id === (p.type === "cooldown" ? minCoolIdx : minIdx);
                    const isMax = p.id === (p.type === "cooldown" ? maxCoolIdx : maxIdx);
                    return (
                        <g key={`${p.type}-${p.id}`}>
                            <circle cx={p.x} cy={p.y} r={p.type === "cooldown" ? 2.5 : 3} fill={isMin ? minColor : isMax ? maxColor : p.color} stroke={theme.palette.background.paper} strokeWidth={1} opacity={p.type === "cooldown" ? 0.6 : 1} />
                            <text x={p.x + p.dx} y={p.y + p.dy} textAnchor={p.textAnchor} dominantBaseline="middle" fontSize={p.type === "cooldown" ? 8.5 : 9} fontWeight="bold" fill={p.color}>{Math.round(p.val)}°</text>
                        </g>
                    );
                })}

                <text x={xCenter} y={14} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill={chartColor}>Heating: {heatingSec} (ΔT = {(maxV - minV).toFixed(1)}°C)</text>
                {yTopEdge !== null && (!hasFormingRange || Math.abs(yTopEdge - yMaxForming) > 8) && (typeof decompositionTemp !== "number" || Math.abs(yTopEdge - yDecomposition) > 8) && (
                    <text x={pad.left - 5} y={yTopEdge + 3} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>{tMax}°</text>
                )}
                {yBottomEdge !== null && (!hasFormingRange || Math.abs(yBottomEdge - yMinForming) > 8) && (
                    <text x={pad.left - 5} y={yBottomEdge + 3} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>{tMin}°</text>
                )}

                <text x={pad.left} y={height - 22} textAnchor="start" fontSize={8.5} fill={theme.palette.text.secondary}>0 mm</text>
                <text x={width - pad.right} y={height - 22} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>{xMax.toFixed(0)} mm</text>

                {typeof cooldownSec === "number" && (
                    <text x={xCenter} y={height - 6} textAnchor="middle" fontSize={8.5} fontWeight="500" fill={theme.palette.text.secondary}>Pause: {cooldownSec}s {hasCooldown && `(ΔT = ${(maxCoolV - minCoolV).toFixed(1)}°C)`}</text>
                )}
            </svg>
        </Paper>
    );
});

TemperatureProfileChart.displayName = "TemperatureProfileChart";