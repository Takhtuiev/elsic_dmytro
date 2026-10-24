import React, { useMemo, useState, useEffect, useRef } from "react";
import { Paper, useTheme } from "@mui/material";

// --- Константы конфигурации ---
const GRID_STEP_C = 10;
const Y_AXIS_LABEL_MIN_DISTANCE = 12;
const X_AXIS_LABEL_MIN_DISTANCE = 35;
const X_AXIS_LABEL_OFFSET = 5;
const Y_AXIS_LABEL_OFFSET = 5;
const LIMIT_RANGE_OPACITY = 0.06;
const SHOW_ALL_POINTS = true;

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

const SvgLineChart = ({ chart, maxHeight }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
    const [placedMap, setPlacedMap] = useState({});

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

                const labelObj = { ...p, type: graph.index === 0 ? "main" : "cooldown", graphIndex: graph.index, order: (p.id === 0 || p.id === lastId) ? 0 : 1, color: graph.color, opacity: graph.opacity, x: xs(pt[0]), y: ys(p.val), rawX: pt[0] };
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

        return {
            width, height, pad, wPlot, hPlot, xMin, xMax, tMin, gridLinesY,
            xAbsoluteMin, xAbsoluteMax, tAbsoluteMin, tAbsoluteMax,
            yLimitLineData: yLimits.lines, yLimitRangeData: yLimits.ranges, xLimitLineData: xLimits.lines, xLimitRangeData: xLimits.ranges,
            graphData, fillPolygonsData, yAxisLabels, rightAxisLabels, xAxisLabels,
            axes, showPoints, showLabels, xs, ys, sortedLabels, plotLeft, plotRight, plotTop, plotBottom,
            borderColor: chart.status?.type === "error" ? theme.palette.error.main : chart.status?.type === "warning" ? theme.palette.warning.main : theme.palette.divider,
        };
    }, [chart, dimensions, theme]);

// Ссылка для хранения инстанса воркера, чтобы он не пересоздавался при каждом рендере
    const workerInstanceRef = useRef(null);

// Эффект 1: Создание воркера ОДИН РАЗ при монтировании компонента
    useEffect(() => {
        // Используем стандартный современный импорт воркера
        workerInstanceRef.current = new Worker(new URL("./labels.worker.js", import.meta.url));

        // Слушаем ответы воркера и записываем их в стейт
        workerInstanceRef.current.onmessage = function (e) {
            setPlacedMap(e.data.placedMap);
        };

        // Убиваем воркер только тогда, когда график полностью удаляется с экрана
        return () => {
            if (workerInstanceRef.current) {
                workerInstanceRef.current.terminate();
            }
        };
    }, []);

// Эффект 2: Обработка изменения размеров (ресайза)
    useEffect(() => {
        // 1. Мгновенно очищаем подписи в стейте — график сразу станет "голым" и плавным
        setPlacedMap({});

        // 2. Мгновенно отправляем воркеру сигнал STOP, если он выполнял прошлый расчет
        if (workerInstanceRef.current) {
            workerInstanceRef.current.postMessage({ type: "STOP" });
        }

        if (!chartData || !chartData.sortedLabels.length) {
            return;
        }

        // 3. Заводим таймер на 100 мс. Расчет начнется, только когда пользователь замрет
        const timerId = setTimeout(() => {
            if (!workerInstanceRef.current) return;


            workerInstanceRef.current.postMessage({
                sortedLabels: chartData.sortedLabels,
                graphData: chartData.graphData.map(g => {
                    const len = g.points.length;
                    const xsProj = new Float64Array(len);
                    const ysProj = new Float64Array(len);

                    for (let i = 0; i < len; i++) {
                        const pt = g.points[i];

                        if (pt && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
                            xsProj[i] = chartData.xs(pt[0]);
                            ysProj[i] = chartData.ys(pt[1]);
                        } else {
                            xsProj[i] = NaN;
                            ysProj[i] = NaN;
                        }
                    }

                    return {
                        index: g.index,
                        points: g.points,
                        xsProj,
                        ysProj
                    };
                }),
                plotLeft: chartData.plotLeft,
                plotRight: chartData.plotRight,
                plotTop: chartData.plotTop,
                plotBottom: chartData.plotBottom,
                axes: chartData.axes,
                xMax: chartData.xMax
            });

        }, 100);

        return () => clearTimeout(timerId);
    }, [chartData]);


    if (!chartData) return null;

    const {
        width, height, pad, wPlot, hPlot, xMin, tMin, gridLinesY,
        xAbsoluteMin, xAbsoluteMax, tAbsoluteMin, tAbsoluteMax,
        yLimitLineData, yLimitRangeData, xLimitLineData, xLimitRangeData,
        graphData, fillPolygonsData, yAxisLabels, rightAxisLabels, xAxisLabels,
        axes, showPoints, showLabels, borderColor, xs, ys,
    } = chartData;

    const formatValue = (value, unit) => {
        const val = Number(value);
        if (!Number.isFinite(val)) return "";
        const formatted = val.toFixed(1);
        if (/\.0$/.test(formatted)) {
            return `${formatted.replace(/\.0$/, "")}${unit}`;
        }
        return formatted;
    };

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
                    Math.abs(line.value - xMin) !== 0 && (
                        <line key={`x-limit-line-${line.index}`} x1={line.x} y1={pad.top} x2={line.x} y2={height - pad.bottom} stroke={line.color || theme.palette.text.secondary} strokeWidth={1} strokeDasharray="4 2" opacity=".5"/>
                    )
                ))}

                <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".55" />
                <line x1={width - pad.right} y1={pad.top} x2={width - pad.right} y2={height - pad.bottom} stroke={theme.palette.text.secondary} strokeWidth={1} opacity=".2" />

                {yLimitLineData.map(line => (
                    Math.abs(line.value - tMin) !== 0 && <line key={`y-limit-line-${line.index}`} x1={pad.left} y1={line.y} x2={width - pad.right} y2={line.y} stroke={line.color || theme.palette.text.secondary} strokeWidth={1} strokeDasharray="4 2" opacity=".5" />
                ))}

                {yAxisLabels.map(label => (
                    <text key={`y-limit-label-${label.index}`} x={pad.left - Y_AXIS_LABEL_OFFSET} y={label.y} textAnchor="end" dominantBaseline="middle" fontSize={8} fontWeight="bold" fill={label.color}>
                        {formatValue(label.value, axes.y)}
                    </text>
                ))}

                {showLabels && rightAxisLabels.map((label, idx) => (
                    <text key={`right-axis-label-${label.graphIndex}-${idx}`} x={width - pad.right + Y_AXIS_LABEL_OFFSET} y={label.y} textAnchor="start" dominantBaseline="middle" fontSize={8} fontWeight="bold" fill={label.color} opacity={label.opacity}>
                        {Math.round(label.value)}{axes.y}
                    </text>
                ))}

                {xAxisLabels.map(label => (
                    <text key={`x-limit-label-${label.index}`} x={label.x} y={height - pad.bottom + X_AXIS_LABEL_OFFSET} textAnchor="middle" dominantBaseline="hanging" fontSize={8} fontWeight="bold" fill={label.color}>
                        {formatValue(label.value, axes.x)}
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
                                {/* 1. Убираем жесткую проверку "&& labelPlaced", чтобы элемент присутствовал в DOM для анимации */}
                                {showLabels && (
                                    <text
                                        /* 2. Координаты фиксируем строго на точке графика (pointX, pointY), без прибавления dx/dy сюда */
                                        x={pointX}
                                        y={pointY}
                                        textAnchor={labelPlaced ? labelPlaced.textAnchor : "middle"}
                                        dominantBaseline="middle"
                                        fontSize={9}
                                        fontWeight="bold"
                                        fill={graph.color}
                                        style={{
                                            // 3. Добавляем плавный переход (транзишн) для прозрачности и движения
                                            transition: "opacity 0.25s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",

                                            // 4. Намертво привязываем точку трансформации к маркеру, чтобы избежать прыжков текста
                                            transformOrigin: `${pointX}px ${pointY}px`,

                                            // 5. Управляем прозрачностью в зависимости от готовности расчетов воркера
                                            opacity: labelPlaced ? graph.opacity : 0,

                                            // 6. Весь сдвиг (dx/dy от воркера) + масштаб и эффект выплывания делаем через CSS transform
                                            transform: labelPlaced
                                                ? `translate(${labelPlaced.dx}px, ${labelPlaced.dy}px) scale(1)`
                                                : `translate(0px, 3px) scale(0.85)`,

                                            // 7. Отключаем клики по скрытому тексту, пока воркер считает
                                            pointerEvents: labelPlaced ? "auto" : "none"
                                        }}
                                    >
                                        {/* Обратите внимание: в оригинале у вас было pt[1], используйте то выражение для значения, которое работает у вас */}
                                        {Math.round(pt[1] ?? pt)}{axes.y}
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
