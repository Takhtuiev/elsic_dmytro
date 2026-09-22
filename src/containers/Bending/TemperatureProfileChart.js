import React, { memo, useMemo } from "react";
import { Paper, useTheme } from "@mui/material";

const GRID_STEP_C = 10;
const CURVE_OVERLAP_STEPS = 4;

const LABEL_DISTANCES = [6, 10, 14];
const LABEL_ANGLE_STEP = 15;
const LABEL_ACCEPTABLE_SCORE = 500;

const LABEL_PENALTIES = {
    edge: 10000,
    placedOverlap: 4000,
    placedNear: 500,
    curveOverlap: 1200,
    pointInside: 1000,
    topOverflowBase: 50,
    topOverflowFactor: 8,
    bottomOverflowBase: 50,
    bottomOverflowFactor: 8,
    direction: 15,
    rayDistance: 4,
    distance: 5,
    nextCurveDirection: -20
};

export const formatTime = seconds => {
    if (!seconds || seconds < 0) return "0m 00s";
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

export const TemperatureProfileChart = memo(({ data, material }) => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        const temps = data?.temperatureProfile?.temperaturesC;
        const cooldownTemps = data?.temperatureProfile?.cooldownProfileC;
        const dxMm = data?.temperatureProfile?.dxMm;

        // Защита от некорректных данных и бесконечных циклов (dxMm <= 0)
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
            if (temps[i] < minV) {
                minV = temps[i];
                minIdx = i;
            }
            if (temps[i] > maxV) {
                maxV = temps[i];
                maxIdx = i;
            }

            if (hasCooldown) {
                if (cooldownTemps[i] < minCoolV) {
                    minCoolV = cooldownTemps[i];
                    minCoolIdx = i;
                }
                if (cooldownTemps[i] > maxCoolV) {
                    maxCoolV = cooldownTemps[i];
                    maxCoolIdx = i;
                }
            }
        }

        const minFormingTemp = material?.minFormingTemp;
        const maxFormingTemp = material?.maxFormingTemp;
        const decompositionTemp = material?.decompositionTemp;

        const hasFormingRange =
            typeof minFormingTemp === "number" &&
            typeof maxFormingTemp === "number" &&
            maxFormingTemp > minFormingTemp;

        const rangeTemps = [
            ...temps,
            ...(hasCooldown ? cooldownTemps : []),
            ...(typeof minFormingTemp === "number" ? [minFormingTemp] : []),
            ...(typeof maxFormingTemp === "number" ? [maxFormingTemp] : [])
        ];

        let tMin = Math.floor(Math.min(...rangeTemps) / GRID_STEP_C) * GRID_STEP_C;
        let tMax = Math.ceil(Math.max(...rangeTemps) / GRID_STEP_C) * GRID_STEP_C;

        if (
            typeof decompositionTemp === "number" &&
            decompositionTemp > tMax &&
            decompositionTemp - tMax <= GRID_STEP_C * 1.5
        ) {
            tMax = decompositionTemp;
        }

        if (tMax === tMin) {
            tMin -= GRID_STEP_C;
            tMax += GRID_STEP_C;
        }

        const tDelta = tMax - tMin;

        const xs = x => pad.left + (x / xDelta) * wPlot;
        const ys = t => pad.top + ((tMax - t) / tDelta) * hPlot;

        const xCenter = xs(xMax / 2);

        const formingTop = hasFormingRange
            ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(maxFormingTemp)))
            : null;

        const formingBottom = hasFormingRange
            ? Math.max(pad.top, Math.min(pad.top + hPlot, ys(minFormingTemp)))
            : null;

        const isSameTemperature = (a, b) =>
            typeof a === "number" &&
            typeof b === "number" &&
            Math.abs(a - b) < 0.1;

        const isSpecialTemperature = t =>
            [minFormingTemp, maxFormingTemp, decompositionTemp]
                .some(b => isSameTemperature(b, t));

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

        const makeCurveSegments = values => {
            const segments = [];
            for (let i = 0; i < values.length - 1; i++) {
                const x0 = xs((i > 0 ? i - 1 : 0) * dxMm);
                const x1 = xs(i * dxMm);
                const x2 = xs((i + 1) * dxMm);
                const x3 = xs(Math.min(i + 2, values.length - 1) * dxMm);

                const y0 = ys(values[i > 0 ? i - 1 : 0]);
                const y1 = ys(values[i]);
                const y2 = ys(values[i + 1]);
                const y3 = ys(values[Math.min(i + 2, values.length - 1)]);

                const c1 = { x: x1 + (x2 - x0) / 6, y: y1 + (y2 - y0) / 6 };
                const c2 = { x: x2 - (x3 - x1) / 6, y: y2 - (y3 - y1) / 6 };
                const p0 = { x: x1, y: y1 };
                const p3 = { x: x2, y: y2 };

                let prev = p0;
                const steps = 12;

                for (let j = 1; j <= steps; j++) {
                    const t = j / steps;
                    const u = 1 - t;
                    const point = {
                        x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
                        y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y
                    };
                    segments.push([prev, point]);
                    prev = point;
                }
            }
            return segments;
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
            const res = [];
            const seen = new Set();

            for (const p of raw.sort((a, b) => b.p - a.p)) {
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

        const mainSegments = makeCurveSegments(temps);
        const cooldownSegments = hasCooldown ? makeCurveSegments(cooldownTemps) : [];
        const placed = [];

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

        const getRayToRectPerimeterDistance = (point, rect) => {
            const centerX = (rect.left + rect.right) / 2;
            const centerY = (rect.top + rect.bottom) / 2;
            const rayX = centerX - point.x;
            const rayY = centerY - point.y;
            const rayLength = Math.hypot(rayX, rayY);

            if (rayLength < 0.00001) return 0;

            const ux = rayX / rayLength;
            const uy = rayY / rayLength;
            const intersections = [];

            if (Math.abs(ux) > 0.00001) {
                const tLeft = (rect.left - point.x) / ux;
                const yLeft = point.y + uy * tLeft;
                if (tLeft >= 0 && yLeft >= rect.top && yLeft <= rect.bottom) intersections.push(tLeft);

                const tRight = (rect.right - point.x) / ux;
                const yRight = point.y + uy * tRight;
                if (tRight >= 0 && yRight >= rect.top && yRight <= rect.bottom) intersections.push(tRight);
            }

            if (Math.abs(uy) > 0.00001) {
                const tTop = (rect.top - point.y) / uy;
                const xTop = point.x + ux * tTop;
                if (tTop >= 0 && xTop >= rect.left && xTop <= rect.right) intersections.push(tTop);

                const tBottom = (rect.bottom - point.y) / uy;
                const xBottom = point.x + ux * tBottom;
                if (tBottom >= 0 && xBottom >= rect.left && xBottom <= rect.right) intersections.push(tBottom);
            }
            return intersections.length ? Math.min(...intersections) : rayLength;
        };

        const moveDirection = angle => {
            const rad = angle * Math.PI / 180;
            return { x: Math.cos(rad), y: Math.sin(rad) };
        };

        const getCurveOverlapRatio = (curve, startIdx, endIdx, rLeft, rRight, rTop, rBottom) => {
            if (!curve || curve.length < 2 || endIdx <= startIdx) return 0;
            let totalLength = 0;
            let insideLength = 0;

            for (let i = startIdx; i < endIdx; i++) {
                const x0 = xs(i * dxMm);
                const x1 = xs((i + 1) * dxMm);
                if (x1 < rLeft || x0 > rRight) continue;

                const y0 = ys(curve[i]);
                const y1 = ys(curve[i + 1]);
                const segmentDx = x1 - x0;
                const segmentDy = y1 - y0;
                const segmentLength = Math.hypot(segmentDx, segmentDy);

                if (segmentLength <= 0) continue;
                totalLength += segmentLength;

                const segmentLeft = Math.min(x0, x1);
                const segmentRight = Math.max(x0, x1);
                const segmentTop = Math.min(y0, y1);
                const segmentBottom = Math.max(y0, y1);

                if (segmentRight < rLeft || segmentLeft > rRight || segmentBottom < rTop || segmentTop > rBottom) continue;

                let prevX = x0;
                let prevY = y0;
                let prevInside = prevX >= rLeft && prevX <= rRight && prevY >= rTop && prevY <= rBottom;

                for (let s = 1; s <= CURVE_OVERLAP_STEPS; s++) {
                    const t = s / CURVE_OVERLAP_STEPS;
                    const currentX = x0 + segmentDx * t;
                    const currentY = y0 + segmentDy * t;
                    const currentInside = currentX >= rLeft && currentX <= rRight && currentY >= rTop && currentY <= rBottom;
                    const partLength = Math.hypot(currentX - prevX, currentY - prevY);

                    if (prevInside && currentInside) {
                        insideLength += partLength;
                    } else if (prevInside !== currentInside) {
                        insideLength += partLength * 0.5;
                    }
                    prevX = currentX;
                    prevY = currentY;
                    prevInside = currentInside;
                }
            }
            return totalLength > 0 ? Math.min(1, insideLength / totalLength) : 0;
        };

        for (const p of [...labels].sort((a, b) => a.order - b.order)) {
            const textWidth = `${Math.round(p.val)}°`.length * 6.2;
            const halfWidth = textWidth / 2;

            const isLeftEdge = p.id === 0;
            const isRightEdge = p.id === len - 1;
            const isMain = p.type === "main";

            const currentCurve = isMain ? temps : cooldownTemps;
            const otherSegments = isMain ? cooldownSegments : mainSegments;

            const prevY = p.id > 0 ? ys(currentCurve[p.id - 1]) : null;
            const nextY = p.id < len - 1 ? ys(currentCurve[p.id + 1]) : null;
            const currentY = p.y;

            const isPeak = prevY !== null && nextY !== null && currentY < prevY && currentY < nextY;
            const isPit = prevY !== null && nextY !== null && currentY > prevY && currentY > nextY;

            const plotTop = pad.top;
            const plotBottom = height - pad.bottom;
            const plotLeft = pad.left;
            const plotRight = width - pad.right;
            const edgeMargin = 18;

            const distanceToTop = p.y - plotTop;
            const distanceToBottom = plotBottom - p.y;
            const distanceToLeft = p.x - plotLeft;
            const distanceToRight = plotRight - p.x;

            const getEdgePenalty = angle => {
                const dir = moveDirection(angle);
                let penalty = 0;
                if (distanceToTop < edgeMargin && dir.y < 0) penalty += LABEL_PENALTIES.edge;
                if (distanceToBottom < edgeMargin && dir.y > 0) penalty += LABEL_PENALTIES.edge;
                if (distanceToLeft < edgeMargin && dir.x < 0) penalty += LABEL_PENALTIES.edge;
                if (distanceToRight < edgeMargin && dir.x > 0) penalty += LABEL_PENALTIES.edge;
                return penalty;
            };

            let preferredAngle = 0;
            if (isLeftEdge) preferredAngle = nextY < currentY ? 90 : -90;
            else if (isRightEdge) preferredAngle = prevY < currentY ? 90 : -90;
            else preferredAngle = isPeak ? -90 : isPit ? 90 : 0;

            const directionAngles = [];
            for (let i = 0; i < 360 / LABEL_ANGLE_STEP; i++) {
                const offset = i === 0 ? 0 : (i % 2 === 1 ? Math.ceil(i / 2) : -Math.floor(i / 2));
                directionAngles.push((((preferredAngle + offset * LABEL_ANGLE_STEP + 180) % 360) - 180));
            }

            const orderedDirections = [...directionAngles].sort((a, b) => getEdgePenalty(a) - getEdgePenalty(b));

            const getCandidate = (angleDeg, distance) => {
                const angle = angleDeg * Math.PI / 180;
                const dx = Math.cos(angle) * distance;
                const dy = Math.sin(angle) * distance;
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
                    angleDeg, dx, dy, textAnchor,
                    rect: { left: left - 2, right: right + 2, top: ty - 7, bottom: ty + 7 }
                };
            };

            let best = null;
            let bestScore = Infinity;

            for (const angleDeg of orderedDirections) {
                for (const distance of LABEL_DISTANCES) {
                    const candidate = getCandidate(angleDeg, distance);
                    if (!candidate) continue;

                    const { rect } = candidate;
                    const labelCenter = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
                    let score = 0;

                    score += orderedDirections.indexOf(angleDeg) * LABEL_PENALTIES.direction;
                    const rayDistance = getRayToRectPerimeterDistance(p, rect);
                    score += Math.pow(Math.max(0, rayDistance - 6), 2) * LABEL_PENALTIES.rayDistance;
                    score += LABEL_DISTANCES.indexOf(distance) * LABEL_PENALTIES.distance;

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

                    let rayCrossesOtherCurve = false;
                    for (const segment of otherSegments) {
                        if (segmentIntersectsSegment(p.x, p.y, labelCenter.x, labelCenter.y, segment.x, segment.y, segment.x, segment.y)) {
                            rayCrossesOtherCurve = true;
                            break;
                        }
                    }
                    if (rayCrossesOtherCurve) score += 5000;

                    const minXPlot = rect.left - pad.left;
                    const maxXPlot = rect.right - pad.left;
                    const startIdx = Math.max(0, Math.floor(((minXPlot / wPlot) * xMax) / dxMm));
                    const endIdx = Math.min(len - 1, Math.floor(((maxXPlot / wPlot) * xMax) / dxMm) + 1);

                    const currentCurveOverlapRatio = getCurveOverlapRatio(currentCurve, startIdx, endIdx, rect.left, rect.right, rect.top, rect.bottom);
                    score += currentCurveOverlapRatio * LABEL_PENALTIES.curveOverlap;

                    if (hasCooldown && cooldownTemps) {
                        const otherCurveOverlapRatio = getCurveOverlapRatio(isMain ? cooldownTemps : temps, startIdx, endIdx, rect.left, rect.right, rect.top, rect.bottom);
                        score += otherCurveOverlapRatio * LABEL_PENALTIES.curveOverlap;
                    }

                    const ownSegments = isMain ? mainSegments : cooldownSegments;
                    for (let i = 0; i < ownSegments.length; i++) {
                        if (i >= Math.max(0, (p.id - 1) * 12) && i <= (p.id + 1) * 12 - 1) continue;
                        if (segmentIntersectsRect(ownSegments[i].x, ownSegments[i].y, ownSegments[i].x, ownSegments[i].y, rect)) {
                            score += 2500;
                            break;
                        }
                    }

                    for (const q of placed) {
                        const overlapWidth = Math.max(0, Math.min(rect.right, q.right) - Math.max(rect.left, q.left));
                        const overlapHeight = Math.max(0, Math.min(rect.bottom, q.bottom) - Math.max(rect.top, q.top));
                        const overlapArea = overlapWidth * overlapHeight;

                        if (overlapArea > 0) {
                            const rArea = (rect.right - rect.left) * (rect.bottom - rect.top);
                            const qArea = (q.right - q.left) * (q.bottom - q.top);
                            score += Math.pow(overlapArea / Math.min(rArea, qArea), 2) * LABEL_PENALTIES.placedOverlap;
                        } else {
                            if (Math.max(q.left - rect.right, rect.left - q.right, 0) < 4 && Math.max(q.top - rect.bottom, rect.top - q.bottom, 0) < 4) {
                                score += LABEL_PENALTIES.placedNear;
                            }
                        }
                    }

                    if (score < bestScore) { best = candidate; bestScore = score; }
                    if (score <= LABEL_ACCEPTABLE_SCORE) break;
                }
                if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
            }

            if (!best) {
                best = getCandidate(isPeak ? -90 : isPit ? 90 : -90, LABEL_DISTANCES) || {
                    dx: 0, dy: isPeak ? -12 : isPit ? 12 : -12, textAnchor: "middle",
                    rect: { left: p.x - halfWidth - 2, right: p.x + halfWidth + 2, top: p.y - 7, bottom: p.y + 7 }
                };
                bestScore = Infinity;
            }

            placed.push({
                ...p, dx: best.dx, dy: best.dy, score: bestScore,
                left: best.rect.left, right: best.rect.right, top: best.rect.top, bottom: best.rect.bottom, textAnchor: best.textAnchor
            });
        }

        const gridLinesY = Array.from(
            { length: Math.floor((tMax - tMin) / GRID_STEP_C) + 1 },
            (_, i) => {
                const t = tMin + i * GRID_STEP_C;
                return { id: t, y: ys(t), isSpecial: isSpecialTemperature(t) };
            }
        );

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
        yDecomposition, yMaxForming, yMinForming, yTopEdge, yBottomEdge, dPath, cooldownPath,
        hasCooldown, chartColor, cooldownColor, minColor, maxColor, minIdx, maxIdx, minCoolIdx, maxCoolIdx,
        placed, borderColor, decompositionTemp, minFormingTemp, maxFormingTemp, hasFormingRange,
        heatingSec, cooldownSec, maxV, minV, maxCoolV, minCoolV
    } = chartData;

    return (
        <Paper
            sx={{
                border: "1px solid",
                borderColor,
                p: 0.5,
                fontFamily: '"Roboto Mono","SF Mono",monospace',
                boxShadow: "none"
            }}
        >
            <svg width={width} height={height} style={{ display: "block" }} shapeRendering="geometricPrecision">
                {hasFormingRange && <>
                    <rect x={pad.left} y={formingTop} width={wPlot} height={formingBottom - formingTop} fill={theme.palette.success.main} opacity=".05" />
                    <line x1={pad.left} y1={formingTop} x2={width - pad.right} y2={formingTop} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />
                    <line x1={pad.left} y1={formingBottom} x2={width - pad.right} y2={formingBottom} stroke={theme.palette.success.main} strokeWidth={1} strokeDasharray="4 2" opacity=".4" />
                </>}

                {gridLinesY.map(({ id, y, isSpecial }, i) =>
                        i > 0 && !isSpecial && (
                            <line key={id} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                        )
                )}

                <line x1={xCenter} y1={pad.top} x2={xCenter} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.divider} strokeWidth={1} strokeDasharray="4 2" />
                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />

                {typeof decompositionTemp === "number" && decompositionTemp >= tMin && decompositionTemp <= tMax && <>
                    <line x1={pad.left} y1={yDecomposition} x2={width - pad.right} y2={yDecomposition} stroke={theme.palette.error.main} strokeWidth={1} strokeDasharray="4 2" opacity=".5" />
                    <text x={pad.left - 5} y={yDecomposition + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.error.main}>
                        {decompositionTemp}°
                    </text>
                </>}

                {hasFormingRange && <>
                    <text x={pad.left - 5} y={yMaxForming + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>
                        {maxFormingTemp}°
                    </text>
                    <text x={pad.left - 5} y={yMinForming + 3} textAnchor="end" fontSize={8} fontWeight="bold" fill={theme.palette.success.main}>
                        {minFormingTemp}°
                    </text>
                </>}

                {hasCooldown && <path d={cooldownPath} fill="none" stroke={cooldownColor} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />}
                <path d={dPath} fill="none" stroke={chartColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                {placed.map(p => {
                    const isMin = p.id === (p.type === "cooldown" ? minCoolIdx : minIdx);
                    const isMax = p.id === (p.type === "cooldown" ? maxCoolIdx : maxIdx);
                    return (
                        <g key={`${p.type}-${p.id}`}>
                            <circle cx={p.x} cy={p.y} r={p.type === "cooldown" ? 2.5 : 3} fill={isMin ? minColor : isMax ? maxColor : p.color} stroke={theme.palette.background.paper} strokeWidth={1} opacity={p.type === "cooldown" ? 0.6 : 1} />
                            <text x={p.x + p.dx} y={p.y + p.dy} textAnchor={p.textAnchor} dominantBaseline="middle" fontSize={p.type === "cooldown" ? 8.5 : 9} fontWeight="bold" fill={p.color}>
                                {Math.round(p.val)}°
                            </text>
                        </g>
                    );
                })}

                <text x={xCenter} y={14} textAnchor="middle" fontSize={9.5} fontWeight="bold" fill={chartColor}>
                    Heating: {heatingSec} (ΔT = {(maxV - minV).toFixed(1)}°C)
                </text>

                {yTopEdge !== null &&
                    (!hasFormingRange || Math.abs(yTopEdge - yMaxForming) > 8) &&
                    (typeof decompositionTemp !== "number" || Math.abs(yTopEdge - yDecomposition) > 8) && (
                        <text x={pad.left - 5} y={yTopEdge + 3} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>
                            {tMax}°
                        </text>
                    )}

                {yBottomEdge !== null && (!hasFormingRange || Math.abs(yBottomEdge - yMinForming) > 8) && (
                    <text x={pad.left - 5} y={yBottomEdge + 3} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>
                        {tMin}°
                    </text>
                )}

                <text x={pad.left} y={height - 22} textAnchor="start" fontSize={8.5} fill={theme.palette.text.secondary}>
                    0 mm
                </text>
                <text x={width - pad.right} y={height - 22} textAnchor="end" fontSize={8.5} fill={theme.palette.text.secondary}>
                    {xMax.toFixed(0)} mm
                </text>

                {typeof cooldownSec === "number" &&
                    <text x={xCenter} y={height - 6} textAnchor="middle" fontSize={8.5} fontWeight="500" fill={theme.palette.text.secondary}>
                        Pause: {cooldownSec}s {hasCooldown && `(ΔT = ${(maxCoolV - minCoolV).toFixed(1)}°C)`}
                    </text>
                }
            </svg>
        </Paper>
    );
});
TemperatureProfileChart.displayName = "TemperatureProfileChart";
