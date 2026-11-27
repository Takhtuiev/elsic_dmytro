import { alpha } from "@mui/material/styles";
import {
    temperatureAxis,
    temperatureLevelColor,
    temperatureZoneLegendItem,
    temperatureZoneStyle
} from "./temperatureZones";
import {
    chartDataCH1,
    chartDataCH2, chartDataCH3, chartDataCH4,
    chartDataCH5,
    chartDataCH6,
    chartDataCH7,
    chartDataCH8
} from "../../IngenieurBerechnungen/chartData";

export const extractThemeColors = (palette) => ({
    textPrimary: palette.text.primary,
    textSecondary: palette.text.secondary,
    textDisabled: palette.text.disabled,
    primaryMain: palette.primary.main,
    warningMain: palette.warning.main,
    warningDark: palette.warning.dark,
    errorMain: palette.error.main,
    errorDark: palette.error.dark,
    successMain: palette.success.main,
    successDark: palette.success.dark,
    infoMain: palette.info.main,
    divider: palette.divider,
});

export const getLayerColors = (colors) => ({
    top: colors.warningMain,
    center: colors.successMain,
    bottom: colors.errorMain,
});

// Ось температуры материала: зоны и границы — единая схема из temperatureZones.js
export const createTemperatureYAxis = (material, colors) => temperatureAxis(material, colors);

const createHorizontalXAxis = (width, colors) => {
    const lines = [{ value: 0, color: colors.textSecondary }];

    if (width > 0) {
        const maxVal = width / 2;
        for (let val = 5; val <= maxVal; val += 5) {
            lines.push(
                { value: val, color: alpha(colors.divider, 0.25) },
                { value: -val, color: alpha(colors.divider, 0.25) }
            );
        }
    }

    return { unit: "mm", lines, ranges: [] };
};

const fmtMm = (v) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * Гибочная зона на графике «Temperature across width».
 * - фактическая зона (вся толщина ≥ уровня): всегда зелёная заливка + сплошные границы со значением на оси;
 * - требуемая зона θ·(r + K·t): пунктир без значений на оси. Если она шире фактической —
 *   пунктир красный, а недостающие полосы между зелёной зоной и пунктиром залиты красным.
 * Порог по температуре уже виден горизонтальной полосой окна формования, поэтому в подписи только ширины.
 */
export const withBendZoneOverlay = (chart, { halfWidth, requiredWidth, colors }) => {
    if (!chart?.axes?.x) return chart;
    const hasZone = Number.isFinite(halfWidth) && halfWidth > 0;
    const hasRequired = Number.isFinite(requiredWidth) && requiredWidth > 0;
    if (!hasZone && !hasRequired) return chart;

    const zoneHalf = hasZone ? halfWidth : 0;
    const reqHalf = hasRequired ? requiredWidth / 2 : 0;
    const short = hasRequired && reqHalf > zoneHalf + 1e-9;
    const ok = colors.successMain;
    const bad = colors.errorMain;
    const FILL = 0.2;

    const lines = [...(chart.axes.x.lines || [])];
    const ranges = [...(chart.axes.x.ranges || [])];
    const parts = [hasZone ? `Bending zone ${fmtMm(2 * zoneHalf)} mm` : "No bending zone"];
    if (hasRequired) parts.push(`required ${fmtMm(requiredWidth)} mm`);
    const label = parts.join(" · ");
    const labelColor = short ? bad : ok;

    if (hasZone) {
        lines.push(
            { value: -zoneHalf, color: ok, lineWidth: 1.5, dashArray: "none", opacity: 1 },
            { value: zoneHalf, color: ok, lineWidth: 1.5, dashArray: "none", opacity: 1 }
        );
        ranges.push({ from: -zoneHalf, to: zoneHalf, color: ok, opacity: FILL, label, labelColor });
    }
    if (hasRequired) {
        const reqColor = short ? bad : ok;
        lines.push(
            { value: -reqHalf, color: reqColor, lineWidth: 1, dashArray: "2 3", opacity: 0.85, axisMark: false },
            { value: reqHalf, color: reqColor, lineWidth: 1, dashArray: "2 3", opacity: 0.85, axisMark: false }
        );
        if (short) {
            if (hasZone) {
                // Недостающая ширина с обеих сторон
                ranges.push(
                    { from: -reqHalf, to: -zoneHalf, color: bad, opacity: FILL },
                    { from: zoneHalf, to: reqHalf, color: bad, opacity: FILL }
                );
            } else {
                ranges.push({ from: -reqHalf, to: reqHalf, color: bad, opacity: FILL, label, labelColor });
            }
        }
    }

    return { ...chart, axes: { ...chart.axes, x: { ...chart.axes.x, lines, ranges } } };
};

const createContoursAxes = (width, contourGraphsRaw, lastXCoord, matKFactor, colors) => {
    // Без промежуточных массивов и Math.max(...): на больших контурах это переполняет стек
    let maxAbsX = -Infinity;
    for (const g of contourGraphsRaw || []) {
        for (const p of g.points || []) {
            if (Array.isArray(p) && Number.isFinite(p[0]) && Math.abs(p[0]) > maxAbsX) maxAbsX = Math.abs(p[0]);
        }
    }
    const maxXRaw = Number.isFinite(maxAbsX) ? maxAbsX : width > 0 ? width / 2 : 15;
    const roundedXMax = Math.ceil(maxXRaw / 5) * 5;

    const xLines = [{ value: 0, color: colors.textSecondary }];
    if (width > 0) {
        for (let val = 5; val <= roundedXMax; val += 5) {
            xLines.push(
                { value: val, color: alpha(colors.divider, 0.25) },
                { value: -val, color: alpha(colors.divider, 0.25) }
            );
        }
    }

    return {
        x: { unit: "mm", min: -roundedXMax, max: roundedXMax, lines: xLines, ranges: [] },
        y: {
            unit: "mm",
            min: lastXCoord,
            max: 0,
            lines: [
                { value: lastXCoord / 2, color: alpha(colors.divider, 0.3) },
                { value: lastXCoord * matKFactor, color: colors.infoMain },
            ],
            ranges: [],
        },
    };
};

export const buildTimeDynamicsChart = (rawData, heatTimeSec, baseYAxis, colors, layerColors) => {
    const empty = { graphs: [], axes: { x: { unit: "s", lines: [], ranges: [] }, y: baseYAxis } };
    if (!rawData?.graphsChart2Raw) return empty;

    const styleMap = {
        frontHeat:  { color: layerColors.top,    opacity: 1, lineWidth: 1, showMarker: false },
        centerHeat: { color: layerColors.center, opacity: 1, lineWidth: 1, showMarker: false },
        backHeat:   { color: layerColors.bottom, opacity: 1, lineWidth: 1, showMarker: false },
        frontCool:  { color: layerColors.top,    opacity: 1, lineWidth: 1, showMarker: true },
        centerCool: { color: layerColors.center, opacity: 1, lineWidth: 1, showMarker: true },
        backCool:   { color: layerColors.bottom, opacity: 1, lineWidth: 1, showMarker: true },
    };

    return {
        graphs: rawData.graphsChart2Raw.map((g) => ({ ...g, ...styleMap[g.typeKey] })),
        axes: {
            x: { unit: "s", lines: [{ value: heatTimeSec, color: colors.textSecondary }], ranges: [] },
            y: baseYAxis,
        },
    };
};

const MACHINE_CHARTS = {
    "H.P. Burger Line 1": { offsetSeconds: 105, top: chartDataCH1, bottom: chartDataCH2 },
    "Line 2":             { offsetSeconds: 27,  top: chartDataCH3, bottom: chartDataCH4 },
};

// Добавили параметр pidPhaseOffsetSeconds = 0 в конец аргументов
export const buildHeaterDynamicsChart = (
    rawData,
    heatTimeSec,
    colors,
    layerColors,
    machineName,
    pidPhaseOffsetSeconds = 0
) => {
    const defaultAxes = {
        x: { unit: "s", lines: [{ value: heatTimeSec, color: colors.textSecondary }], ranges: [] },
        y: { unit: "°", lines: [], ranges: [] },
    };

    if (!rawData?.graphsHeaterRaw?.length) {
        return { graphs: [], axes: defaultAxes };
    }

    const maxTime = rawData.graphsHeaterRaw.reduce((max, graph) => {
        const lastPoint = graph.points?.[graph.points.length - 1];
        return lastPoint && lastPoint[0] > max ? lastPoint[0] : max;
    }, 0);

    const styleMap = {
        topHeater:    { color: layerColors.top,    opacity: 1, lineWidth: 1.5, showMarker: false },
        bottomHeater: { color: layerColors.bottom, opacity: 1, lineWidth: 1.5, showMarker: false },
    };

    const heaterGraphs = rawData.graphsHeaterRaw.map((g) => ({ ...g, ...styleMap[g.typeKey] }));

    const config = MACHINE_CHARTS[machineName];
    if (!config) {
        return { graphs: heaterGraphs, axes: defaultAxes };
    }

    // Суммируем базовую точку синхронизации (105 или 27) и динамическое смещение станка
    const totalOffset = config.offsetSeconds + (Number.isFinite(pidPhaseOffsetSeconds) ? pidPhaseOffsetSeconds : 0);

    const sliceAndShiftPoints = (points) =>
        points
            .filter(([time]) => time >= totalOffset && time <= totalOffset + maxTime)
            .map(([time, temp]) => [time - totalOffset, temp]);

    const extraGraphs = [
        {
            name: "CH1",
            points: sliceAndShiftPoints(config.top),
            color: layerColors.top,
            opacity: 0.85,
            lineWidth: 0.5,
            showMarker: false,
        },
        {
            name: "CH2",
            points: sliceAndShiftPoints(config.bottom),
            color: layerColors.bottom,
            opacity: 0.85,
            lineWidth: 0.5,
            showMarker: false,
        },
    ];

    return {
        graphs: [...heaterGraphs, ...extraGraphs],
        axes: defaultAxes,
    };
};

export const buildSpatialCharts = (rawData, baseYAxis, ambientTemp, matKFactor, colors, layerColors) => {
    const chart3YAxis = baseYAxis.lines.length ? { ...baseYAxis, min: ambientTemp } : baseYAxis;

    if (!rawData) {
        return {
            bendZoneHalfWidth: null,
            bendZoneLevel: null,
            verticalSlice: { graphs: [], axes: { x: { unit: "mm", lines: [], ranges: [] }, y: baseYAxis } },
            horizontalWidth: { graphs: [], axes: { x: { unit: "mm", lines: [], ranges: [] }, y: chart3YAxis } },
            contours2D: {
                graphs: [],
                showLabels: false,
                showPoints: false,
                axes: { x: { unit: "mm", lines: [], ranges: [] }, y: { unit: "mm", min: -10, max: 0, lines: [], ranges: [] } },
                fillPolygons: [],
            },
        };
    }

    const {
        thickness, width, bendZoneHalfWidth, bendZoneLevel,
        vertPointsHeating, vertPointsPause,
        rawHorTopH, rawHorMidH, rawHorBotH,
        rawHorTopP, rawHorMidP, rawHorBotP,
        contourGraphsRaw, fillPolygonsRaw, fillPolygonsByPhase, sectionFields, xCoordinatesMm,
    } = rawData;

    // Изотермы: после паузы (момент гибки) — сплошные, в конце нагрева — тонкие штриховые
    // Изотермы выбранной фазы — сплошные и толще, другой фазы — тонкие штриховые
    const styleContours = (activePhase) => (contourGraphsRaw || []).map((g) => {
        const active = g.phase === activePhase;
        return {
            ...g,
            color: temperatureLevelColor(g.name, colors),
            lineWidth: active ? 1.4 : 0.8,
            opacity: active ? 0.95 : 0.55,
            dashArray: active ? null : "3 2",
            showMarker: false,
        };
    });

    // Зоны по температуре — единая схема (temperatureZones.js)
    const styleZones = (raw) => (raw || []).map((p) => ({ ...p, ...temperatureZoneStyle(p.name, colors) }));
    const zoneLegend = (zones) => zones.map((p) => temperatureZoneLegendItem({ key: p.name, lo: p.lo, hi: p.hi }, colors));

    // Два вида: зоны после паузы (момент гибки, по умолчанию) и в конце нагрева
    const zonesByPhase = {
        Pause: styleZones(fillPolygonsByPhase?.Pause ?? fillPolygonsRaw),
        Heating: styleZones(fillPolygonsByPhase?.Heating),
    };
    const contourViews = [
        // probe: при наведении — координаты курсора и температура сечения в этой точке
        { key: "Pause", label: "Pause", fillPolygons: zonesByPhase.Pause, legend: zoneLegend(zonesByPhase.Pause), graphs: styleContours("Pause"), probe: { field: sectionFields?.Pause, unit: "°", decimals: 1 } },
        { key: "Heating", label: "Heating", fillPolygons: zonesByPhase.Heating, legend: zoneLegend(zonesByPhase.Heating), graphs: styleContours("Heating"), probe: { field: sectionFields?.Heating, unit: "°", decimals: 1 } },
    ].filter((v) => v.fillPolygons.length || v.key === "Pause");
    const contourGraphs = contourViews[0].graphs;
    const fillPolygons = contourViews[0].fillPolygons;
    const legend = contourViews[0].legend;
    const probe = contourViews[0].probe;

    const lastXCoord = Array.isArray(xCoordinatesMm) && xCoordinatesMm.length > 0 ? xCoordinatesMm[xCoordinatesMm.length - 1] : -10;

    return {
        bendZoneHalfWidth,
        bendZoneLevel,
        verticalSlice: {
            graphs: [
                { name: "Heating (Vertical Slice)", points: vertPointsHeating || [], color: colors.textSecondary, opacity: 1, lineWidth: 1 },
                { name: "Cooling (Vertical Slice)", points: vertPointsPause || [], color: colors.textPrimary, opacity: 1, lineWidth: 1.6 },
            ],
            axes: {
                x: { unit: "mm", lines: [{ value: thickness / 2, color: colors.textSecondary }, { value: thickness * matKFactor, color: colors.infoMain }], ranges: [] },
                y: baseYAxis,
            },
        },
        horizontalWidth: {
            graphs: [
                { name: "Top surface (heating)", points: rawHorTopH || [], color: layerColors.top,    opacity: 0.8, lineWidth: 0.6 },
                { name: "Mid-plane (heating)",      points: rawHorMidH || [], color: layerColors.center, opacity: 0.8, lineWidth: 0.6 },
                { name: "Bottom surface (heating)",  points: rawHorBotH || [], color: layerColors.bottom, opacity: 0.8, lineWidth: 0.6 },
                { name: "Top surface (pause)", points: rawHorTopP || [], color: layerColors.top,    opacity: 1, lineWidth: 1.2 },
                { name: "Mid-plane (pause)",      points: rawHorMidP || [], color: layerColors.center, opacity: 1, lineWidth: 1.2 },
                { name: "Bottom surface (pause)",  points: rawHorBotP || [], color: layerColors.bottom, opacity: 1, lineWidth: 1.2 },
            ],
            axes: {
                x: createHorizontalXAxis(width, colors),
                y: chart3YAxis,
            },
        },
        contours2D: {
            graphs: contourGraphs,
            showLabels: false,
            showPoints: false,
            axes: createContoursAxes(width, contourGraphsRaw, lastXCoord, matKFactor, colors),
            fillPolygons,
            legend,
            probe,
            // Переключатель вида над графиком: каждый вид заменяет graphs / fillPolygons / legend
            views: contourViews.length > 1 ? contourViews : undefined,
            defaultView: "Pause",
        },
    };
};
