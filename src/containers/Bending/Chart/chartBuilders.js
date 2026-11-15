import { alpha } from "@mui/material/styles";
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

export const createTemperatureYAxis = (material, colors) => {
    const { glassTransitionTemp: tg, decompositionTemp: decomp, minFormingTemp: minForm, maxFormingTemp: maxForm } = material || {};
    if (tg == null || decomp == null) return { unit: "°", lines: [], ranges: [] };

    return {
        unit: "°",
        lines: [
            { value: Number(tg), color: colors.warningMain },
            { value: Number(decomp), color: colors.errorMain },
        ],
        ranges: [
            { from: Number(minForm ?? 0), to: Number(maxForm ?? 0), color: colors.successMain },
        ],
    };
};

const createHorizontalXAxis = (width, finalXTgPauseValue, colors) => {
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

    if (finalXTgPauseValue != null) {
        const label = `Гибочная зона (${(finalXTgPauseValue * 2).toFixed(1)} мм)`;
        lines.push(
            { value: finalXTgPauseValue, color: colors.warningMain, lineWidth: 1.5, dashArray: "4 4", label },
            { value: -finalXTgPauseValue, color: colors.warningMain, lineWidth: 1.5, dashArray: "4 4" }
        );
    }

    return { unit: "mm", lines, ranges: [] };
};

const createContoursAxes = (width, contourGraphsRaw, lastXCoord, matKFactor, colors) => {
    const allXCoords = (contourGraphsRaw || [])
        .flatMap((g) => (g.points || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0])).map((p) => Math.abs(p[0])));
    const maxXRaw = allXCoords.length > 0 ? Math.max(...allXCoords) : width > 0 ? width / 2 : 15;
    const roundedXMax = Math.ceil(maxXRaw / 5) * 5;

    const xLines = [{ value: 0, color: colors.textSecondary, label: "Центр" }];
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
                { value: lastXCoord * matKFactor, color: colors.infoMain, label: `K = ${matKFactor}` },
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
            xTgPauseValue: null,
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
        thickness, width, finalXTgPauseValue,
        vertPointsHeating, vertPointsPause,
        rawHorTopH, rawHorMidH, rawHorBotH,
        rawHorTopP, rawHorMidP, rawHorBotP,
        contourGraphsRaw, fillPolygonsRaw, xCoordinatesMm,
    } = rawData;

    const contourGraphs = (contourGraphsRaw || []).map((g) => {
        const style = { lineWidth: g.phase === "Pause" ? 1.6 : 0.7, opacity: 0.7, color: colors.textPrimary };
        if (g.name === "Tg") style.color = colors.primaryMain;
        else if (g.name === "T min") style.color = g.phase === "Heating" ? colors.successMain : colors.successDark;
        else if (g.name === "T max") style.color = colors.successMain;
        else if (g.name === "Decomposition") {
            style.color = g.phase === "Heating" ? colors.errorMain : colors.errorDark;
            style.opacity = 1;
        }
        return { ...g, ...style };
    });

    const polygonStyleMap = {
        "Solid Plastic":      { color: colors.infoMain,    opacity: 0.3 },
        "High Elastic":       { color: colors.successMain, opacity: 0.05 },
        "Optimal Bending":    { color: colors.successMain, opacity: 0.15 },
        "High Temperature":   { color: colors.warningMain, opacity: 0.1 },
        "Decomposition Risk": { color: colors.errorMain,   opacity: 0.3 },
    };

    const fillPolygons = (fillPolygonsRaw || []).map((p) => ({
        ...p,
        color: polygonStyleMap[p.name]?.color || colors.successMain,
        opacity: polygonStyleMap[p.name]?.opacity || 0.15,
    }));

    const lastXCoord = Array.isArray(xCoordinatesMm) && xCoordinatesMm.length > 0 ? xCoordinatesMm[xCoordinatesMm.length - 1] : -10;

    return {
        xTgPauseValue: finalXTgPauseValue,
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
                { name: "Верхняя поверхность", points: rawHorTopH || [], color: layerColors.top,    opacity: 0.8, lineWidth: 0.6 },
                { name: "Середина листа",      points: rawHorMidH || [], color: layerColors.center, opacity: 0.8, lineWidth: 0.6 },
                { name: "Нижняя поверхность",  points: rawHorBotH || [], color: layerColors.bottom, opacity: 0.8, lineWidth: 0.6 },
                { name: "Верхняя поверхность пауза", points: rawHorTopP || [], color: layerColors.top,    opacity: 1, lineWidth: 1.2 },
                { name: "Середина листа пауза",      points: rawHorMidP || [], color: layerColors.center, opacity: 1, lineWidth: 1.2 },
                { name: "Нижняя поверхность пауза",  points: rawHorBotP || [], color: layerColors.bottom, opacity: 1, lineWidth: 1.2 },
            ],
            axes: {
                x: createHorizontalXAxis(width, finalXTgPauseValue, colors),
                y: chart3YAxis,
            },
        },
        contours2D: {
            graphs: contourGraphs,
            showLabels: false,
            showPoints: false,
            axes: createContoursAxes(width, contourGraphsRaw, lastXCoord, matKFactor, colors),
            fillPolygons,
        },
    };
};
