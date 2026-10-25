import React, { useEffect, useMemo, useRef, useState } from "react";
import {Box, LinearProgress, Typography, useTheme} from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./Chart/SvgLineChart";
import { validateProfile } from "./profileValidation";
import { formatTime } from "./formatters";
import { calculateMass, calculatePlasticZoneWidth, calculateMaxInnerRadius } from "./bendingMetrics";
import {useHeatingSimulation} from "./useHeatingSimulation";

const PARAMETER_TEXT_COLOR = "text.primary";
const PARAMETER_TEXT_SIZE = "0.8rem";

// ==========================================
// ХЕЛПЕРЫ ДЛЯ СТРУКТУРИРОВАННОЙ ПОДГОТОВКИ ОСЕЙ (ОПТИМИЗАЦИЯ)
// ==========================================

/**
 * Базовая температурная ось Y (используется для Графика 1 и Графика 2)
 */
const createTemperatureYAxis = (tg, decomp, minForm, maxForm, colors) => {
    if (tg == null || decomp == null) return { unit: "°", lines: [], ranges: [] };
    return {
        unit: "°",
        lines: [
            { value: Number(tg), color: colors.warningMain },
            { value: Number(decomp), color: colors.errorMain }
        ],
        ranges: [
            { from: Number(minForm ?? 0), to: Number(maxForm ?? 0), color: colors.successMain }
        ]
    };
};

/**
 * Ось X для горизонтального распределения (График 3)
 */
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

/**
 * Оси X и Y для 2D Контуров (График 4)
 */
const createContoursAxes = (width, contourGraphsRaw, lastXCoord, matKFactor, colors) => {
    // Расчет симметричных границ X
    const allXCoords = (contourGraphsRaw || [])
        .flatMap(g => (g.points || []).filter(p => p && Array.isArray(p) && Number.isFinite(p[0])).map(p => Math.abs(p[0])));
    const maxXRaw = allXCoords.length > 0 ? Math.max(...allXCoords) : (width > 0 ? width / 2 : 15);
    const roundedXMax = Math.ceil(maxXRaw / 5) * 5;

    // Сетка линий X
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
        x: {
            unit: "mm",
            min: -roundedXMax,
            max: roundedXMax,
            lines: xLines,
            ranges: []
        },
        y: {
            unit: "mm",
            min: lastXCoord,
            max: 0,
            lines: [
                { value: lastXCoord / 2, color: alpha(colors.divider, 0.3) },
                { value: lastXCoord * matKFactor, color: colors.infoMain, label: `K = ${matKFactor}` }
            ],
            ranges: []
        }
    };
};


const PartHeader = React.memo(({ partName, materialName, thickness }) => (
    <Box
        className="bend-preview-header"
        sx={{
            px: 1, py: 0.75, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center",
            borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0
        }}
    >
        <Typography variant="body2" fontWeight={600}>
            Part: <strong>{partName || "—"}</strong>
        </Typography>
        <Typography variant="body2">
            Material: <strong>{materialName || "—"}</strong>
        </Typography>
        <Typography variant="body2">
            Thickness: <strong>{thickness ?? "—"} mm</strong>
        </Typography>
    </Box>
));
PartHeader.displayName = "PartHeader";

const Parameters = React.memo(({
                                   width,
                                   thickness,
                                   density,
                                   blankLength,
                                   machineParams,
                                   heatingTimeSeconds,
                                   coolingTimeSeconds,
                                   calculationTimeMs,
                                   status,
                                   heatingDeltaT,
                                   pauseDeltaT,
                                   plasticZoneWidth,
                                   maxRadius,
                                   accuracyMetrics,
                                   workCounters
                               }) => {
    const mass = useMemo(
        () => calculateMass(blankLength, width, thickness, density),
        [blankLength, width, thickness, density]
    );

    const statusColor = status?.type === "error" ? "error" : status?.type === "warning" ? "warning" : "text.secondary";

    return (
        <Box className="bend-preview-parameters">
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                    Blank length: <strong>{Number.isFinite(blankLength) ? blankLength.toFixed(2) : "—"} mm</strong>
                </Typography>
                <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                    Width: <strong>{Number.isFinite(width) ? width : "—"} mm</strong>
                </Typography>
                <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                    Mass: <strong>{mass !== null && Number.isFinite(mass) ? mass.toFixed(3) : "—"} kg</strong>
                </Typography>
            </Box>

            {machineParams && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Stop pos: <strong>{machineParams.stopPosition ?? "—"} mm</strong>
                    </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Bar low: <strong>{machineParams.barLowering ?? "—"} mm</strong>
                    </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Angle: <strong>{machineParams.bendAngle ?? "—"}°</strong>
                    </Typography>
                </Box>
            )}

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                Heating: <strong>{formatTime(heatingTimeSeconds)}</strong> (ΔT = {Number.isFinite(heatingDeltaT) ? heatingDeltaT.toFixed(1) : "—"}°C)
                {Number.isFinite(Number(coolingTimeSeconds)) && (
                    <>
                        , Pause: <strong>{coolingTimeSeconds}s</strong> (ΔT = {Number.isFinite(pauseDeltaT) ? pauseDeltaT.toFixed(1) : "—"}°C)
                    </>
                )}
            </Typography>

            {Number.isFinite(plasticZoneWidth) && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Plastic zone: <strong>{plasticZoneWidth.toFixed(1)} mm</strong>
                    </Typography>

                    {maxRadius !== null && (
                        <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                            Max inRadius: <strong>{maxRadius > 0 && Number.isFinite(maxRadius) ? `${maxRadius.toFixed(1)} mm` : "0.0 mm"}</strong>
                        </Typography>
                    )}
                </Box>
            )}
            {status?.type !== "ok" && status?.message && (
                <Typography variant="body2" color={statusColor} fontSize={PARAMETER_TEXT_SIZE} fontWeight={500} sx={{ mt: 0.5 }}>
                    {status.message}
                </Typography>
            )}

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.8)`} sx={{ mt: 0.25 }}>
                Simulation calculation time: {Number.isFinite(calculationTimeMs) ? calculationTimeMs.toFixed(1) : "—"} ms
            </Typography>

            {/* 📊 СИСТЕМНЫЕ МЕТРИКИ ТОЧНОСТИ И ВЫЧИСЛИТЕЛЬНОЙ НАГРУЗКИ (ЕДИНЫЙ СТИЛЬ) */}
            {accuracyMetrics && (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 0.5, opacity: 0.7 }}>
                    <Typography variant="body2" color="text.secondary" fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.75)`}>
                        Uncertainty: <strong>{accuracyMetrics.formatted ?? "—"}</strong>
                        <span style={{ marginLeft: 6, opacity: 0.85 }}>
                (Time: <strong>{Number.isFinite(accuracyMetrics.timeIntegrationErrorC) ? `${accuracyMetrics.timeIntegrationErrorC.toFixed(3)}°C` : "—"}</strong>, Grid: <strong>{Number.isFinite(accuracyMetrics.spatialGridErrorC) ? `${accuracyMetrics.spatialGridErrorC.toFixed(3)}°C` : "—"}</strong>, Solver: <strong>{Number.isFinite(accuracyMetrics.solverErrorC) ? `${Math.abs(accuracyMetrics.solverErrorC).toFixed(3)}°C` : "—"}</strong>)
            </span>
                    </Typography>

                    <Typography variant="body2" color="text.secondary" fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.75)`}>
                        Mode: <strong style={{ textTransform: 'capitalize' }}>{accuracyMetrics.accuracyMode ?? "—"}</strong>
                    </Typography>
                </Box>
            )}

            {workCounters && (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 0.25, opacity: 0.7 }}>
                    <Typography variant="body2" color="text.secondary" fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.75)`}>
                        Solver steps: <strong>{workCounters.totalTimeSteps ?? "—"}</strong>
                        {workCounters.rejectedTimeSteps > 0 && (
                            <span style={{ color: 'var(--mui-palette-warning-main)', marginLeft: 4 }}>
                                ({workCounters.rejectedTimeSteps} rejected)
                            </span>
                        )}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.75)`}>
                        Picard iterations: <strong>{workCounters.totalPicardIterations ?? "—"}</strong>
                    </Typography>

                    <Typography variant="body2" color="text.secondary" fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.75)`}>
                        Computational load: <strong>{workCounters.totalGridPointsProcessed.toLocaleString("en-US").replace(/,/g, "\u00A0")} pts</strong>
                    </Typography>
                </Box>
            )}


        </Box>
    );
});
Parameters.displayName = "Parameters";

const BendingPreview = ({ profile, geometry, blankLength, machineParams, simulation, rotationPreview }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });

    const simulationUi = simulation?.ui ?? profile?.simulation?.ui ?? {};
    const showVerticalSlice = simulationUi.showVerticalSlice ?? true;
    const showHorizontalWidth = simulationUi.showHorizontalWidth && simulation?.widthHalfMm !== 0;
    const showTimeDynamics = simulationUi.showTimeDynamics && simulation?.recordHistory;
    const showContours2D = simulationUi.showContours2D && simulation?.widthHalfMm !== 0;

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

    const matGlassTransitionTemp = profile?.material?.glassTransitionTemp;
    const matMinFormingTemp = profile?.material?.minFormingTemp;
    const matMaxFormingTemp = profile?.material?.maxFormingTemp;
    const matDecompositionTemp = profile?.material?.decompositionTemp;
    const matKFactor = profile?.material?.kFactor ?? 0;
    const profileWidth = Number(profile?.width || 0);
    const profileThickness = Number(profile?.thickness || 0);

    useEffect(() => {
        let animationFrameId;
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries || !entries.length) return;
            const { width, height } = entries[0].contentRect;

            animationFrameId = requestAnimationFrame(() => {
                if (width && height) {
                    setContainerSize({ width, height });
                }
            });
        });

        observer.observe(containerRef.current);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    const physicsProfile = useMemo(() => {
        if (!profile?.thickness || !profile?.material || !profile?.machine || !profile?.simulation) {
            return null;
        }
        return {
            thickness: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation,
        };
    }, [profile?.thickness, profile?.material, profile?.machine, profile?.simulation]);

    const { result2D, isCalculating, progress } = useHeatingSimulation(physicsProfile, validationError);

    const themeColors = useMemo(() => {
        const { text, primary, warning, error, success, info, divider } = theme.palette;
        return {
            textPrimary: text.primary,
            textSecondary: text.secondary,
            textDisabled: text.disabled,
            primaryMain: primary.main,
            warningMain: warning.main,
            warningDark: warning.dark,
            errorMain: error.main,
            errorDark: error.dark,
            successMain: success.main,
            successDark: success.dark,
            infoMain: info.main,
            divider: divider
        };
    }, [theme.palette]);

    const colors = useMemo(() => ({
        active: { line: themeColors.textPrimary, fill: alpha(themeColors.textPrimary, 0.1), annotation: alpha(themeColors.textPrimary, 0.75) },
        ghost: { line: themeColors.textDisabled, fill: alpha(themeColors.textDisabled, 0.02), annotation: alpha(themeColors.textDisabled, 0.4) },
        blue: { line: themeColors.primaryMain, fill: alpha(themeColors.primaryMain, 0.08), annotation: themeColors.primaryMain }
    }), [themeColors]);

    const svgData = useMemo(() => {
        if (!profile || validationError) return null;
        return prepareSvgLayers(profile, view, containerSize, geometry);
    }, [profile, validationError, view, containerSize, geometry]);

    const committedRotation = Number(view?.rotation ?? 0);
    const visualRotation = Number(rotationPreview ?? committedRotation) - committedRotation;
    const viewBoxValues = useMemo(() => svgData?.viewBox?.split(/\s+/).map(Number), [svgData?.viewBox]);

    const rotationCenter = useMemo(() => {
        return viewBoxValues?.length === 4
            ? { x: viewBoxValues[0] + viewBoxValues[2] / 2, y: viewBoxValues[1] + viewBoxValues[3] / 2 }
            : { x: 0, y: 0 };
    }, [viewBoxValues]);

    // ==========================================
    // ВЫЧИСЛЯЕМЫЕ ОСИ (СТРУКТУРИРОВАНО)
    // ==========================================

    // Базовая температурная ось Y для Графиков 1 и 2
    const commonYAxisChart1 = useMemo(() => {
        return createTemperatureYAxis(matGlassTransitionTemp, matDecompositionTemp, matMinFormingTemp, matMaxFormingTemp, themeColors);
    }, [matGlassTransitionTemp, matDecompositionTemp, matMinFormingTemp, matMaxFormingTemp, themeColors]);

    // Модифицированная температурная ось Y с нижней границей среды для Графика 3
    const commonYAxisChart3 = useMemo(() => {
        if (!commonYAxisChart1.lines.length) return commonYAxisChart1;
        const ambientTemp = profile?.simulation?.temperatures?.ambientC ?? 20;
        return { ...commonYAxisChart1, min: ambientTemp };
    }, [commonYAxisChart1, profile?.simulation?.temperatures?.ambientC]);

    // Данные для Графика времени (Chart 2)
    const chart2Data = useMemo(() => {
        const rawData = result2D?.geometryData;
        if (!showTimeDynamics) return null;
        if (!rawData?.graphsChart2Raw) {
            return { graphs: [], axes: { x: { unit: "s", lines: [], ranges: [] }, y: commonYAxisChart1 } };
        }

        const heatTimeSec = Number(result2D?.heatingTimeSeconds || 0);
        const styleMap = {
            frontHeat:  { color: themeColors.errorMain,   opacity: 1, lineWidth: 1, showMarker: false },
            centerHeat: { color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: false },
            backHeat:   { color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: false },
            frontCool:  { color: themeColors.errorMain,   opacity: 1, lineWidth: 1, showMarker: true },
            centerCool: { color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: true },
            backCool:   { color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: true },
        };

        return {
            graphs: rawData.graphsChart2Raw.map(g => ({ ...g, ...styleMap[g.typeKey] })),
            axes: {
                x: { unit: "s", lines: [{ value: heatTimeSec, color: themeColors.textSecondary }], ranges: [] },
                y: commonYAxisChart1
            }
        };
    }, [result2D, showTimeDynamics, themeColors, commonYAxisChart1]);

    // Данные для остальных графиков (Bundle)
    const chartsBundle = useMemo(() => {
        const rawData = result2D?.geometryData;

        if (!rawData) {
            return {
                xTgPauseValue: null,
                chart1: { graphs: [], axes: { x: { unit: "mm", lines: [], ranges: [] }, y: commonYAxisChart1 } },
                chart3: { graphs: [], axes: { x: { unit: "mm", lines: [], ranges: [] }, y: commonYAxisChart3 } },
                chart4: { graphs: [], showLabels: false, showPoints: false, axes: { x: { unit: "mm", lines: [], ranges: [] }, y: { unit: "mm", min: -10, max: 0, lines: [], ranges: [] } }, fillPolygons: [] }
            };
        }

        const {
            thickness, width, finalXTgPauseValue,
            vertPointsHeating, vertPointsPause,
            rawHorTopH, rawHorMidH, rawHorBotH,
            rawHorTopP, rawHorMidP, rawHorBotP,
            contourGraphsRaw, fillPolygonsRaw,
            xCoordinatesMm
        } = rawData;

        // Стилизация контуров
        const contourGraphs = (contourGraphsRaw || []).map(g => {
            let style = { lineWidth: 0.7, opacity: 0.7, color: themeColors.textPrimary };
            if (g.name === "Tg") style.color = g.phase === "Heating" ? themeColors.warningMain : themeColors.warningDark;
            else if (g.name === "T min") style.color = g.phase === "Heating" ? themeColors.successMain : themeColors.successDark;
            else if (g.name === "T max") style.color = themeColors.successMain;
            else if (g.name === "Decomposition") { style.color = g.phase === "Heating" ? themeColors.errorMain : themeColors.errorDark; style.opacity = 1; }
            if (g.phase === "Pause") style.lineWidth = 1.6;
            return { ...g, ...style };
        });

        const polygonStyleMap = {
            "Solid Plastic":       { color: themeColors.infoMain,    opacity: 0.3 },
            "High Elastic":        { color: themeColors.successMain, opacity: 0.05 },
            "Optimal Bending":     { color: themeColors.successMain, opacity: 0.15 },
            "High Temperature":    { color: themeColors.warningMain, opacity: 0.1 },
            "Decomposition Risk":  { color: themeColors.errorMain,   opacity: 0.3 }
        };

        const fillPolygons = (fillPolygonsRaw || []).map(p => ({
            ...p,
            color: polygonStyleMap[p.name]?.color || themeColors.successMain,
            opacity: polygonStyleMap[p.name]?.opacity || 0.15
        }));

        const lastXCoord = Array.isArray(xCoordinatesMm) && xCoordinatesMm.length > 0 ? xCoordinatesMm[xCoordinatesMm.length - 1] : -10;

        return {
            xTgPauseValue: finalXTgPauseValue,
            chart1: {
                graphs: [
                    { name: "Heating (Vertical Slice)", points: vertPointsHeating || [], color: themeColors.textSecondary, opacity: 1, lineWidth: 1 },
                    { name: "Cooling (Vertical Slice)", points: vertPointsPause || [], color: themeColors.textPrimary, opacity: 1, lineWidth: 1.6 }
                ],
                axes: {
                    x: { unit: "mm", lines: [{ value: thickness / 2, color: themeColors.textSecondary }, { value: thickness * matKFactor, color: themeColors.infoMain }], ranges: [] },
                    y: commonYAxisChart1
                }
            },
            chart3: {
                graphs: [
                    { name: "Верхняя поверхность", points: rawHorTopH || [], color: themeColors.errorMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Середина листа", points: rawHorMidH || [], color: themeColors.successMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Нижняя поверхность", points: rawHorBotH || [], color: themeColors.primaryMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Верхняя поверхность пауза", points: rawHorTopP || [], color: themeColors.errorMain, opacity: 1, lineWidth: 1.2 },
                    { name: "Середина листа пауза", points: rawHorMidP || [], color: themeColors.successMain, opacity: 1, lineWidth: 1.2 },
                    { name: "Нижняя поверхность пауза", points: rawHorBotP || [], color: themeColors.primaryMain, opacity: 1, lineWidth: 1.2 }
                ],
                axes: {
                    x: createHorizontalXAxis(width, finalXTgPauseValue, themeColors),
                    y: commonYAxisChart3
                }
            },
            chart4: {
                graphs: contourGraphs,
                showLabels: false,
                showPoints: false,
                axes: createContoursAxes(width, contourGraphsRaw, lastXCoord, matKFactor, themeColors),
                fillPolygons: fillPolygons
            }
        };
    }, [result2D, themeColors, commonYAxisChart1, commonYAxisChart3, matKFactor]);

    const plasticZoneWidthCalculated = useMemo(() => calculatePlasticZoneWidth(chartsBundle?.xTgPauseValue), [chartsBundle?.xTgPauseValue]);
    const maxRadiusCalculated = useMemo(() => calculateMaxInnerRadius(plasticZoneWidthCalculated, machineParams?.bendAngle, profileThickness, matKFactor), [plasticZoneWidthCalculated, machineParams?.bendAngle, profileThickness, matKFactor]);

    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader partName={profile?.name} materialName={profile?.material?.name} thickness={profile?.thickness} />

            <Box ref={containerRef} className="bend-preview-drawing" sx={{ flex: 1, minWidth: 360, maxHeight: 480, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {validationError ? (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <Typography variant="body2" fontWeight={500} color="warning.main">{validationError}</Typography>
                    </Box>
                ) : svgData && (
                    <svg className="bend-preview-svg" viewBox={svgData.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                        <g transform={visualRotation ? `rotate(${visualRotation},${rotationCenter.x},${rotationCenter.y})` : undefined}>
                            <BendProfileRender data={svgData.activeData} strokeColor={colors.active.line} fillColor={colors.active.fill} annotationColor={colors.active.annotation} />
                            <BendProfileRender data={svgData.ghostData} strokeColor={colors.ghost.line} fillColor={colors.ghost.fill} annotationColor={colors.ghost.annotation} isGhost />
                            <BendProfileRender data={svgData.blueData} strokeColor={colors.blue.line} fillColor={colors.blue.fill} annotationColor={colors.blue.annotation} />
                        </g>
                    </svg>
                )}
            </Box>

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 3, mt: 1 }}>
                <Box sx={{ width: "100%" }}>
                    <Parameters
                        width={profileWidth} thickness={profileThickness} density={profile?.material?.density} blankLength={blankLength} machineParams={machineParams}
                        heatingTimeSeconds={result2D?.heatingTimeSeconds} coolingTimeSeconds={result2D?.coolingTimeSeconds} calculationTimeMs={result2D?.calculationTimeMs}
                        status={result2D?.status} heatingDeltaT={result2D?.geometryData?.heatingDeltaT} pauseDeltaT={result2D?.geometryData?.pauseDeltaT}
                        plasticZoneWidth={plasticZoneWidthCalculated} maxRadius={maxRadiusCalculated} accuracyMetrics={result2D?.accuracyMetrics} workCounters={result2D?.workCounters}
                    />
                </Box>

                <Box sx={{ width: "100%", position: "relative" }}>
                    <Box sx={{ width: "100%", position: "relative" }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "100%", md: "repeat(2, 1fr)" }, gap: 2, width: "100%", opacity: isCalculating ? 0.4 : 1, filter: isCalculating ? "blur(1px)" : "none", transition: "all 0.3s ease", pointerEvents: isCalculating ? "none" : "auto" }}>
                            {showVerticalSlice && chartsBundle?.chart1 && <SvgLineChart chart={chartsBundle.chart1} maxHeight={150} />}
                            {showTimeDynamics && chart2Data && <SvgLineChart chart={chart2Data} maxHeight={150} />}
                            {showHorizontalWidth && chartsBundle?.chart3 && <SvgLineChart chart={chartsBundle.chart3} maxHeight={150} />}
                            {showContours2D && chartsBundle?.chart4 && <SvgLineChart chart={chartsBundle.chart4} maxHeight={150} />}
                        </Box>
                    </Box>

                    {isCalculating && (
                        <Box sx={{ position: "absolute", inset: 0, backgroundColor: alpha(theme.palette.action.disabledBackground, 0.1), borderRadius: 1, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, px: 3, minHeight: 200 }}>
                            <Typography variant="body2" fontWeight={600} color="text.secondary">2D simulation in progress...</Typography>
                            <Box sx={{ width: '100%', maxWidth: 220, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1, height: 6, borderRadius: 3 }} />
                                <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ minWidth: 35 }}>{progress}%</Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default BendingPreview;
