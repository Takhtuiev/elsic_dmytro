import React, { memo, useMemo } from "react";
import { Paper, useTheme } from "@mui/material";

const GRID_STEP_C = 10;

const LABEL_DISTANCES = [6, 10, 14];
const LABEL_ANGLE_STEP = 15;
const LABEL_ACCEPTABLE_SCORE = 500;

const LABEL_PENALTIES = {
        edge: 10000,                // Штраф за направление к близкой границе графика
        placedOverlap: 4000,        // Штраф за перекрытие уже размещённой подписи
        placedNear: 500,            // Штраф за слишком близкое расположение к другой подписи
        perPointInsideFactor: 1000,  // Штраф за каждую накрытую точку графика (умножается на их количество)
        topOverflowBase: 50,        // Базовый штраф за выход за верхнюю границу SVG
        topOverflowFactor: 8,       // Множитель штрафа за глубину выхода сверху
        bottomOverflowBase: 50,     // Базовый штраф за выход за нижнюю границу SVG
        bottomOverflowFactor: 8,    // Множитель штрафа за глубину выхода снизу
        direction: 15,              // Штраф за порядковый номер направления (угол)
        rayDistance: 4,             // Штраф за расстояние от точки до края подписи
        distance: 5,                // Штраф за увеличение радиуса отступа от точки
        nextCurveDirection: -20     // Бонус (скидка) за направление по ходу своей кривой
};

// Статический кэш тригонометрии
const DIRECTION_VECTORS = Array.from({ length: 360 / LABEL_ANGLE_STEP }, (_, i) => {
    const angleDeg = i * LABEL_ANGLE_STEP;
    const rad = (angleDeg * Math.PI) / 180;
    return {
        angleDeg: angleDeg > 180 ? angleDeg - 360 : angleDeg,
        x: Math.cos(rad),
        y: Math.sin(rad)
    };
});

export const formatTime = seconds => {
    if (!seconds || seconds < 0) return "0m 00s";
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

const getRayToRectPerimeterDistance = (px, py, left, right, top, bottom) => {
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    const rayX = centerX - px, rayY = centerY - py;
    const rayLength = Math.hypot(rayX, rayY);
    if (rayLength < 0.00001) return 0;
    const ux = rayX / rayLength, uy = rayY / rayLength;

    let minT = rayLength;
    if (Math.abs(ux) > 0.00001) {
        const tLeft = (left - px) / ux;
        if (tLeft >= 0 && (py + uy * tLeft) >= top && (py + uy * tLeft) <= bottom) minT = Math.min(minT, tLeft);
        const tRight = (right - px) / ux;
        if (tRight >= 0 && (py + uy * tRight) >= top && (py + uy * tRight) <= bottom) minT = Math.min(minT, tRight);
    }
    if (Math.abs(uy) > 0.00001) {
        const tTop = (top - py) / uy;
        if (tTop >= 0 && (px + ux * tTop) >= left && (px + ux * tTop) <= right) minT = Math.min(minT, tTop);
        const tBottom = (bottom - py) / uy;
        if (tBottom >= 0 && (px + ux * tBottom) >= left && (px + ux * tBottom) <= right) minT = Math.min(minT, tBottom);
    }
    return minT;
};

export const TemperatureProfileChart = memo(({ data, material }) => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        const temps = data?.temperatureProfile?.temperaturesC;
        const cooldownTemps = data?.temperatureProfile?.cooldownProfileC;
        const dxMm = data?.temperatureProfile?.dxMm;
        if (!temps?.length || temps.length < 2 || typeof dxMm !== "number") return null;

        const width = 300, height = 150, len = temps.length;
        const hasCooldown = cooldownTemps?.length === len;
        const pad = { left: 36, right: 16, top: 27, bottom: 39 };
        const wPlot = width - pad.left - pad.right;
        const hPlot = height - pad.top - pad.bottom;
        const xMax = (len - 1) * dxMm, xDelta = xMax || 1;
        const xs = x => pad.left + (x / xDelta) * wPlot;

        let minIdx = 0, maxIdx = 0, minV = Infinity, maxV = -Infinity;
        let minCoolIdx = 0, maxCoolIdx = 0, minCoolV = Infinity, maxCoolV = -Infinity;

        for (let i = 0; i < len; i++) {
            const t = temps[i];
            if (t < minV) { minV = t; minIdx = i; }
            if (t > maxV) { maxV = t; maxIdx = i; }
            if (hasCooldown) {
                const ct = cooldownTemps[i];
                if (ct < minCoolV) { minCoolV = ct; minCoolIdx = i; }
                if (ct > maxCoolV) { maxCoolV = ct; maxCoolIdx = i; }
            }
        }

        const minFormingTemp = material?.minFormingTemp;
        const maxFormingTemp = material?.maxFormingTemp;
        const decompositionTemp = material?.decompositionTemp;
        const hasFormingRange = typeof minFormingTemp === "number" && typeof maxFormingTemp === "number" && maxFormingTemp > minFormingTemp;

        let rMin = minV, rMax = maxV;
        if (hasCooldown) {
            if (minCoolV < rMin) rMin = minCoolV;
            if (maxCoolV > rMax) rMax = maxCoolV;
        }
        if (typeof minFormingTemp === "number") {
            if (minFormingTemp < rMin) rMin = minFormingTemp;
            if (minFormingTemp > rMax) rMax = minFormingTemp;
        }
        if (typeof maxFormingTemp === "number") {
            if (maxFormingTemp < rMin) rMin = maxFormingTemp;
            if (maxFormingTemp > rMax) rMax = maxFormingTemp;
        }

        let tMin = Math.floor(rMin / GRID_STEP_C) * GRID_STEP_C;
        let tMax = Math.ceil(rMax / GRID_STEP_C) * GRID_STEP_C;

        if (typeof decompositionTemp === "number" && decompositionTemp > tMax && decompositionTemp - rMax <= GRID_STEP_C * 1.5) tMax = decompositionTemp;        if (tMax === tMin) { tMin -= GRID_STEP_C; tMax += GRID_STEP_C; }

        const tDelta = tMax - tMin;
        const ys = t => pad.top + ((tMax - t) / tDelta) * hPlot;
        const xCenter = xs(xMax / 2);

        const formingTop = hasFormingRange ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(maxFormingTemp))) : null;
        const formingBottom = hasFormingRange ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(minFormingTemp))) : null;

        const isSameTemperature = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.1;
        const isSpecialTemperature = t => isSameTemperature(minFormingTemp, t) || isSameTemperature(maxFormingTemp, t) || isSameTemperature(decompositionTemp, t);

        const makePath = values => {
            let d = `M ${xs(0)} ${ys(values[0])}`;
            for (let i = 0; i < values.length - 1; i++) {
                const x0 = xs((i > 0 ? i - 1 : 0) * dxMm), x1 = xs(i * dxMm), x2 = xs((i + 1) * dxMm), x3 = xs(Math.min(i + 2, values.length - 1) * dxMm);
                const y0 = ys(values[i > 0 ? i - 1 : 0]), y1 = ys(values[i]), y2 = ys(values[i + 1]), y3 = ys(values[Math.min(i + 2, values.length - 1)]);
                d += ` C ${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`;
            }
            return d;
        };

        const chartColor = theme.palette.text.primary;
        const cooldownColor = theme.palette.text.secondary;

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
                        ...p,
                        type,
                        order: p.id === 0 || p.id === len - 1 ? 0 : 1,
                        color: type === "cooldown" ? cooldownColor : chartColor,
                        x: xs(p.id * dxMm),
                        y: ys(p.val)
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

        for (let i = 0; i < sortedLabels.length; i++) {
            const p = sortedLabels[i];
            const textWidth = `${Math.round(p.val)}°`.length * 6.2;
            const halfWidth = textWidth / 2;
            const isLeftEdge = p.id === 0, isRightEdge = p.id === len - 1, isMain = p.type === "main";
            const currentCurve = isMain ? temps : cooldownTemps;

            const prevY = p.id > 0 ? ys(currentCurve[p.id - 1]) : null;
            const nextY = p.id < len - 1 ? ys(currentCurve[p.id + 1]) : null;
            const currentY = p.y;

            const isPeak = prevY !== null && nextY !== null && currentY < prevY && currentY < nextY;
            const isPit = prevY !== null && nextY !== null && currentY > prevY && currentY > nextY;

            const plotTop = pad.top, plotBottom = height - pad.bottom, plotLeft = pad.left, plotRight = width - pad.right;
            const edgeMargin = 18;
            const distanceToTop = p.y - plotTop, distanceToBottom = plotBottom - p.y, distanceToLeft = p.x - plotLeft, distanceToRight = plotRight - p.x;

            let preferredAngle = 0;
            if (isLeftEdge) preferredAngle = nextY < currentY ? 90 : -90;
            else if (isRightEdge) preferredAngle = prevY < currentY ? 90 : -90;
            else preferredAngle = isPeak ? -90 : (isPit ? 90 : 0);

            // Оптимизация: Маппинг и сортировка направлений
            const directionsWithScore = DIRECTION_VECTORS.map(v => {
                let edgePenalty = 0;
                if (distanceToTop < edgeMargin && v.y < 0) edgePenalty += LABEL_PENALTIES.edge;
                if (distanceToBottom < edgeMargin && v.y > 0) edgePenalty += LABEL_PENALTIES.edge;
                if (distanceToLeft < edgeMargin && v.x < 0) edgePenalty += LABEL_PENALTIES.edge;
                if (distanceToRight < edgeMargin && v.x > 0) edgePenalty += LABEL_PENALTIES.edge;

                let diff = Math.abs(v.angleDeg - preferredAngle);
                if (diff > 180) diff = 360 - diff;

                return { vec: v, sortingScore: edgePenalty + (diff / LABEL_ANGLE_STEP) };
            }).sort((a, b) => a.sortingScore - b.sortingScore);

            let best = null, bestScore = Infinity;

            for (let dIdx = 0; dIdx < directionsWithScore.length; dIdx++) {
                const vec = directionsWithScore[dIdx].vec;

                for (let distIdx = 0; distIdx < LABEL_DISTANCES.length; distIdx++) {
                    const distance = LABEL_DISTANCES[distIdx];
                    const dx = vec.x * distance, dy = vec.y * distance;

                    if ((isLeftEdge && dx < 0) || (isRightEdge && dx > 0)) continue;

                    let textAnchor = "middle";
                    if (isLeftEdge && dx > 0.01) textAnchor = "start";
                    if (isRightEdge && dx < -0.01) textAnchor = "end";

                    const tx = p.x + dx, ty = p.y + dy;
                    let left, right;
                    if (textAnchor === "start") { left = tx; right = tx + textWidth; }
                    else if (textAnchor === "end") { right = tx; left = tx - textWidth; }
                    else { left = tx - halfWidth; right = tx + halfWidth; }

                    const rLeft = left - 2, rRight = right + 2, rTop = ty - 7, rBottom = ty + 7;

                    if (rLeft < plotLeft || rRight > plotRight) continue;

                    let score = dIdx * LABEL_PENALTIES.direction;
                    const rayDistance = getRayToRectPerimeterDistance(p.x, p.y, rLeft, rRight, rTop, rBottom);
                    score += Math.pow(Math.max(0, rayDistance - 6), 2) * LABEL_PENALTIES.rayDistance;
                    score += distIdx * LABEL_PENALTIES.distance;

                    if (rTop < plotTop) {
                        const overflow = plotTop - rTop;
                        score += LABEL_PENALTIES.topOverflowBase + overflow * overflow * LABEL_PENALTIES.topOverflowFactor;
                    }
                    if (rBottom > plotBottom) {
                        const overflow = rBottom - plotBottom;
                        score += LABEL_PENALTIES.bottomOverflowBase + overflow * overflow * LABEL_PENALTIES.bottomOverflowFactor;
                    }

                    if (p.x >= rLeft && p.x <= rRight && p.y >= rTop && p.y <= rBottom) score += LABEL_PENALTIES.perPointInsideFactor;

                    // Сканирование точек графика, попадающих в диапазон X прямоугольника подписи
                    const minXPlot = rLeft - pad.left;
                    const maxXPlot = rRight - pad.left;

                    const startIdx = Math.max(0, Math.floor(((minXPlot / wPlot) * xMax) / dxMm));
                    const endIdx = Math.min(len - 1, Math.floor(((maxXPlot / wPlot) * xMax) / dxMm) + 1);

                    // Определяем альтернативную (вторую) кривую для проверки
                    const otherCurve = isMain ? cooldownTemps : temps;
                    let pointsInsideCount = 0;

                    for (let tIdx = startIdx; tIdx <= endIdx; tIdx++) {
                        const ptX = xs(tIdx * dxMm);

                        // 1. Сканируем свою кривую (текущую точку p.id пропускаем)
                        if (tIdx !== p.id) {
                            const ptY = ys(currentCurve[tIdx]);
                            if (ptX >= rLeft - 2 && ptX <= rRight + 2 && ptY >= rTop - 2 && ptY <= rBottom + 2) {
                                pointsInsideCount++;
                            }
                        }

                        // 2. Сканируем вторую кривую (если график охлаждения активен)
                        if (hasCooldown && otherCurve) {
                            // Здесь проверяем все точки, включая ту, что совпадает по индексу с p.id (на чужой линии это валидный узел)
                            const ptY = ys(otherCurve[tIdx]);
                            if (ptX >= rLeft - 2 && ptX <= rRight + 2 && ptY >= rTop - 2 && ptY <= rBottom + 2) {
                                pointsInsideCount++;
                            }
                        }
                    }

                    // Накопительный штраф: чем больше точек накрыло, тем выше итоговый score
                    if (pointsInsideCount > 0) {
                        score += pointsInsideCount * LABEL_PENALTIES.perPointInsideFactor;
                    }


                    // Проверка наложения на уже размещенные подписи
                    for (let qIdx = 0; qIdx < placed.length; qIdx++) {
                        const q = placed[qIdx];
                        if (rLeft < q.right && rRight > q.left && rTop < q.bottom && rBottom > q.top) {
                            score += LABEL_PENALTIES.placedOverlap;
                        } else {
                            const gapX = Math.max(q.left - rRight, rLeft - q.right, 0);
                            const gapY = Math.max(q.top - rBottom, rTop - q.bottom, 0);
                            if (gapX < 4 && gapY < 4) score += LABEL_PENALTIES.placedNear;
                        }
                    }

                    if (nextY !== null && nextY < currentY - 6 && dy < 0) score += LABEL_PENALTIES.nextCurveDirection;
                    if (nextY !== null && nextY > currentY + 6 && dy > 0) score += LABEL_PENALTIES.nextCurveDirection;

                    if (score < bestScore) {
                        best = { dx, dy, textAnchor, rect: { left: rLeft, right: rRight, top: rTop, bottom: rBottom } };
                        bestScore = score;
                    }
                    if (score <= LABEL_ACCEPTABLE_SCORE) break;
                }
                if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
            }

            if (!best) {
                const fallbackDy = isPeak ? -12 : (isPit ? 12 : -12);
                best = { dx: 0, dy: fallbackDy, textAnchor: "middle", rect: { left: p.x - halfWidth - 2, right: p.x + halfWidth + 2, top: p.y - 7, bottom: p.y + 7 } };
                bestScore = Infinity;
            }

            placed.push({
                ...p,
                dx: best.dx,
                dy: best.dy,
                score: bestScore,
                left: best.rect.left,
                right: best.rect.right,
                top: best.rect.top,
                bottom: best.rect.bottom,
                textAnchor: best.textAnchor
            });
        }

        return {
            width, height, pad, wPlot, hPlot, xMax, xs, ys, xCenter,
            formingTop, formingBottom, isSpecialTemperature, tMin, tMax,
            dPath: makePath(temps),
            cooldownPath: hasCooldown ? makePath(cooldownTemps) : null,
            hasCooldown, chartColor, cooldownColor,
            minColor: theme.palette.info.main,
            maxColor: theme.palette.error.main,
            minIdx, maxIdx, minCoolIdx, maxCoolIdx, placed,
            borderColor: data?.status?.type === "error" ? theme.palette.error.main : data?.status?.type === "warning" ? theme.palette.warning.main : theme.palette.divider,
            decompositionTemp, minFormingTemp, maxFormingTemp, hasFormingRange,
            heatingSec: formatTime(data?.heatingTimeSeconds),
            cooldownSec: data?.cooldownTimeSec,
            maxV, minV, maxCoolV, minCoolV
        };
    }, [data, material, theme]);

    if (!chartData) return null;

    const {
        width, height, pad, wPlot, xMax, xs, ys, xCenter,
        formingTop, formingBottom, isSpecialTemperature, tMin, tMax,
        dPath, cooldownPath, hasCooldown, chartColor, cooldownColor,
        minColor, maxColor, minIdx, maxIdx, minCoolIdx, maxCoolIdx,
        placed, borderColor, decompositionTemp, minFormingTemp, maxFormingTemp,
        hasFormingRange, heatingSec, cooldownSec, maxV, minV, maxCoolV, minCoolV
    } = chartData;

    return (
        <Paper sx={{ border: "1px solid", borderColor, p: 0.5, fontFamily: '"Roboto Mono","SF Mono",monospace', boxShadow: "none" }}>
            <svg width={width} height={height} style={{ display: "block" }} shapeRendering="geometricPrecision">
                {hasFormingRange && (
                    <>
                        <rect x={pad.left} y={formingTop} width={wPlot} height={formingBottom - formingTop} fill={theme.palette.success.main} opacity=".05" />
                        {formingTop > pad.top && <line x1={pad.left} y1={formingTop} x2={width - pad.right} y2={formingTop} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />}
                        {formingBottom < height - pad.bottom && <line x1={pad.left} y1={formingBottom} x2={width - pad.right} y2={formingBottom} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />}
                    </>
                )}

                {Array.from({ length: Math.floor((tMax - tMin) / GRID_STEP_C) + 1 }, (_, i) => tMin + i * GRID_STEP_C).map((t, i) =>
                    i > 0 && !isSpecialTemperature(t) && <line key={t} x1={pad.left} y1={ys(t)} x2={width - pad.right} y2={ys(t)} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                )}

                <line x1={xCenter} y1={pad.top} x2={xCenter} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />

                {typeof decompositionTemp === "number" && decompositionTemp >= tMin && decompositionTemp <= tMax && (
                    <>
                        <line x1={pad.left} y1={ys(decompositionTemp)} x2={width - pad.right} y2={ys(decompositionTemp)} stroke={theme.palette.error.main} strokeWidth={1} strokeDasharray="4 2" opacity=".5" />
                        <text x={pad.left - 5} y={ys(decompositionTemp) + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.error.main}>{decompositionTemp}°</text>
                    </>
                )}

                {hasFormingRange && (
                    <>
                        <text x={pad.left - 5} y={ys(maxFormingTemp) + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>{maxFormingTemp}°</text>
                        <text x={pad.left - 5} y={ys(minFormingTemp) + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>{minFormingTemp}°</text>
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
                {!isSpecialTemperature(tMax) && <text x={pad.left - 5} y={pad.top + 3} textAnchor="end" fontSize={8} fill={theme.palette.text.secondary}>{tMax}°</text>}
                {!isSpecialTemperature(tMin) && <text x={pad.left - 5} y={height - pad.bottom + 3} textAnchor="end" fontSize={8} fill={theme.palette.text.secondary}>{tMin}°</text>}
                <text x={pad.left} y={height - 22} textAnchor="middle" fontSize={8.5} fill={theme.palette.text.secondary}>0 mm</text>
                <text x={width - pad.right} y={height - 22} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>{xMax.toFixed(0)} mm</text>
                {typeof cooldownSec === "number" && <text x={xCenter} y={height - 6} textAnchor="middle" fontSize={8.5} fontWeight="500" fill={theme.palette.text.secondary}>Pause: {cooldownSec}s {hasCooldown && `(ΔT = ${(maxCoolV - minCoolV).toFixed(1)}°C)`}</text>}
            </svg>
        </Paper>
    );
});
