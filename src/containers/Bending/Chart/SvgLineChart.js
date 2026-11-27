import React, { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { Paper, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    decimalsForStep,
    decimateColumns,
    formatNumber,
    isMonotoneX,
    makeScale,
    monotonePath,
    niceTicks,
    polylinePath,
    resolveDomain,
    splitSegments,
    valueAtX
} from "./chartMath";
import { placeLabels, spreadAlongAxis } from "./labelPlacement";

// ============================================================================
// Оформление
// ============================================================================
const FONT_FAMILY = '"Roboto Mono","SF Mono",Consolas,"Liberation Mono",monospace';
const TICK_FONT = 8;
const VALUE_FONT = 9;
const CHAR_WIDTH = 0.6;              // ширина символа моноширинного шрифта, доля от кегля
const PX_PER_Y_TICK = 26;            // желаемое расстояние между делениями по вертикали
const PX_PER_X_TICK = 64;            // ...и по горизонтали
const AXIS_LABEL_GAP = 10;           // минимальный зазор между подписями на оси
const RANGE_OPACITY = 0.07;
const SMOOTH_MAX_POINTS_PER_PX = 1 / 3;  // сглаживать, если точек не больше 1 на 3 px
const DOTS_MAX_POINTS_PER_PX = 1 / 5;    // точки узлов рисовать, если не гуще 1 на 5 px
const DECIMATE_POINTS_PER_PX = 1.5;      // прореживать, если гуще 1,5 точки на px

const textWidth = (text, fontSize) => String(text).length * fontSize * CHAR_WIDTH;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Значение предела: как у делений, а если оно не «круглое» — на один знак точнее
function formatExact(value, baseDecimals, step) {
    const close = Math.abs(Number(value.toFixed(baseDecimals)) - value) <= Math.max(step * 0.005, Math.abs(value) * 1e-9);
    return formatNumber(value, close ? baseDecimals : baseDecimals + 1);
}

// Легенда в одну строку: пункты слева направо, не влезающие — не показываются
function layoutLegend(items, x0, xMax) {
    const out = [];
    let x = x0;
    for (const it of items) {
        const w = 10 + textWidth(it.label, TICK_FONT) + 10;
        if (x + w - 10 > xMax) break;
        out.push({ ...it, x });
        x += w;
    }
    return out;
}

function minorStepFor(step) {
    const mantissa = Math.round(step / 10 ** Math.floor(Math.log10(step)));
    return step / (mantissa === 2 ? 4 : 5);
}

// ============================================================================
// Подготовка всей геометрии графика (чистая функция: chart + размеры + тема)
// ============================================================================
export function buildChartModel(chart, width, height, palette, { headerReserve = 0 } = {}) {
    const xAxis = chart.axes?.x || {};
    const yAxis = chart.axes?.y || {};
    const units = { x: xAxis.unit ?? "mm", y: yAxis.unit ?? "°" };
    const showPoints = chart.showPoints !== false;
    const showLabels = chart.showLabels !== false;

    // --- Ряды ---
    const graphs = (chart.graphs || [])
        .filter(g => g && Array.isArray(g.points) && g.points.length >= 2)
        .map((g, index) => {
            const segments = splitSegments(g.points);
            return {
                index,
                name: g.name || `#${index + 1}`,
                segments,
                monotone: isMonotoneX(segments),
                color: g.color || palette.text.primary,
                opacity: isNum(g.opacity) ? Math.max(0, Math.min(1, g.opacity)) : 1,
                lineWidth: isNum(g.lineWidth) && g.lineWidth > 0 ? g.lineWidth : 1.5,
                showMarker: g.showMarker !== false,
                dashArray: g.dashArray || null
            };
        })
        .filter(g => g.segments.length > 0);

    // --- Границы данных ---
    let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
    for (const g of graphs) {
        for (const seg of g.segments) {
            for (const [x, y] of seg) {
                if (x < xLo) xLo = x;
                if (x > xHi) xHi = x;
                if (y < yLo) yLo = y;
                if (y > yHi) yHi = y;
            }
        }
    }
    for (const r of yAxis.ranges || []) {
        if (isNum(r?.from) && isNum(r?.to)) {
            yLo = Math.min(yLo, r.from, r.to);
            yHi = Math.max(yHi, r.from, r.to);
        }
    }

    // --- Поля и масштабы (поле слева зависит от ширины подписей делений) ---
    // Легенда (chart.legend: [{ label, color, opacity }]) — строка над областью графика
    const legendItems = (chart.legend || []).filter(it => it && it.label);
    const top = legendItems.length || headerReserve > 0 ? 20 : 8;
    const bottom = 17;
    const roughH = Math.max(20, height - top - bottom);
    const [yd0, yd1] = resolveDomain(yAxis, yLo, yHi, { nice: true, targetTicks: roughH / PX_PER_Y_TICK });
    const yMinV = Math.min(yd0, yd1), yMaxV = Math.max(yd0, yd1);
    const yTickInfo = niceTicks(yMinV, yMaxV, roughH / PX_PER_Y_TICK);
    const yDecimals = decimalsForStep(yTickInfo.step);
    const fmtY = (v) => formatNumber(v, yDecimals);

    const yLimitItems = [];
    for (const line of yAxis.lines || []) {
        if (isNum(line?.value)) yLimitItems.push({ value: line.value, color: line.color, label: line.label });
    }
    for (const r of yAxis.ranges || []) {
        if (isNum(r?.from) && isNum(r?.to) && r.from !== r.to) {
            yLimitItems.push({ value: r.from, color: r.color }, { value: r.to, color: r.color });
        }
    }
    const yLimits = yLimitItems.filter((it, i, a) =>
        it.value >= yMinV - 1e-9 && it.value <= yMaxV + 1e-9 && a.findIndex(o => Math.abs(o.value - it.value) < 1e-9) === i
    );

    const fmtYExact = (v) => formatExact(v, yDecimals, yTickInfo.step);
    const leftLabelChars = Math.max(
        1,
        ...yTickInfo.ticks.map(t => fmtY(t).length + units.y.length + (units.y.length > 1 ? 1 : 0)),
        ...yLimits.map(l => fmtYExact(l.value).length)
    );
    const left = Math.round(Math.max(24, textWidth("0".repeat(leftLabelChars), TICK_FONT) + 9));

    // Подписи концов кривых справа (последняя точка у правого края)
    const [xd0, xd1] = resolveDomain(xAxis, xLo, xHi, { nice: false, targetTicks: 5 });
    const xMinV = Math.min(xd0, xd1), xMaxV = Math.max(xd0, xd1);
    const endCandidates = [];
    if (showLabels) {
        for (const g of graphs) {
            if (!g.showMarker) continue;
            const lastSeg = g.segments[g.segments.length - 1];
            const last = lastSeg[lastSeg.length - 1];
            if (Math.abs(last[0] - (xd1 >= xd0 ? xMaxV : xMinV)) <= (xMaxV - xMinV) * 1e-6 && last[1] >= yMinV && last[1] <= yMaxV) {
                endCandidates.push({ graph: g, point: last });
            }
        }
    }
    const fmtValue = (v) => (units.y === "°" ? String(Math.round(v)) : fmtY(v)) + units.y;
    const rightChars = endCandidates.reduce((m, c) => Math.max(m, fmtValue(c.point[1]).length), 0);
    const right = Math.round(rightChars ? textWidth("0".repeat(rightChars), VALUE_FONT) + 10 : 10);

    const plot = { l: left, r: Math.max(left + 10, width - right), t: top, b: Math.max(top + 10, height - bottom) };
    const wPlot = plot.r - plot.l;
    const hPlot = plot.b - plot.t;

    const xs = makeScale(xd0, xd1, plot.l, plot.r);
    const ys = makeScale(yd0, yd1, plot.b, plot.t);

    // --- Деления ---
    const xTickInfo = niceTicks(xMinV, xMaxV, Math.max(2, wPlot / PX_PER_X_TICK));
    const xDecimals = decimalsForStep(xTickInfo.step);
    const fmtX = (v) => formatNumber(v, xDecimals);
    const minorX = [];
    const minorY = [];
    {
        const sx = minorStepFor(xTickInfo.step);
        if (wPlot / ((xMaxV - xMinV) / sx) >= 6) {
            for (let v = Math.ceil(xMinV / sx) * sx; v <= xMaxV + 1e-9; v += sx) minorX.push(xs(v));
        }
        const sy = minorStepFor(yTickInfo.step);
        if (hPlot / ((yMaxV - yMinV) / sy) >= 5) {
            for (let v = Math.ceil(yMinV / sy) * sy; v <= yMaxV + 1e-9; v += sy) minorY.push(ys(v));
        }
    }

    // --- Кривые в пикселях ---
    const curvesForLabels = [];
    const series = graphs.map(g => {
        const pixelSegments = [];
        let visibleCount = 0;
        let minP = null, maxP = null, firstP = null, lastP = null;
        for (const seg of g.segments) {
            // Видимая часть по x (с соседними точками для непрерывности линии у края)
            let a = 0, b = seg.length - 1;
            while (a < seg.length && (seg[a][0] < xMinV || seg[a][0] > xMaxV)) a++;
            while (b >= 0 && (seg[b][0] < xMinV || seg[b][0] > xMaxV)) b--;
            if (a > b) continue;
            for (let i = a; i <= b; i++) {
                const p = seg[i];
                if (p[0] < xMinV || p[0] > xMaxV) continue;
                visibleCount++;
                if (!firstP) firstP = p;
                lastP = p;
                if (!minP || p[1] < minP[1]) minP = p;
                if (!maxP || p[1] > maxP[1]) maxP = p;
            }
            const from = Math.max(0, a - 1), to = Math.min(seg.length - 1, b + 1);
            let px = [], py = [];
            for (let i = from; i <= to; i++) {
                px.push(xs(seg[i][0]));
                py.push(ys(seg[i][1]));
            }
            if (g.monotone && px.length > wPlot * DECIMATE_POINTS_PER_PX) ({ px, py } = decimateColumns(px, py));
            pixelSegments.push({ px, py, rawCount: to - from + 1 });
            curvesForLabels.push({ xs: px, ys: py });
        }
        const sparse = visibleCount <= wPlot * SMOOTH_MAX_POINTS_PER_PX;
        const path = pixelSegments
            .map(s => (g.monotone && sparse ? monotonePath(s.px, s.py) : polylinePath(s.px, s.py)))
            .filter(Boolean)
            .join(" ");
        let dots = "";
        if (showPoints && visibleCount <= wPlot * DOTS_MAX_POINTS_PER_PX) {
            for (const s of pixelSegments) {
                for (let i = 0; i < s.px.length; i++) {
                    if (s.px[i] >= plot.l - 0.5 && s.px[i] <= plot.r + 0.5) dots += `M${s.px[i].toFixed(1)} ${s.py[i].toFixed(1)}h0`;
                }
            }
        }
        return { ...g, path, dots, minP, maxP, firstP, lastP };
    });

    // --- Маркеры и подписи значений ---
    const markers = [];
    const valueLabels = [];
    const endKeys = new Set(endCandidates.map(c => c.graph.index));
    for (const s of series) {
        if (!s.showMarker || !showPoints || !s.firstP) continue;
        const pts = [];
        const add = (p, kind) => {
            if (!p || p[1] < yMinV || p[1] > yMaxV) return;
            if (pts.some(q => q.p === p)) return;
            pts.push({ p, kind });
        };
        add(s.maxP, "max");
        add(s.minP, "min");
        add(s.firstP, "first");
        add(s.lastP, "last");
        for (const { p, kind } of pts) {
            const x = xs(p[0]), y = ys(p[1]);
            const fill = kind === "min" ? palette.info.main : kind === "max" ? palette.error.main : s.color;
            const r = Math.max(2.2, s.lineWidth * 1.2);
            markers.push({ key: `${s.index}-${kind}`, x, y, r, fill, opacity: s.opacity });
            if (!showLabels) continue;
            if (endKeys.has(s.index) && p === s.lastP) continue;
            const text = fmtValue(p[1]);
            valueLabels.push({
                key: `${s.index}-${kind}`,
                x, y,
                text,
                color: s.color,
                opacity: s.opacity,
                w: textWidth(text, VALUE_FONT) + 4,
                h: VALUE_FONT + 3,
                priority: kind === "max" || kind === "min" ? 3 : 2,
                prefer: kind === "max" ? { vx: 0, vy: -1 } : kind === "min" ? { vx: 0, vy: 1 } : kind === "first" ? { vx: 0.7, vy: -0.7 } : { vx: -0.7, vy: -0.7 }
            });
        }
    }

    // Подписи концов кривых справа, разведённые по вертикали
    for (let i = endCandidates.length - 1; i >= 0; i--) {
        const a = endCandidates[i];
        if (endCandidates.some((b, j) => j < i && fmtValue(b.point[1]) === fmtValue(a.point[1]) && Math.abs(ys(b.point[1]) - ys(a.point[1])) < 6)) endCandidates.splice(i, 1);
    }
    const endYs = spreadAlongAxis(endCandidates.map(c => ys(c.point[1])), VALUE_FONT + 2, plot.t + 4, plot.b - 2);
    const endLabels = endCandidates.map((c, i) => ({
        key: `end-${c.graph.index}`,
        x: plot.r + 5,
        y: endYs[i],
        anchorY: ys(c.point[1]),
        text: fmtValue(c.point[1]),
        color: c.graph.color,
        opacity: c.graph.opacity
    }));

    // --- Пределы и подписи осей ---
    const yLimitPx = yLimits.map(l => ys(l.value));
    const yLimitLabelYs = spreadAlongAxis(yLimitPx, AXIS_LABEL_GAP, plot.t, plot.b);
    const yLimitMarks = yLimits.map((l, i) => ({
        value: l.value,
        y: yLimitPx[i],
        labelY: yLimitLabelYs[i],
        color: l.color || palette.text.secondary,
        text: fmtYExact(l.value)
    }));
    const yTicks = yTickInfo.ticks.map(v => {
        const y = ys(v);
        const hidden = yLimitMarks.some(m => Math.abs(m.labelY - y) < AXIS_LABEL_GAP);
        return { value: v, y, text: fmtY(v), hidden, isLimit: yLimits.some(l => Math.abs(l.value - v) < 1e-9) };
    });

    // Единица оси значений — у верхней подписи деления (или в углу, если её там нет)
    {
        const topTick = yTicks.filter(t => !t.hidden).sort((a, b) => a.y - b.y)[0];
        if (topTick && topTick.y - plot.t < 12) topTick.text += units.y.length > 1 ? ` ${units.y}` : units.y;
    }
    const yUnitInCorner = !yTicks.some(t => !t.hidden && t.y - plot.t < 12);

    const xLines = (xAxis.lines || [])
        .filter(l => isNum(l?.value) && l.value >= xMinV - 1e-9 && l.value <= xMaxV + 1e-9)
        .map(l => ({ ...l, x: xs(l.value) }));
    const xTickXs = xTickInfo.ticks.map(v => xs(v));
    // Значение на оси подписываем только у «значимых» линий, не совпадающих с делением
    const xLimitMarks = xLines
        .filter(l => Math.abs(l.value - xMinV) > 1e-9 && Math.abs(l.value - xMaxV) > 1e-9)
        .filter(l => !xTickXs.some(tx => Math.abs(tx - l.x) < 1))
        .map(l => ({ value: l.value, x: l.x, color: l.color || palette.text.secondary, text: formatExact(l.value, xDecimals, xTickInfo.step) }));
    const xLimitLabelXs = spreadAlongAxis(
        xLimitMarks.map(m => m.x),
        AXIS_LABEL_GAP * 3,
        plot.l,
        plot.r
    );
    xLimitMarks.forEach((m, i) => { m.labelX = xLimitLabelXs[i]; });
    const xTicks = xTickInfo.ticks.map((v, i) => {
        const x = xTickXs[i];
        const hidden = xLimitMarks.some(m => Math.abs(m.labelX - x) < textWidth(m.text, TICK_FONT) / 2 + textWidth(fmtX(v), TICK_FONT) / 2 + 4);
        return { value: v, x, text: fmtX(v), hidden };
    });
    // Текстовые пометки на вертикальных линиях («Центр», «Гибочная зона…»)
    const xLineNotes = xLines.filter(l => l.label).map((l, i) => ({
        key: `xnote-${i}`,
        x: l.x,
        text: l.label,
        color: l.color || palette.text.secondary,
        anchor: l.x > plot.r - textWidth(l.label, TICK_FONT) - 6 ? "end" : "start"
    }));
    const yLineNotes = (yAxis.lines || []).filter(l => l?.label && isNum(l.value) && l.value >= yMinV && l.value <= yMaxV)
        .map((l, i) => ({ key: `ynote-${i}`, y: ys(l.value), text: l.label, color: l.color || palette.text.secondary }));

    // Пометки линий — препятствия для подписей значений
    const noteRects = [
        ...xLineNotes.map(n => {
            const w = textWidth(n.text, TICK_FONT) + 4;
            const x0 = n.anchor === "end" ? n.x - 3 - w : n.x + 1;
            return { l: x0, r: x0 + w, t: plot.t + 1, b: plot.t + 3 + TICK_FONT + 2 };
        }),
        ...yLineNotes.map(n => {
            const w = textWidth(n.text, TICK_FONT) + 4;
            return { l: plot.r - 3 - w, r: plot.r - 1, t: n.y - 2 - TICK_FONT - 1, b: n.y };
        })
    ];
    // Одинаковые значения в одной точке (несколько кривых сходятся) — одна подпись
    for (let i = valueLabels.length - 1; i >= 0; i--) {
        const a = valueLabels[i];
        if (valueLabels.some((b, j) => j < i && b.text === a.text && Math.hypot(b.x - a.x, b.y - a.y) < 6)) valueLabels.splice(i, 1);
    }
    const placement = valueLabels.length
        ? placeLabels({ labels: valueLabels, curves: curvesForLabels, markers, plot, obstacles: noteRects })
        : new Map();

    const yRanges = (yAxis.ranges || [])
        .filter(r => isNum(r?.from) && isNum(r?.to) && r.from !== r.to)
        .map((r, i) => {
            const a = ys(Math.max(Math.min(r.from, r.to), yMinV));
            const b = ys(Math.min(Math.max(r.from, r.to), yMaxV));
            return { key: `yr-${i}`, y: Math.min(a, b), h: Math.abs(a - b), color: r.color };
        })
        .filter(r => r.h > 0);
    const xRanges = (xAxis.ranges || [])
        .filter(r => isNum(r?.from) && isNum(r?.to) && r.from !== r.to)
        .map((r, i) => {
            const a = xs(Math.max(Math.min(r.from, r.to), xMinV));
            const b = xs(Math.min(Math.max(r.from, r.to), xMaxV));
            return { key: `xr-${i}`, x: Math.min(a, b), w: Math.abs(a - b), color: r.color };
        })
        .filter(r => r.w > 0);

    // Заливки: points — одно или несколько колец, разделённых null; одна заливка = один path
    const fillPolygons = (chart.fillPolygons || [])
        .map((polygon, i) => {
            let d = "";
            let ring = "";
            let ringLen = 0;
            const closeRing = () => {
                if (ringLen >= 3) d += ring + "Z";
                ring = "";
                ringLen = 0;
            };
            for (const p of polygon.points || []) {
                if (!Array.isArray(p) || !isNum(p[0]) || !isNum(p[1])) {
                    closeRing();
                    continue;
                }
                ring += `${ringLen ? "L" : "M"}${xs(p[0]).toFixed(1)} ${ys(p[1]).toFixed(1)}`;
                ringLen++;
            }
            closeRing();
            if (!d) return null;
            return {
                key: polygon.key ?? `poly-${i}`,
                d,
                color: polygon.color || palette.success.main,
                opacity: isNum(polygon.opacity) ? polygon.opacity : 0.15
            };
        })
        .filter(Boolean);

    return {
        width, height, plot, xs, ys, units, fmtX, fmtY, xDecimals, yDecimals,
        series, markers, valueLabels, placement, endLabels,
        yTicks, xTicks, minorX, minorY, yLimitMarks, xLimitMarks, xLines, xLineNotes, yLineNotes,
        probe: chart.probe?.field ? chart.probe : null,
        yRanges, xRanges, fillPolygons, yUnitInCorner, legend: layoutLegend(legendItems, left, width - 4 - headerReserve),
        xUnitVisible: !xTicks.some(t => !t.hidden && plot.r - t.x < textWidth(t.text, TICK_FONT) / 2 + textWidth(units.x, TICK_FONT) + 4) &&
            !xLimitMarks.some(m => plot.r - m.labelX < textWidth(m.text, TICK_FONT) / 2 + textWidth(units.x, TICK_FONT) + 4)
    };
}

// ============================================================================
// Перекрестие и всплывающие значения
// ============================================================================
// Значение поля { X, Y, V, nc, nr } в точке (x, y) — билинейно; null вне поля
function fieldValueAt(field, x, y) {
    const { X, Y, V, nc, nr } = field || {};
    if (!X || !Y || !V || nc < 2 || nr < 2) return null;
    const find = (arr, n, v) => {
        if (v < arr[0] || v > arr[n - 1]) return -1;
        let lo = 0, hi = n - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (arr[mid] <= v) lo = mid;
            else hi = mid;
        }
        return lo;
    };
    const c = find(X, nc, x), r = find(Y, nr, y);
    if (c < 0 || r < 0) return null;
    const sx = (x - X[c]) / ((X[c + 1] - X[c]) || 1);
    const sy = (y - Y[r]) / ((Y[r + 1] - Y[r]) || 1);
    const k = r * nc + c;
    const top = V[k] + sx * (V[k + 1] - V[k]);
    const bottom = V[k + nc] + sx * (V[k + nc + 1] - V[k + nc]);
    return top + sy * (bottom - top);
}

const HoverLayer = memo(function HoverLayer({ model, hover, palette }) {
    if (!hover) return null;
    const { plot, xs, ys, series, xDecimals, yDecimals, probe } = model;
    const xValue = xs.invert(hover.x);
    // Поле (сечение): координаты курсора и значение поля в этой точке, без точек на линиях
    const rows = probe
        ? []
        : series
            .filter(s => s.monotone)
            .map(s => ({ s, v: valueAtX(s.segments, xValue) }))
            .filter(r => r.v !== null);
    const crossColor = palette.text.primary;
    return (
        <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={plot.t} y2={plot.b} stroke={crossColor} strokeWidth={0.75} opacity={0.45} />
            {(probe || !rows.length) && (
                <line x1={plot.l} x2={plot.r} y1={hover.y} y2={hover.y} stroke={crossColor} strokeWidth={0.75} opacity={0.45} />
            )}
            {/* Обычные графики: точки на кривых в позиции курсора (на графике зон — нет) */}
            {rows.map(({ s, v }) => (
                <circle key={s.index} cx={hover.x} cy={ys(v)} r={2.6} fill={s.color} stroke={palette.background.paper} strokeWidth={1} />
            ))}
            <HoverReadout model={model} hover={hover} rows={rows} xValue={xValue} palette={palette} xDecimals={xDecimals} yDecimals={yDecimals} />
        </g>
    );
});

function HoverReadout({ model, hover, rows, xValue, palette, xDecimals, yDecimals }) {
    const { plot, units, ys, probe } = model;
    const yValue = ys.invert(hover.y);
    let header;
    let lines;
    if (probe) {
        const v = fieldValueAt(probe.field, xValue, yValue);
        header = `${formatNumber(xValue, xDecimals + 1)} × ${formatNumber(yValue, yDecimals + 1)} ${units.x}`;
        lines = [{ color: null, text: v === null ? "—" : `${formatNumber(v, probe.decimals ?? 1)}${probe.unit ?? ""}`, name: "" }];
    } else {
        header = `${formatNumber(xValue, xDecimals + 1)} ${units.x}`;
        lines = rows.length
            ? rows.slice(0, 8).map(({ s, v }) => ({ color: s.color, text: `${formatNumber(v, yDecimals + 1)}${units.y}`, name: s.name }))
            : [{ color: null, text: `${formatNumber(yValue, yDecimals + 1)} ${units.y}`, name: "" }];
    }
    const fs = 8.5;
    const lineH = fs + 3;
    const nameMax = 22;
    const widthText = Math.max(
        textWidth(header, fs),
        ...lines.map(l => textWidth(`${l.text}  ${(l.name || "").slice(0, nameMax)}`, fs) + 10)
    );
    const boxW = widthText + 10;
    const boxH = lineH * (lines.length + 1) + 6;
    const placeRight = hover.x + 10 + boxW <= plot.r;
    const bx = placeRight ? hover.x + 10 : hover.x - 10 - boxW;
    const by = Math.max(plot.t + 2, Math.min(plot.b - boxH - 2, hover.y - boxH / 2));
    return (
        <g transform={`translate(${bx.toFixed(1)},${by.toFixed(1)})`} fontSize={fs}>
            <rect width={boxW} height={boxH} rx={3} fill={palette.background.paper} fillOpacity={0.94} stroke={palette.divider} />
            <text x={5} y={3 + lineH * 0.8} fill={palette.text.secondary} fontWeight={600}>{header}</text>
            {lines.map((l, i) => (
                <g key={i} transform={`translate(5,${3 + lineH * (i + 1.8)})`}>
                    {l.color && <rect x={0} y={-fs * 0.72} width={6} height={6} rx={1} fill={l.color} />}
                    <text x={l.color ? 10 : 0} y={0} fill={palette.text.primary} fontWeight={700}>
                        {l.text}
                        {l.name && <tspan fill={palette.text.secondary} fontWeight={400}>{`  ${l.name.length > nameMax ? l.name.slice(0, nameMax - 1) + "…" : l.name}`}</tspan>}
                    </text>
                </g>
            ))}
        </g>
    );
}

// ============================================================================
// Переключатель видов (chart.views): сегменты справа в строке заголовка
// ============================================================================
const VIEW_FONT = 8;
const VIEW_PAD = 6;
const viewSegmentWidths = (views) => views.map(v => textWidth(v.label, VIEW_FONT) + 2 * VIEW_PAD);

function ViewSwitch({ views, active, onSelect, width, palette }) {
    const widths = viewSegmentWidths(views);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = width - 4 - total;
    return (
        <g fontSize={VIEW_FONT} role="radiogroup">
            <rect x={x} y={3} width={total} height={13} rx={3} fill="none" stroke={palette.divider} />
            {views.map((v, i) => {
                const x0 = x;
                x += widths[i];
                const isActive = v.key === active;
                const select = () => onSelect(v.key);
                return (
                    <g
                        key={v.key}
                        role="radio"
                        aria-checked={isActive}
                        tabIndex={0}
                        style={{ cursor: "pointer", outline: "none" }}
                        onClick={select}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }}
                    >
                        <rect
                            x={x0 + 1} y={4} width={widths[i] - 2} height={11} rx={2.5}
                            fill={isActive ? alpha(palette.text.primary, palette.mode === "dark" ? 0.18 : 0.1) : "transparent"}
                        />
                        <text
                            x={x0 + widths[i] / 2} y={9.5} textAnchor="middle" dominantBaseline="central"
                            fill={isActive ? palette.text.primary : palette.text.secondary} fontWeight={isActive ? 700 : 400}
                        >
                            {v.label}
                        </text>
                    </g>
                );
            })}
        </g>
    );
}

// ============================================================================
// Компонент
// ============================================================================
const SvgLineChart = ({ chart, maxHeight }) => {
    const theme = useTheme();
    const palette = theme.palette;
    const containerRef = useRef(null);
    const clipId = `plot-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [hover, setHover] = useState(null);
    const rafRef = useRef(0);
    const pendingHover = useRef(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        let frame = 0;
        const observer = new ResizeObserver(entries => {
            const box = entries[0]?.contentRect;
            if (!box?.width || !box?.height) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setSize(prev => (Math.abs(prev.width - box.width) < 0.5 && Math.abs(prev.height - box.height) < 0.5
                    ? prev
                    : { width: Math.round(box.width), height: Math.round(box.height) }));
            });
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    // Виды графика (например, зоны для нагрева и для паузы): вид заменяет поля chart
    const views = Array.isArray(chart?.views) && chart.views.length > 1 ? chart.views : null;
    const [viewKey, setViewKey] = useState(null);
    const activeView = views ? (views.find(v => v.key === viewKey) || views.find(v => v.key === chart.defaultView) || views[0]) : null;
    const effectiveChart = useMemo(() => {
        if (!activeView) return chart;
        const { key, label, ...overrides } = activeView;
        return { ...chart, ...overrides };
    }, [chart, activeView]);
    const headerReserve = views ? viewSegmentWidths(views).reduce((a, b) => a + b, 0) + 12 : 0;

    const model = useMemo(
        () => (effectiveChart && size.width > 40 && size.height > 30
            ? buildChartModel(effectiveChart, size.width, size.height, palette, { headerReserve })
            : null),
        [effectiveChart, size.width, size.height, palette, headerReserve]
    );

    const height = maxHeight || 150;
    const borderColor = chart?.status?.type === "error"
        ? palette.error.main
        : chart?.status?.type === "warning" || chart?.status?.type === "warn"
            ? palette.warning.main
            : palette.divider;

    const onPointerMove = (e) => {
        if (!model) return;
        const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
        const x = Math.max(model.plot.l, Math.min(model.plot.r, e.clientX - rect.left));
        const y = Math.max(model.plot.t, Math.min(model.plot.b, e.clientY - rect.top));
        pendingHover.current = { x, y };
        if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = 0;
                setHover(pendingHover.current);
            });
        }
    };
    const onPointerLeave = () => {
        pendingHover.current = null;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        setHover(null);
    };

    const gridColor = palette.divider;
    const axisColor = palette.text.secondary;
    const haloColor = palette.background.paper;

    return (
        <Paper
            ref={containerRef}
            variant="outlined"
            sx={{
                borderColor,
                boxShadow: "none",
                width: "100%",
                height: `${height}px`,
                boxSizing: "border-box",
                overflow: "hidden",
                bgcolor: "background.paper",
                fontFamily: FONT_FAMILY,
                userSelect: "none",
                touchAction: "pan-y"
            }}
        >
            {model && (
                <svg
                    width={model.width}
                    height={model.height}
                    style={{ display: "block", fontFamily: FONT_FAMILY, fontVariantNumeric: "tabular-nums" }}
                    shapeRendering="geometricPrecision"
                    textRendering="optimizeLegibility"
                >
                    <defs>
                        <clipPath id={clipId}>
                            <rect x={model.plot.l} y={model.plot.t} width={model.plot.r - model.plot.l} height={model.plot.b - model.plot.t} />
                        </clipPath>
                    </defs>

                    {/* Фон области графика */}
                    <rect
                        x={model.plot.l} y={model.plot.t}
                        width={model.plot.r - model.plot.l} height={model.plot.b - model.plot.t}
                        fill={alpha(palette.text.primary, palette.mode === "dark" ? 0.025 : 0.012)}
                    />

                    {/* Диапазоны */}
                    {model.yRanges.map(r => (
                        <rect key={r.key} x={model.plot.l} y={r.y} width={model.plot.r - model.plot.l} height={r.h} fill={r.color} opacity={RANGE_OPACITY} />
                    ))}
                    {model.xRanges.map(r => (
                        <rect key={r.key} x={r.x} y={model.plot.t} width={r.w} height={model.plot.b - model.plot.t} fill={r.color} opacity={RANGE_OPACITY} />
                    ))}

                    {/* Сетка: мелкая и основная */}
                    <path
                        d={model.minorX.map(x => `M${x.toFixed(1)} ${model.plot.t}V${model.plot.b}`).join("") +
                            model.minorY.map(y => `M${model.plot.l} ${y.toFixed(1)}H${model.plot.r}`).join("")}
                        stroke={gridColor} strokeWidth={0.5} opacity={0.35} fill="none"
                    />
                    <path
                        d={model.xTicks.map(t => `M${t.x.toFixed(1)} ${model.plot.t}V${model.plot.b}`).join("") +
                            model.yTicks.filter(t => !t.isLimit).map(t => `M${model.plot.l} ${t.y.toFixed(1)}H${model.plot.r}`).join("")}
                        stroke={gridColor} strokeWidth={0.75} fill="none"
                    />

                    {/* Заливки областей (изотермы) */}
                    <g clipPath={`url(#${clipId})`} pointerEvents="none">
                        {model.fillPolygons.map(p => (
                            <path key={p.key} d={p.d} fill={p.color} fillOpacity={p.opacity} fillRule="nonzero" stroke="none" />
                        ))}
                    </g>

                    {/* Линии пределов */}
                    {model.yLimitMarks.map((m, i) => (
                        <line key={`yl-${i}`} x1={model.plot.l} x2={model.plot.r} y1={m.y} y2={m.y} stroke={m.color} strokeWidth={1} strokeDasharray="5 3" opacity={0.75} />
                    ))}
                    {model.xLines.map((l, i) => (
                        <line
                            key={`xl-${i}`} x1={l.x} x2={l.x} y1={model.plot.t} y2={model.plot.b}
                            stroke={l.color || axisColor} strokeWidth={l.lineWidth || 1}
                            strokeDasharray={l.dashArray || "5 3"} opacity={0.75}
                        />
                    ))}

                    {/* Кривые */}
                    <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
                        {model.series.map(s => (
                            <path key={`s-${s.index}`} d={s.path} stroke={s.color} strokeWidth={s.lineWidth} opacity={s.opacity} strokeDasharray={s.dashArray || undefined} />
                        ))}
                        {model.series.map(s => s.dots && (
                            <path key={`d-${s.index}`} d={s.dots} stroke={s.color} strokeWidth={Math.max(1.6, s.lineWidth * 1.6)} opacity={s.opacity * 0.55} />
                        ))}
                    </g>

                    {/* Рамка */}
                    <rect
                        x={model.plot.l} y={model.plot.t}
                        width={model.plot.r - model.plot.l} height={model.plot.b - model.plot.t}
                        fill="none" stroke={axisColor} strokeOpacity={0.55} strokeWidth={0.75}
                    />

                    {/* Деления и подписи осей */}
                    <g fontSize={TICK_FONT} fill={axisColor}>
                        {model.yTicks.map(t => !t.hidden && (
                            <text key={`yt-${t.value}`} x={model.plot.l - 4} y={t.y} textAnchor="end" dominantBaseline="central">{t.text}</text>
                        ))}
                        {model.xTicks.map(t => !t.hidden && (
                            <text key={`xt-${t.value}`} x={t.x} y={model.plot.b + 4} textAnchor="middle" dominantBaseline="hanging">{t.text}</text>
                        ))}
                        <text x={model.plot.r} y={model.plot.b + 4} textAnchor="end" dominantBaseline="hanging" opacity={0.8}>
                            {model.xUnitVisible ? model.units.x : ""}
                        </text>
                    </g>
                    <g fontSize={TICK_FONT} fontWeight={700}>
                        {model.yLimitMarks.map((m, i) => (
                            <text key={`ylt-${i}`} x={model.plot.l - 4} y={m.labelY} textAnchor="end" dominantBaseline="central" fill={m.color}>{m.text}</text>
                        ))}
                        {model.xLimitMarks.map((m, i) => (
                            <text key={`xlt-${i}`} x={m.labelX} y={model.plot.b + 4} textAnchor="middle" dominantBaseline="hanging" fill={m.color}>{m.text}</text>
                        ))}
                    </g>
                    {model.yUnitInCorner && (
                        <text x={model.plot.l - 4} y={model.plot.t + 1} fontSize={TICK_FONT} fill={axisColor} textAnchor="end" dominantBaseline="hanging" opacity={0.8}>{model.units.y}</text>
                    )}

                    {/* Пометки на линиях */}
                    <g fontSize={TICK_FONT} fontWeight={600} stroke={haloColor} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                        {model.xLineNotes.map(n => (
                            <text key={n.key} x={n.anchor === "end" ? n.x - 3 : n.x + 3} y={model.plot.t + 3} textAnchor={n.anchor} dominantBaseline="hanging" fill={n.color}>{n.text}</text>
                        ))}
                        {model.yLineNotes.map(n => (
                            <text key={n.key} x={model.plot.r - 3} y={n.y - 2} textAnchor="end" fill={n.color}>{n.text}</text>
                        ))}
                    </g>

                    {/* Маркеры экстремумов и концов */}
                    {model.markers.map(m => (
                        <circle key={m.key} cx={m.x} cy={m.y} r={m.r} fill={m.fill} stroke={haloColor} strokeWidth={1} opacity={m.opacity} />
                    ))}

                    {/* Подписи значений с выносками */}
                    <g fontSize={VALUE_FONT} fontWeight={700}>
                        {model.valueLabels.map(l => {
                            const p = model.placement.get(l.key);
                            if (!p) return null;
                            const ex = Math.max(p.l, Math.min(p.r, l.x));
                            const ey = Math.max(p.t, Math.min(p.b, l.y));
                            return (
                                <g key={l.key} opacity={l.opacity}>
                                    {p.leader && <line x1={l.x} y1={l.y} x2={ex} y2={ey} stroke={l.color} strokeWidth={0.6} opacity={0.7} />}
                                    <text
                                        x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="central" fill={l.color}
                                        stroke={haloColor} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
                                    >
                                        {l.text}
                                    </text>
                                </g>
                            );
                        })}
                    </g>

                    {/* Значения на концах кривых (справа от рамки) */}
                    <g fontSize={VALUE_FONT} fontWeight={700}>
                        {model.endLabels.map(l => (
                            <g key={l.key} opacity={l.opacity}>
                                {Math.abs(l.y - l.anchorY) > 1.5 && (
                                    <path d={`M${model.plot.r} ${l.anchorY.toFixed(1)}L${(l.x - 1).toFixed(1)} ${l.y.toFixed(1)}`} stroke={l.color} strokeWidth={0.6} fill="none" opacity={0.7} />
                                )}
                                <text x={l.x} y={l.y} dominantBaseline="central" fill={l.color}>{l.text}</text>
                            </g>
                        ))}
                    </g>

                    {views && (
                        <ViewSwitch views={views} active={activeView.key} onSelect={setViewKey} width={model.width} palette={palette} />
                    )}

                    {model.legend.length > 0 && (
                        <g fontSize={TICK_FONT} fill={axisColor}>
                            {model.legend.map((it, i) => (
                                <g key={`lg-${i}`} transform={`translate(${it.x},4)`}>
                                    <rect width={8} height={8} rx={1.5} fill={it.color} fillOpacity={isNum(it.opacity) ? it.opacity : 1}
                                        stroke={it.stroke || it.color} strokeOpacity={0.9} strokeWidth={0.75} />
                                    <text x={11} y={4} dominantBaseline="central">{it.label}</text>
                                </g>
                            ))}
                        </g>
                    )}

                    <HoverLayer model={model} hover={hover} palette={palette} />

                    {/* Область захвата указателя */}
                    <rect
                        x={model.plot.l} y={model.plot.t}
                        width={model.plot.r - model.plot.l} height={model.plot.b - model.plot.t}
                        fill="transparent"
                        style={{ cursor: "crosshair" }}
                        onPointerMove={onPointerMove}
                        onPointerDown={onPointerMove}
                        onPointerLeave={onPointerLeave}
                    />
                </svg>
            )}
        </Paper>
    );
};

SvgLineChart.displayName = "SvgLineChart";
export default memo(SvgLineChart);
