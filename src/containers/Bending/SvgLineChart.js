import React, { useMemo, useState, useEffect, useRef } from "react";
import { Paper, useTheme } from "@mui/material";

// --- Константы конфигурации ---
const GRID_STEP_C = 10;
const LABEL_DISTANCES = [5, 9, 13];
const LABEL_RAY_DISTANCE = 4;
const LABEL_ACCEPTABLE_SCORE = 30;
const Y_AXIS_LABEL_MIN_DISTANCE = 12;
const X_AXIS_LABEL_MIN_DISTANCE = 35;
const X_AXIS_LABEL_OFFSET = 5;
const Y_AXIS_LABEL_OFFSET = 5;
const LIMIT_RANGE_OPACITY = 0.06;
const SHOW_ALL_POINTS = true;

const LABEL_PENALTIES = {
    placedOverlap: 10000, placedNear: 50, curveOverlap: 5000, pointInside: 1000,
    leftOverflow: 3000, rightOverflow: 4000, topOverflow: 200, bottomOverflow: 300,
    labelAreaOverflow: 10000, direction: 20, oppositeDirection: 100, rayDistance: 3,
    distance: 5, rayCross: 400, rayGraphCross: 2500,
};

const STATIC_DIRECTIONS = [
    { idx: 0, angle: 0, vx: 1, vy: 0 },
    { idx: 1, angle: 22.5, vx: 0.92387953251128, vy: 0.38268343236508 },
    { idx: 2, angle: 45, vx: 0.70710678118654, vy: 0.70710678118654 },
    { idx: 3, angle: 67.5, vx: 0.38268343236508, vy: 0.92387953236508 },
    { idx: 4, angle: 90, vx: 0, vy: 1 },
    { idx: 5, angle: 112.5, vx: -0.38268343251128, vy: 0.92387953236508 },
    { idx: 6, angle: 135, vx: -0.70710678118654, vy: 0.70710678118654 },
    { idx: 7, angle: 157.5, vx: -0.92387953251128, vy: 0.38268343236508 },
    { idx: 8, angle: 180, vx: -1, vy: 0 },
    { idx: 9, angle: -157.5, vx: -0.92387953251128, vy: -0.38268343236508 },
    { idx: 10, angle: -135, vx: -0.70710678118654, vy: -0.70710678118654 },
    { idx: 11, angle: -112.5, vx: -0.38268343251128, vy: -0.92387953236508 },
    { idx: 12, angle: -90, vx: 0, vy: -1 },
    { idx: 13, angle: -67.5, vx: 0.38268343251128, vy: -0.92387953236508 },
    { idx: 14, angle: -45, vx: 0.70710678118654, vy: -0.70710678118654 },
    { idx: 15, angle: -22.5, vx: 0.92387953236508, vy: -0.38268343236508 },
];

const getLabelSize = (p, yAxisUnit = "°") => {
    const fontSize = 9;
    const text = `${Math.round(p.val)}${yAxisUnit}`;
    return { fontSize, textWidth: text.length * fontSize * 0.52, textHeight: fontSize };
};

const getRectWidth = (rect) => Math.max(0, rect.right - rect.left);
const getRectHeight = (rect) => Math.max(0, rect.bottom - rect.top);
const getRectArea = (rect) => getRectWidth(rect) * getRectHeight(rect);
const getRectDiagonal = (rect) => Math.hypot(getRectWidth(rect), getRectHeight(rect));
const getSegmentLength = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);


const getRayToRectPerimeterDistance = (point, rect) => {
    const centerX = (rect.left + rect.right) * 0.5;
    const centerY = (rect.top + rect.bottom) * 0.5;
    const rayX = centerX - point.x; const rayY = centerY - point.y;
    const rayLength = Math.hypot(rayX, rayY);
    if (rayLength < 0.00001) return 0;
    const ux = rayX / rayLength; const uy = rayY / rayLength;
    let minT = Infinity;
    if (Math.abs(ux) > 0.00001) {
        const tLeft = (rect.left - point.x) / ux;
        if (tLeft >= 0) { const y = point.y + uy * tLeft; if (y >= rect.top - 0.1 && y <= rect.bottom + 0.1) minT = Math.min(minT, tLeft); }
        const tRight = (rect.right - point.x) / ux;
        if (tRight >= 0) { const y = point.y + uy * tRight; if (y >= rect.top - 0.1 && y <= rect.bottom + 0.1) minT = Math.min(minT, tRight); }
    }
    if (Math.abs(uy) > 0.00001) {
        const tTop = (rect.top - point.y) / uy;
        if (tTop >= 0) { const x = point.x + ux * tTop; if (x >= rect.left - 0.1 && x <= rect.right + 0.1) minT = Math.min(minT, tTop); }
        const tBottom = (rect.bottom - point.y) / uy;
        if (tBottom >= 0) { const x = point.x + ux * tBottom; if (x >= rect.left - 0.1 && x <= rect.right + 0.1) minT = Math.min(minT, tBottom); }
    }
    return Number.isFinite(minT) ? minT : rayLength;
};

const getSegmentRectOverlapRatio = (x1, y1, x2, y2, rect) => {
    const dx = x2 - x1; const dy = y2 - y1;
    if (Math.hypot(dx, dy) <= 0) return 0;
    let t0 = 0; let t1 = 1;
    const clip = (p, q) => {
        if (Math.abs(p) < 0.00001) return q >= 0;
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
        else { if (r < t0) return false; if (r < t1) t1 = r; }
        return true;
    };
    if (!clip(-dx, x1 - rect.left) || !clip(dx, rect.right - x1) || !clip(-dy, y1 - rect.top) || !clip(dy, rect.bottom - y1)) return 0;
    return Math.max(0, t1 - t0);
};

const getRectOverlapRatio = (a, b) => {
    const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    if (overlapWidth <= 0) return 0;
    const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    if (overlapHeight <= 0) return 0;
    const referenceArea = Math.min(getRectArea(a), getRectArea(b));
    if (referenceArea <= 0) return 0;
    return Math.min(1, (overlapWidth * overlapHeight) / referenceArea);
};

const getRectGapPenalty = (a, b) => {
    const overlapRatio = getRectOverlapRatio(a, b);
    if (overlapRatio > 0) return overlapRatio * LABEL_PENALTIES.placedOverlap;
    return Math.max(b.left - a.right, a.left - b.right, 0) < 4 && Math.max(b.top - a.bottom, a.top - b.bottom, 0) < 4 ? LABEL_PENALTIES.placedNear : 0;
};

const getSegmentRectOverlapPenalty = (overlapPixels, rect, penalty) => {
    if (overlapPixels <= 0) return 0;
    const referenceLength = getRectDiagonal(rect);
    if (referenceLength <= 0) return 0;

    return Math.min(1, overlapPixels / referenceLength) * penalty;
};

const getOverflowRatio = (rect, side, boundary) => {
    let overflow = 0; let reference = 0;
    if (side === "left") { overflow = Math.max(0, boundary - rect.left); reference = getRectWidth(rect); }
    else if (side === "right") { overflow = Math.max(0, rect.right - boundary); reference = getRectWidth(rect); }
    else if (side === "top") { overflow = Math.max(0, boundary - rect.top); reference = getRectHeight(rect); }
    else if (side === "bottom") { overflow = Math.max(0, rect.bottom - boundary); reference = getRectHeight(rect); }
    if (reference <= 0) return 0;
    return Math.min(1, overflow / reference);
};

const getOverflowPenalty = (rect, plotLeft, plotRight, plotTop, plotBottom) => {
    return (
        getOverflowRatio(rect, "left", plotLeft) * LABEL_PENALTIES.leftOverflow +
        getOverflowRatio(rect, "right", plotRight) * LABEL_PENALTIES.rightOverflow +
        getOverflowRatio(rect, "top", plotTop) * LABEL_PENALTIES.topOverflow +
        getOverflowRatio(rect, "bottom", plotBottom) * LABEL_PENALTIES.bottomOverflow
    );
};

const segmentIntersectsSegment = (a, b, c, d, eps = 1e-9) => {
    const cross = (p, q, r) =>
        (q[0] - p[0]) * (r[1] - p[1]) -
        (q[1] - p[1]) * (r[0] - p[0]);

    const onSegment = (p, q, r) =>
        r[0] >= Math.min(p[0], q[0]) - eps &&
        r[0] <= Math.max(p[0], q[0]) + eps &&
        r[1] >= Math.min(p[1], q[1]) - eps &&
        r[1] <= Math.max(p[1], q[1]) + eps;

    const o1 = cross(a, b, c);
    const o2 = cross(a, b, d);
    const o3 = cross(c, d, a);
    const o4 = cross(c, d, b);

    if (
        ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
        ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))
    ) {
        return true;
    }

    return (
        (Math.abs(o1) <= eps && onSegment(a, b, c)) ||
        (Math.abs(o2) <= eps && onSegment(a, b, d)) ||
        (Math.abs(o3) <= eps && onSegment(c, d, a)) ||
        (Math.abs(o4) <= eps && onSegment(c, d, b))
    );
};

const getCurveOverlap = (graph, rect, xs, ys) => {
    const curve = graph.points;
    let totalPixelsInside = 0;

    const rLeft = rect.left;
    const rRight = rect.right;
    const rTop = rect.top;
    const rBottom = rect.bottom;

    if (!curve || !curve.length) return 0;

    // Ищем первую валидную (не null) точку для старта
    let startIdx = 0;
    while (startIdx < curve.length && (!curve[startIdx] || !Array.isArray(curve[startIdx]))) {
        startIdx++;
    }
    if (startIdx >= curve.length - 1) return 0;

    let x1 = xs(curve[startIdx][0]);
    let y1 = ys(curve[startIdx][1]);

    for (let i = startIdx; i < curve.length - 1; i++) {
        // Если текущая или следующая точка — null (разделитель), пропускаем итерацию
        if (!curve[i] || !curve[i + 1] || !Array.isArray(curve[i]) || !Array.isArray(curve[i + 1])) {
            if (curve[i + 1] && Array.isArray(curve[i + 1])) {
                x1 = xs(curve[i + 1][0]);
                y1 = ys(curve[i + 1][1]);
            }
            continue;
        }

        const x2 = xs(curve[i + 1][0]);
        const y2 = ys(curve[i + 1][1]);

        const segLeft = x1 < x2 ? x1 : x2;
        const segRight = x1 > x2 ? x1 : x2;
        const segTop = y1 < y2 ? y1 : y2;
        const segBottom = y1 > y2 ? y1 : y2;

        // Быстрый отсекающий тест по ограничивающему боксу (bounding box) сегмента
        if (segRight < rLeft || segLeft > rRight || segBottom < rTop || segTop > rBottom) {
            x1 = x2;
            y1 = y2;
            continue;
        }

        const length = Math.hypot(x2 - x1, y2 - y1);
        if (length > 0) {
            totalPixelsInside += length * getSegmentRectOverlapRatio(x1, y1, x2, y2, rect);
        }
        x1 = x2;
        y1 = y2;
    }
    return totalPixelsInside;
};

const getCurveOverlapPenalty = (overlapPixels, rect) => {
    if (overlapPixels <= 0) return 0;
    const referenceLength = getRectDiagonal(rect);
    if (referenceLength <= 0) return 0;

    return Math.min(1, overlapPixels / referenceLength) * LABEL_PENALTIES.curveOverlap;
};

const buildLimitData = ({ axis, lines, ranges, mapValue, minValue, maxValue, plotStart, plotEnd }) => {
    const limitLines = [
        ...(Array.isArray(lines) ? lines : []),
        ...(Array.isArray(ranges) ? ranges.flatMap(range => [{ value: range.from, color: range.color }, { value: range.to, color: range.color }]) : []),
    ].filter(line => typeof line?.value === "number" && Number.isFinite(line.value));

    if (!limitLines.some(line => line.value === minValue)) limitLines.push({ value: minValue });
    if (!limitLines.some(line => line.value === maxValue)) limitLines.push({ value: maxValue });

    const limitRanges = Array.isArray(ranges) ? ranges.filter(range => typeof range?.from === "number" && typeof range?.to === "number" && Number.isFinite(range.from) && Number.isFinite(range.to) && range.from !== range.to) : [];

    const lineData = limitLines.map((line, index) => {
        const coordinate = mapValue(line.value);
        return { ...line, index, x: axis === "x" ? coordinate : undefined, y: axis === "y" ? coordinate : undefined, visible: Number.isFinite(coordinate) && line.value >= minValue && line.value <= maxValue };
    }).filter(line => line.visible);

    const rangeData = limitRanges.map((range, index) => {
        const lowValue = Math.min(range.from, range.to); const highValue = Math.max(range.from, range.to);
        const rawStart = mapValue(lowValue); const rawEnd = mapValue(highValue);
        const start = Math.max(plotStart, Math.min(plotEnd, Math.min(rawStart, rawEnd)));
        const end = Math.max(plotStart, Math.min(plotEnd, Math.max(rawStart, rawEnd)));
        return { ...range, index, lowValue, highValue, start, end, visible: lowValue <= maxValue && highValue >= minValue };
    }).filter(range => range.visible && range.end > range.start);

    return { lines: lineData, ranges: rangeData };
};

const makePath = (graph, xs, ys, xAbsoluteMin, xAbsoluteMax) => {
    if (!graph || !Array.isArray(graph.points) || !graph.points.length) return "";
    const segments = []; let currentSegment = [];
    graph.points.forEach(p => {
        if (p === null) { if (currentSegment.length >= 2) segments.push(currentSegment); currentSegment = []; }
        else { currentSegment.push(p); }
    });
    if (currentSegment.length >= 2) segments.push(currentSegment);

    const renderSegmentPath = (pointsList) => {
        const points = pointsList.filter(p => p && p[0] >= xAbsoluteMin && p[0] <= xAbsoluteMax);
        if (points.length < 2) return "";
        const n = points.length; const px = points.map(p => xs(p[0])); const py = points.map(p => ys(p[1]));
        const dx = new Array(n).fill(0); const dy = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            if (i === 0 || i === n - 1) { dx[i] = 0; dy[i] = 0; }
            else { dx[i] = (px[i + 1] - px[i - 1]) / 2; dy[i] = (py[i + 1] - py[i - 1]) / 2; }
        }
        let d = `M ${px[0]} ${py[0]}`;
        for (let i = 0; i < n - 1; i++) {
            let cp1x = px[i] + dx[i] / 3; let cp1y = py[i] + dy[i] / 3;
            let cp2x = px[i + 1] - dx[i + 1] / 3; let cp2y = py[i + 1] - dy[i + 1] / 3;
            const minX = Math.min(px[i], px[i + 1]); const maxX = Math.max(px[i], px[i + 1]);
            cp1x = Math.max(minX, Math.min(maxX, cp1x)); cp2x = Math.max(minX, Math.min(maxX, cp2x));
            d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${px[i + 1]},${py[i + 1]}`;
        }
        return d;
    };
    return segments.map(seg => renderSegmentPath(seg)).filter(Boolean).join(" ").trim();
};

const getOrderedDirections = (p, graphData, isPlotRightEdgeCheck, ys) => {
    const currentGraph = graphData[p.graphIndex]; const currentCurve = currentGraph.points;
    const isLeftEdge = p.id === 0; const isRightEdge = isPlotRightEdgeCheck(p);
    let preferredAngle = 0;
    if (!isLeftEdge && !isRightEdge && currentCurve[p.id - 1] && Array.isArray(currentCurve[p.id - 1]) && currentCurve[p.id + 1] && Array.isArray(currentCurve[p.id + 1])) {
        const prevY = ys(currentCurve[p.id - 1][1]); const nextY = ys(currentCurve[p.id + 1][1]);
        preferredAngle = p.y < prevY && p.y < nextY ? -90 : p.y > prevY && p.y > nextY ? 90 : 0;
    }
    return [...STATIC_DIRECTIONS].sort((a, b) => {
        let diffA = Math.abs(a.angle - preferredAngle); let diffB = Math.abs(b.angle - preferredAngle);
        return (diffA > 180 ? 360 - diffA : diffA) - (diffB > 180 ? 360 - diffB : diffB);
    });
};

const SvgLineChart = ({ chart, maxHeight }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 150 });

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (!entries || !entries.length) return;
            const { width, height } = entries[0].contentRect;
            if (width && height) {
                setDimensions({ width, height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const chartData = useMemo(() => {
        if (!chart) return null;

        const { width, height } = dimensions;

        const xAxis = chart.axes?.x || {};
        const yAxis = chart.axes?.y || {};
        const axes = { x: xAxis.unit || "mm", y: yAxis.unit || "°C" };
        const showPoints = chart.showPoints !== false;
        const showLabels = chart.showLabels !== false;

        const graphs = chart.graphs
            .filter(graph => graph && Array.isArray(graph.points) && graph.points.length >= 2)
            .map((graph, index) => ({
                ...graph,
                index,
                points: graph.points.map(point => point === null ? null : [Number(point[0]), Number(point[1])]),
                color: graph.color || theme.palette.text.primary,
                opacity: typeof graph.opacity === "number" ? Math.max(0, Math.min(1, graph.opacity)) : 1,
                lineWidth: typeof graph.lineWidth === "number" && graph.lineWidth > 0 ? graph.lineWidth : 2,
                showMarker: graph.showMarker !== false,
            }));

        const pad = { left: 32, right: 32, top: 16, bottom: 20 };
        const wPlot = width - pad.left - pad.right;
        const hPlot = height - pad.top - pad.bottom;

        let xMin = typeof xAxis.min === "number" ? xAxis.min : null;
        let xMax = typeof xAxis.max === "number" ? xAxis.max : null;

        if (xMin === null || xMax === null) {
            const graphXRanges = graphs.map(graph => {
                const validPoints = (graph.points || []).filter(p => p && Array.isArray(p));
                if (validPoints.length === 0) return { start: 0, end: 0 };
                return { start: Math.min(...validPoints.map(p => p[0])), end: Math.max(...validPoints.map(p => p[0])) };
            });
            if (xMin === null) xMin = Math.min(...graphXRanges.map(r => r.start));
            if (xMax === null) xMax = Math.max(...graphXRanges.map(r => r.end));
        }

        const xAbsoluteMin = Math.min(xMin, xMax);
        const xAbsoluteMax = Math.max(xMin, xMax);
        const xs = (x) => pad.left + ((x - xMin) / (xMax - xMin || 1)) * wPlot;

        let tMin = typeof yAxis.min === "number" ? yAxis.min : null;
        let tMax = typeof yAxis.max === "number" ? yAxis.max : null;

        if (tMin === null || tMax === null) {
            const allValues = graphs.flatMap(graph => (graph.points || []).filter(p => p && Array.isArray(p)).map(p => p[1]));
            const yRanges = Array.isArray(yAxis.ranges) ? yAxis.ranges : [];
            const rangeValues = [...allValues, ...yRanges.flatMap(r => [r.from, r.to])].filter(Number.isFinite);

            if (rangeValues.length > 0) {
                tMin = typeof yAxis.min === "number" ? yAxis.min : Math.floor(Math.min(...rangeValues) / GRID_STEP_C) * GRID_STEP_C;
                tMax = typeof yAxis.max === "number" ? yAxis.max : Math.ceil(Math.max(...rangeValues) / GRID_STEP_C) * GRID_STEP_C;
            } else {
                tMin = typeof yAxis.min === "number" ? yAxis.min : 0;
                tMax = typeof yAxis.max === "number" ? yAxis.max : 100;
            }
        }

        const tAbsoluteMin = Math.min(tMin, tMax);
        const tAbsoluteMax = Math.max(tMin, tMax);
        const ys = (t) => pad.top + ((tMax - t) / (tMax - tMin || 1)) * hPlot;

        const yLimits = buildLimitData({ axis: "y", lines: yAxis.lines, ranges: yAxis.ranges, mapValue: ys, minValue: tAbsoluteMin, maxValue: tAbsoluteMax, plotStart: pad.top, plotEnd: pad.top + hPlot });
        const xLimits = buildLimitData({ axis: "x", lines: xAxis.lines, ranges: xAxis.ranges, mapValue: xs, minValue: xAbsoluteMin, maxValue: xAbsoluteMax, plotStart: pad.left, plotEnd: pad.left + wPlot });

        const isSpecialTemperature = (t) => [...(Array.isArray(yAxis.lines) ? yAxis.lines.map(l => l.value) : []), ...(Array.isArray(yAxis.ranges) ? yAxis.ranges.flatMap(r => [r.from, r.to]) : [])].some(v => Number.isFinite(v) && Math.abs(v - t) < 0.1);

        const graphData = graphs.map(graph => {
            let minIdx = -1, maxIdx = -1, minV = Infinity, maxV = -Infinity;
            for (let i = 0; i < graph.points.length; i++) {
                const p = graph.points[i]; if (!p || !Array.isArray(p)) continue;
                if (p[0] < xAbsoluteMin || p[0] > xAbsoluteMax) continue;
                if (p[1] < minV) { minV = p[1]; minIdx = i; }
                if (p[1] > maxV) { maxV = p[1]; maxIdx = i; }
            }
            if (minIdx === -1) minIdx = 0; if (maxIdx === -1) maxIdx = 0;
            return { ...graph, minIdx, maxIdx, minV: minV === Infinity ? Math.min(tMin, tMax) : minV, maxV: maxV === -Infinity ? Math.max(tMin, tMax) : maxV, path: makePath(graph, xs, ys, xAbsoluteMin, xAbsoluteMax) };
        });

        const fillPolygonsData = (Array.isArray(chart.fillPolygons) ? chart.fillPolygons : [])
            .map((polygon, index) => {
                if (!Array.isArray(polygon.points)) return null;
                const validPoints = polygon.points.filter(pt => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
                if (validPoints.length < 3) return null;
                return { id: polygon.key ?? `fill-polygon-${index}`, name: polygon.name, path: validPoints.map((pt, ptIdx) => `${ptIdx === 0 ? "M" : "L"} ${xs(pt[0])} ${ys(pt[1])}`).join(" ") + " Z", color: polygon.color || theme.palette.success.main, opacity: typeof polygon.opacity === "number" ? polygon.opacity : 0.15 };
            }).filter(Boolean);

        const isPlotRightEdge = (p) => {
            const graph = graphData[p.graphIndex];
            return graph && Array.isArray(graph.points) && graph.points[p.id] ? Math.abs(graph.points[p.id][0] - xMax) < 1e-6 : false;
        };

        const rightEdgeLabelsRaw = [];
        const makeLabels = (graph) => {
            const points = graph.points; if (!points || !points.length) return [];
            const lastId = points.length - 1; const raw = [];
            if (graph.maxIdx >= 0 && points[graph.maxIdx]) raw.push({ id: graph.maxIdx, val: graph.maxV, p: 4 });
            if (graph.minIdx >= 0 && points[graph.minIdx] && graph.minIdx !== graph.maxIdx) raw.push({ id: graph.minIdx, val: graph.minV, p: 4 });
            if (points[0] && points[0][0] >= xAbsoluteMin && points[0][0] <= xAbsoluteMax) raw.push({ id: 0, val: points[0][1], p: 2 });
            if (points[lastId] && points[lastId][0] >= xAbsoluteMin && points[lastId][0] <= xAbsoluteMax && lastId !== 0) raw.push({ id: lastId, val: points[lastId][1], p: 2 });

            const result = []; const seen = new Set(); raw.sort((a, b) => b.p - a.p);
            for (const p of raw) {
                if (seen.has(p.id)) continue; seen.add(p.id);
                const pt = points[p.id]; if (!pt) continue;
                if (p.val < tAbsoluteMin || p.val > tAbsoluteMax) continue;
                if (Math.abs(xs(pt[0]) - pad.left) < 0.01 && Math.abs(ys(p.val) - (height - pad.bottom)) < 0.01) continue;

                const labelObj = { ...p, type: graph.index === 0 ? "main" : "cooldown", graphIndex: graph.index, order: (p.id === 0 || p.id === lastId) ? 0 : 1, color: graph.color, opacity: graph.opacity, x: xs(pt[0]), y: ys(p.val) };
                if (p.id === lastId || Math.abs(pt[0] - xMax) < 1e-6) rightEdgeLabelsRaw.push(labelObj);
                else result.push(labelObj);
            }
            return result;
        };

        const labels = showLabels ? graphData.filter(g => g.showMarker).flatMap(g => makeLabels(g)) : [];
        const sortedLabels = [...labels].sort((a, b) => {
            const getPriority = (p) => isPlotRightEdge(p) ? 0 : (p.id === 0 ? 1 : 2);
            return getPriority(a) !== getPriority(b) ? getPriority(a) - getPriority(b) : a.y - b.y || a.graphIndex - b.graphIndex;
        });

        const plotTop = pad.top; const plotBottom = height - pad.bottom; const plotLeft = pad.left; const plotRight = width - pad.right;
        const placed = [];

        for (const p of sortedLabels) {
            const currentGraph = graphData[p.graphIndex]; const currentCurve = currentGraph.points;
            const { textWidth, textHeight } = getLabelSize(p, axes.y);
            const orderedDirections = getOrderedDirections(p, graphData, isPlotRightEdge, ys);
            let best = null; let bestScore = Infinity;

            // СТАЛО (Возвращаем оригинальную логику рангов):
            for (let dIdx = 0; dIdx < orderedDirections.length; dIdx++) {
                const dir = orderedDirections[dIdx]; // Теперь у нас есть индекс направления dIdx

                for (let distIdx = 0; distIdx < LABEL_DISTANCES.length; distIdx++) {
                    const baseDist = LABEL_DISTANCES[distIdx]; // Теперь у нас есть индекс дистанции distIdx

                    const angle = Math.abs(dir.angle) % 90;
                    const distance = baseDist + LABEL_RAY_DISTANCE * (1 - Math.min(angle, 90 - angle) / 45);
                    const dx = dir.vx * distance; const dy = dir.vy * distance;

                    let textAnchor = "middle";
                    if (p.id === 0 && Math.abs(p.x - plotLeft) < 0.1 && dx > 0.01) textAnchor = "start";
                    if (isPlotRightEdge(p)) textAnchor = dx >= 0 ? "start" : "end";

                    const tx = p.x + dx; const ty = p.y + dy;
                    const rect = {
                        left: tx - (textAnchor === "end" ? textWidth : textAnchor === "middle" ? textWidth / 2 : 0) - 1,
                        right: tx + (textAnchor === "start" ? textWidth : textAnchor === "middle" ? textWidth / 2 : 0) + 1,
                        top: ty - textHeight / 2 - 0.5,
                        bottom: ty + textHeight / 2 + 0.5
                    };

                    // 🔥 ВОЗВРАТ ПРАВИЛЬНОЙ МАТЕМАТИКИ ШТРАФОВ:
                    // Штрафуем за отклонение от лучшего угла (dIdx) и за увеличение длины выноски (distIdx)
                    let score = dIdx * LABEL_PENALTIES.direction +
                        distIdx * LABEL_PENALTIES.distance +
                        Math.pow(Math.max(0, getRayToRectPerimeterDistance(p, rect) - 6), 2) * LABEL_PENALTIES.rayDistance;

                    score += getOverflowPenalty(rect, plotLeft, plotRight, plotTop, plotBottom);

                    // 1. Штраф за пересечение с собственным сегментом кривой (оставляем)
                    let ownSegmentOverlap = 0;
                    for (let i = Math.max(0, p.id - 1); i <= Math.min(currentCurve.length - 2, p.id + 1); i++) {
                        if (!currentCurve[i] || !currentCurve[i+1]) continue;
                        ownSegmentOverlap += getSegmentLength(xs(currentCurve[i][0]), ys(currentCurve[i][1]), xs(currentCurve[i+1][0]), ys(currentCurve[i+1][1])) * getSegmentRectOverlapRatio(xs(currentCurve[i][0]), ys(currentCurve[i][1]), xs(currentCurve[i+1][0]), ys(currentCurve[i+1][1]), rect);
                    }
                    if (ownSegmentOverlap > 0) score += getSegmentRectOverlapPenalty(ownSegmentOverlap, rect, LABEL_PENALTIES.curveOverlap);

                    // 2. 🔥 ВОЗВРАТ: Штраф за пересечение рамки подписи со всей своей кривой целиком
                    const ownOverlapPixels = getCurveOverlap(currentGraph, rect, xs, ys);
                    if (ownOverlapPixels > 0) {
                        score += getCurveOverlapPenalty(ownOverlapPixels, rect);
                    }

                    // 3. 🔥 ВОЗВРАТ: Штраф за пересечение рамки подписи со ВСЕМИ ЧУЖИМИ кривыми на графике
                    const otherGraphs = graphData.filter(g => g.index !== p.graphIndex);
                    for (const otherGraph of otherGraphs) {
                        const otherOverlapPixels = getCurveOverlap(otherGraph, rect, xs, ys);
                        if (otherOverlapPixels > 0) {
                            score += getCurveOverlapPenalty(otherOverlapPixels, rect);
                        }
                    }

                    // 4. 🔥 ВОЗВРАТ: Проверка пересечения луча (линии выноски) с чужими графиками
                    let rayCrossesGraph = false;
                    for (const otherGraph of otherGraphs) {
                        const otherCurve = otherGraph.points;
                        for (let i = 0; i < otherCurve.length - 1; i++) {
                            if (!otherCurve[i] || !otherCurve[i+1]) continue;
                            if (segmentIntersectsSegment(p.x, p.y, tx, ty, xs(otherCurve[i][0]), ys(otherCurve[i][1]), xs(otherCurve[i+1][0]), ys(otherCurve[i+1][1]))) {
                                rayCrossesGraph = true;
                                break;
                            }
                        }
                        if (rayCrossesGraph) break;
                    }
                    if (rayCrossesGraph) score += LABEL_PENALTIES.rayGraphCross;

                    // 5. Проверка наложения на уже размещенные соседние подписи (оставляем)
                    for (const q of placed) score += getRectGapPenalty(rect, q);

                    // Проверка пересечения линий выносок между собой (чтобы стрелки не крестились)
                    for (const placedLabel of placed) {
                        const placedCenter = { x: (placedLabel.left + placedLabel.right) * 0.5, y: (placedLabel.top + placedLabel.bottom) * 0.5 };
                        if (segmentIntersectsSegment(p.x, p.y, tx, ty, placedLabel.x, placedLabel.y, placedCenter.x, placedCenter.y)) {
                            score += LABEL_PENALTIES.rayCross;
                        }
                    }

                    if (score < bestScore) { best = { dx, dy, textAnchor, rect }; bestScore = score; }

                    if (bestScore <= LABEL_ACCEPTABLE_SCORE) break;
                }
            }

            const fallbackDir = orderedDirections[0] || { vx: 1, vy: 0 };

            if (!best) best = {
                dx: fallbackDir.vx * 12,
                dy: fallbackDir.vy * 12,
                textAnchor: "middle",
                rect: { left: p.x - 10, right: p.x + 10, top: p.y - 5, bottom: p.y + 5 }
            };
            placed.push({ ...p, dx: best.dx, dy: best.dy, left: best.rect.left, right: best.rect.right, top: best.rect.top, bottom: best.rect.bottom, textAnchor: best.textAnchor });
        }

        // СТАЛО:
        const yAxisLabels = yLimits.lines.map(line => ({ type: "limit", index: line.index, value: line.value, y: line.y, color: line.color || theme.palette.text.secondary }));
        yAxisLabels.sort((a, b) => a.y - b.y);

        let yLeftChanged = true;
        for (let iter = 0; iter < 6 && yLeftChanged; iter++) {
            yLeftChanged = false;
            for (let i = 1; i < yAxisLabels.length; i++) {
                if (yAxisLabels[i].y < yAxisLabels[i - 1].y + Y_AXIS_LABEL_MIN_DISTANCE) {
                    yAxisLabels[i].y = yAxisLabels[i - 1].y + Y_AXIS_LABEL_MIN_DISTANCE;
                    yLeftChanged = true;
                }
            }
        }
        for (const label of yAxisLabels) label.y = Math.max(pad.top, Math.min(height - pad.bottom, label.y));

        const rightAxisLabels = rightEdgeLabelsRaw.map(label => ({ graphIndex: label.graphIndex, value: label.val, y: label.y, color: label.color, opacity: label.opacity }));
        rightAxisLabels.sort((a, b) => a.y - b.y);
        // БЫЛО:
        let changed = true;
        for (let iter = 0; iter < 4 && changed; iter++) {
            changed = false;
            for (let i = 0; i < rightAxisLabels.length - 1; i++) {
                const overlap = rightAxisLabels[i].y + Y_AXIS_LABEL_MIN_DISTANCE - rightAxisLabels[i + 1].y;
                if (overlap > 0) {
                    rightAxisLabels[i].y -= overlap / 2;
                    rightAxisLabels[i + 1].y += overlap / 2;
                    changed = true;
                }
            }
            if (rightAxisLabels.length > 0) {
                if (rightAxisLabels[0].y < pad.top) {
                    rightAxisLabels[0].y = pad.top;
                    changed = true;
                }
                const lastIdx = rightAxisLabels.length - 1;
                if (rightAxisLabels[lastIdx].y > height - pad.bottom) {
                    rightAxisLabels[lastIdx].y = height - pad.bottom;
                    changed = true;
                }
            }
        }


        // СТАЛО:
        const xAxisLabels = xLimits.lines.map(line => ({ type: "limit", index: line.index, value: line.value, x: line.x, color: line.color || theme.palette.text.secondary }));
        xAxisLabels.sort((a, b) => a.x - b.x);

        let xChanged = true;
        for (let iter = 0; iter < 6 && xChanged; iter++) {
            xChanged = false;
            for (let i = 0; i < xAxisLabels.length - 1; i++) {
                const overlap = xAxisLabels[i].x + X_AXIS_LABEL_MIN_DISTANCE - xAxisLabels[i + 1].x;
                if (overlap > 0) {
                    xAxisLabels[i].x -= overlap / 2;
                    xAxisLabels[i + 1].x += overlap / 2;
                    xChanged = true;
                }
            }
            if (xAxisLabels.length > 0) {
                if (xAxisLabels[0].x < pad.left) {
                    xAxisLabels[0].x = pad.left;
                    xChanged = true;
                }
                const lastXIdx = xAxisLabels.length - 1;
                if (xAxisLabels[lastXIdx].x > width - pad.right) {
                    xAxisLabels[lastXIdx].x = width - pad.right;
                    xChanged = true;
                }
            }
        }

        const linesCount = Math.floor((Math.max(tMin, tMax) - Math.min(tMin, tMax)) / GRID_STEP_C) + 1;
        const gridLinesY = [];
        for (let i = 0; i < linesCount; i++) { const t = Math.min(tMin, tMax) + i * GRID_STEP_C; gridLinesY.push({ id: t, y: ys(t), isSpecial: isSpecialTemperature(t) }); }

        const placedMap = {};
        placed.forEach(p => { placedMap[`${p.graphIndex}-${p.id}`] = p; });

        return {
            width, height, pad, wPlot, hPlot, xMin, tMin, gridLinesY,
            xAbsoluteMin, xAbsoluteMax, tAbsoluteMin, tAbsoluteMax,
            yLimitLineData: yLimits.lines, yLimitRangeData: yLimits.ranges, xLimitLineData: xLimits.lines, xLimitRangeData: xLimits.ranges,
            graphData, fillPolygonsData, placedMap, yAxisLabels, rightAxisLabels, xAxisLabels,
            axes, showPoints, showLabels, xs, ys,
            borderColor: chart.status?.type === "error" ? theme.palette.error.main : chart.status?.type === "warning" ? theme.palette.warning.main : theme.palette.divider,
        };
    }, [chart, dimensions, theme]);

    if (!chartData) return null;

    const {
        width, height, pad, wPlot, hPlot, xMin, tMin, gridLinesY,
        xAbsoluteMin, xAbsoluteMax, tAbsoluteMin, tAbsoluteMax,
        yLimitLineData, yLimitRangeData, xLimitLineData, xLimitRangeData,
        graphData, fillPolygonsData, placedMap, yAxisLabels, rightAxisLabels, xAxisLabels,
        axes, showPoints, showLabels, borderColor, xs, ys,
    } = chartData;

    return (
        <Paper
            ref={containerRef}
            sx={{
                border: "1px solid",
                borderColor,
                p: 0.5,
                fontFamily: '"Roboto Mono","SF Mono",monospace',
                boxShadow: "none",
                width: "100%",
                boxSizing: "border-box",
                height: maxHeight ? `${maxHeight}px` : "150px",
                maxHeight: maxHeight || "none",
                display: "block"
            }}
        >
            <svg
                width="100%"
                height="100%"
                style={{ display: "block" }}
                shapeRendering="geometricPrecision"
            >
                <defs>
                    <clipPath id="blank-clip-bounds">
                        <rect x={pad.left} y={pad.top} width={wPlot} height={hPlot} />
                    </clipPath>
                </defs>

                {xLimitRangeData.map(range => (
                    <rect key={`x-limit-range-${range.index}`} x={range.start} y={pad.top} width={Math.max(0, range.end - range.start)} height={hPlot} fill={range.color} opacity={LIMIT_RANGE_OPACITY} />
                ))}

                {yLimitRangeData.map(range => (
                    <rect key={`y-limit-range-${range.index}`} x={pad.left} y={range.start} width={wPlot} height={Math.max(0, range.end - range.start)} fill={range.color} opacity={LIMIT_RANGE_OPACITY} />
                ))}

                {gridLinesY.map(({ id, y, isSpecial }) => (
                    id >= tAbsoluteMin && id <= tAbsoluteMax && !isSpecial && <line key={id} x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={theme.palette.divider} strokeWidth={0.5} strokeDasharray="4 2" />
                ))}

                {xLimitLineData.map(line => (
                    Math.abs(line.value - xMin) !== 0 && (<line key={`x-limit-line-${line.index}`} x1={line.x} y1={pad.top} x2={line.x} y2={height - pad.bottom} stroke={line.color || theme.palette.text.secondary} strokeWidth={1} strokeDasharray="4 2" opacity=".5"/>)
                ))}

                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".2" />

                {yLimitLineData.map(line => (
                    Math.abs(line.value - tMin) !== 0 && <line key={`y-limit-line-${line.index}`} x1={pad.left} y1={line.y} x2={width - pad.right} y2={line.y} stroke={line.color || theme.palette.text.secondary} strokeWidth={1} strokeDasharray="4 2" opacity=".5" />
                ))}

                {yAxisLabels.map(label => (
                    <text key={`y-limit-label-${label.index}`} x={pad.left - Y_AXIS_LABEL_OFFSET} y={label.y} textAnchor="end" dominantBaseline="middle" fontSize={8} fontWeight="bold" fill={label.color}>
                        {Number(label.value).toFixed(0)}{axes.y}
                    </text>
                ))}

                {showLabels && rightAxisLabels.map((label, idx) => (
                    <text key={`right-axis-label-${label.graphIndex}-${idx}`} x={width - pad.right + Y_AXIS_LABEL_OFFSET} y={label.y} textAnchor="start" dominantBaseline="middle" fontSize={8} fontWeight="bold" fill={label.color} opacity={label.opacity}>
                        {Math.round(label.value)}{axes.y}
                    </text>
                ))}

                {xAxisLabels.map(label => (
                    <text key={`x-limit-label-${label.index}`} x={label.x} y={height - pad.bottom + X_AXIS_LABEL_OFFSET} textAnchor="middle" dominantBaseline="hanging" fontSize={8} fontWeight="bold" fill={label.color}>
                        {Number(label.value).toFixed(0)}{axes.x}
                    </text>
                ))}

                {fillPolygonsData.map(polygon => (
                    <path key={polygon.id} d={polygon.path} fill={polygon.color} fillOpacity={polygon.opacity} fillRule="evenodd" clipPath="url(#blank-clip-bounds)" stroke="none" style={{ pointerEvents: "none" }} />
                ))}

                {graphData.map(graph => (
                    <path key={`path-${graph.index}`} d={graph.path} fill="none" stroke={graph.color} strokeWidth={graph.lineWidth} opacity={graph.opacity} strokeLinecap="round" strokeLinejoin="round" />
                ))}

                {SHOW_ALL_POINTS && graphData.map(graph => {
                    if (!graph || !Array.isArray(graph.points)) return null;
                    return graph.points.map((pt, ptIdx) => {
                        if (!pt) return null;
                        return (
                            <circle key={`${graph.index}-pt-${ptIdx}`} cx={xs(pt[0])} cy={ys(pt[1])} r={graph.lineWidth * 0.4} fill={theme.palette.text.primary} stroke={theme.palette.background.paper} strokeWidth={graph.lineWidth * 0.2} opacity={graph.opacity * 0.4} />
                        );
                    });
                })}

                {showPoints && graphData.map(graph => {
                    if (!graph || !Array.isArray(graph.points)) return null;
                    return graph.points.map((pt, ptIdx) => {
                        if (!pt) return null;
                        const pointX = xs(pt[0]); const pointY = ys(pt[1]);
                        const isMin = ptIdx === graph.minIdx; const isMax = ptIdx === graph.maxIdx;
                        if (pt[0] < xAbsoluteMin || pt[0] > xAbsoluteMax || pt[1] < tAbsoluteMin || pt[1] > tAbsoluteMax) return null;

                        const labelPlaced = placedMap[`${graph.index}-${ptIdx}`];
                        if (ptIdx !== 0 && ptIdx !== graph.points.length - 1 && !isMin && !isMax) return null;

                        return (
                            <g key={`${graph.index}-pt-${ptIdx}`}>
                                {graph.showMarker && (
                                    <circle cx={pointX} cy={pointY} r={Math.max(2.5, graph.lineWidth * 1.3)} fill={isMin ? theme.palette.info.main : isMax ? theme.palette.error.main : graph.color} stroke={theme.palette.background.paper} strokeWidth={1} opacity={graph.opacity} />
                                )}
                                {showLabels && labelPlaced && (
                                    <text x={pointX + labelPlaced.dx} y={pointY + labelPlaced.dy} textAnchor={labelPlaced.textAnchor} dominantBaseline="middle" fontSize={9} fontWeight="bold" fill={graph.color} opacity={graph.opacity}>
                                        {Math.round(pt[1])}{axes.y}
                                    </text>
                                )}
                            </g>
                        );
                    });
                })}
            </svg>
        </Paper>
    );
};

SvgLineChart.displayName = "SvgLineChart";
export default SvgLineChart;
