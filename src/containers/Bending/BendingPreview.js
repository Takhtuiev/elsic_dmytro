import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {Box, LinearProgress, Typography, useTheme} from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./SvgLineChart";
import { getHorizontalSlicePoints, getVerticalSlicePoints } from "./heating2DModel";

// ============================================================================
// !!! БЛОК 1D СИМУЛЯЦИИ (ДЛЯ УДАЛЕНИЯ) !!!
// ============================================================================
import { simulate1DHeating } from "./pvc-1d-transient-heating";
import {
    buildIsothermFillPolygons,
    buildSymmetricFillPolygons,
    buildSymmetricIsothermGraph,
    findTemperatureIsothermSegments
} from "./IsothermsModel";

const isDev = process.env.REACT_APP_DEVELOPMENT === 'true';

const getChartPoints = (valuesArray, step, xOffset = 0) => {
    return Array.from(valuesArray || [], (value, index) => [
        xOffset + index * step,
        Number(value)
    ]);
};

const get1DChartsData = (profile, themeColors, graphsChart1, graphsChart2, showVerticalSlice, showTimeDynamics) => {
    if (!isDev || !profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
        return;
    }

    const dataSimulate = simulate1DHeating({
        thicknessMm: profile.thickness,
        material: profile.material,
        machine: profile.machine,
        simulation: profile.simulation,
        storeHistory: profile.simulation?.recordHistory ?? false
    });

    if (!dataSimulate) return;

    if (showVerticalSlice && dataSimulate.temperatureProfile) {
        const dxMm1D = dataSimulate.temperatureProfile.dxMm || 0;
        graphsChart1.push(
            {
                name: "Heating (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.temperaturesC, dxMm1D),
                color: themeColors.textPrimary, opacity: 0.4, lineWidth: 1,
            },
            {
                name: "Cooling (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.cooldownProfileC, dxMm1D),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1,
            }
        );
    }

    if (showTimeDynamics && dataSimulate.history) {
        const { history: hist1D, heatingTimeSeconds: heatTime1D } = dataSimulate;
        const heatHist = hist1D?.heating;
        const coolHist = hist1D?.cooling;
        const heatStep = heatHist?.stepSeconds || 0;
        const coolStep = coolHist?.stepSeconds || heatStep || 0;

        graphsChart2.push(
            {
                name: "Front Surface (1D) - Heating",
                points: getChartPoints(heatHist?.frontSurfaceC, heatStep),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Center (1D) - Heating",
                points: getChartPoints(heatHist?.centerC, heatStep),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Back Surface (1D) - Heating",
                points: getChartPoints(heatHist?.backSurfaceC, heatStep),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            }
        );

        graphsChart2.push(
            {
                name: "Front Surface (1D) - Cooling",
                points: getChartPoints(coolHist?.frontSurfaceC, coolStep, Number(heatTime1D)),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Center (1D) - Cooling",
                points: getChartPoints(coolHist?.centerC, coolStep, Number(heatTime1D)),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Back Surface (1D) - Cooling",
                points: getChartPoints(coolHist?.backSurfaceC, coolStep, Number(heatTime1D)),
                color: themeColors.textSecondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            }
        );
    }
};
// ============================================================================
// !!! КОНЕЦ БЛОКА 1D СИМУЛЯЦИИ !!!
// ============================================================================

const PARAMETER_TEXT_COLOR = "text.primary";
const PARAMETER_TEXT_SIZE = "0.8rem";

const validateProfile = (profile) => {
    if (!profile) return "Profile is missing";

    const thickness = Number(profile.thickness);
    if (!Number.isFinite(thickness) || thickness <= 0) return "Thickness must be greater than 0 mm";
    if (!Array.isArray(profile.shelves) || !profile.shelves.length) return "At least one leg is required";
    if (!Array.isArray(profile.bends)) return "Bends are missing";
    if (profile.shelves.length !== profile.bends.length + 1) return "Invalid profile geometry";

    const invalidShelfIndex = profile.shelves.findIndex(({ length }) => {
        const value = Number(length);
        return !Number.isFinite(value) || value < thickness;
    });
    if (invalidShelfIndex >= 0) {
        const length = profile.shelves[invalidShelfIndex]?.length;
        return `Leg ${invalidShelfIndex + 1}: ${length} mm — must be at least ${thickness} mm`;
    }

    const invalidAngleIndex = profile.bends.findIndex(({ angle }) => {
        const value = Number(angle);
        return !Number.isFinite(value) || value < 90 || value > 180;
    });
    if (invalidAngleIndex >= 0) {
        const angle = profile.bends[invalidAngleIndex]?.angle;
        return `Angle ${invalidAngleIndex + 1}: ${angle}° — allowed range is 90°–180°`;
    }

    return null;
};

export const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return "0m 00s";
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

const PartHeader = React.memo(({ profile }) => (
    <Box
        className="bend-preview-header"
        sx={{
            px: 1, py: 0.75, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center",
            borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0
        }}
    >
        <Typography variant="body2" fontWeight={600}>
            Part: <strong>{profile?.name || "—"}</strong>
        </Typography>
        <Typography variant="body2">
            Material: <strong>{profile?.material?.name || "—"}</strong>
        </Typography>
        <Typography variant="body2">
            Thickness: <strong>{profile?.thickness ?? "—"} mm</strong>
        </Typography>
    </Box>
));
PartHeader.displayName = "PartHeader";

const Parameters = React.memo(({
                                   profile,
                                   blankLength,
                                   machineParams,
                                   heatingTimeSeconds,
                                   coolingTimeSeconds,
                                   calculationTimeMs,
                                   status,
                                   temperatureProfile,
                                   plasticZoneWidth,
                                   maxRadius
                               }) => {
    const material = profile?.material;
    const width = Number(profile?.width);
    const thickness = Number(profile?.thickness);
    const density = Number(material?.density);

    const mass = useMemo(() => {
        if (Number.isFinite(blankLength) && Number.isFinite(width) && Number.isFinite(thickness) && Number.isFinite(density)) {
            return (blankLength * width * thickness * density) / 1e9;
        }
        return null;
    }, [blankLength, width, thickness, density]);

    const statusColor = status?.type === "error" ? "error" : status?.type === "warning" ? "warning" : "text.secondary";

    const getDeltaTForVerticalSlice = useCallback((tempProfile, phase) => {
        if (!tempProfile) return null;

        const points = getVerticalSlicePoints(tempProfile, 0, phase);
        if (!points || !points.length) return null;

        let maxT = -Infinity;
        let minT = Infinity;
        let hasValid = false;

        for (let i = 0; i < points.length; i++) {
            const val = Number(points[i]?.[1]);
            if (Number.isFinite(val)) {
                if (val > maxT) maxT = val;
                if (val < minT) minT = val;
                hasValid = true;
            }
        }

        return hasValid ? maxT - minT : null;
    }, []);

    const heatingDeltaT = useMemo(() =>
            getDeltaTForVerticalSlice(temperatureProfile, "heating"),
        [temperatureProfile, getDeltaTForVerticalSlice]
    );

    const pauseDeltaT = useMemo(() =>
            getDeltaTForVerticalSlice(temperatureProfile, "pause"),
        [temperatureProfile, getDeltaTForVerticalSlice]
    );

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
                    Mass: <strong>{mass !== null ? mass.toFixed(3) : "—"} kg</strong>
                </Typography>
            </Box>

            {machineParams && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Stop pos: <strong>{machineParams.stopPosition} mm</strong>
                    </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Bar low: <strong>{machineParams.barLowering} mm</strong>
                    </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Angle: <strong>{machineParams.bendAngle}°</strong>
                    </Typography>
                </Box>
            )}

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                Heating: <strong>{formatTime(heatingTimeSeconds)}</strong> (ΔT = {heatingDeltaT !== null ? heatingDeltaT.toFixed(1) : "—"}°C)
                {Number.isFinite(Number(coolingTimeSeconds)) && (
                    <>
                        , Pause: <strong>{formatTime(coolingTimeSeconds)}</strong> (ΔT = {pauseDeltaT !== null ? pauseDeltaT.toFixed(1) : "—"}°C)
                    </>
                )}
            </Typography>

            {plasticZoneWidth !== null && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Plastic zone: <strong>{plasticZoneWidth.toFixed(1)} mm</strong>
                    </Typography>

                    {maxRadius !== null && (
                        <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                            Max inRadius: <strong>{maxRadius > 0 ? `${maxRadius.toFixed(1)} mm` : "0.0 mm"}</strong>
                        </Typography>
                    )}
                </Box>
            )}
            {status?.type !== "ok" && status?.message && (
                <Typography variant="body2" color={statusColor} fontSize={PARAMETER_TEXT_SIZE} fontWeight={500} sx={{ mt: 0.5 }}>
                    {status.message}
                </Typography>
            )}

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.8)`}>
                Simulation calculation time: {calculationTimeMs?.toFixed(1)} ms
            </Typography>
        </Box>
    );
});
Parameters.displayName = "Parameters";

const BendingPreview = ({ profile, geometry, blankLength, machineParams, rotationPreview }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });

    const [result2D, setResult2D] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false); // Для будущего спиннера по желанию
    const [progress, setProgress] = useState(0);

    const showVerticalSlice = profile?.simulation?.ui?.showVerticalSlice ?? true;
    const showHorizontalWidth = profile?.simulation?.ui?.showHorizontalWidth ?? true;
    const showTimeDynamics = profile?.simulation?.ui?.showTimeDynamics ?? true;
    const showContours2D = profile?.simulation?.ui?.showContours2D ?? true;

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

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

    useEffect(() => {
        if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
            setResult2D(null);
            return;
        }

        setIsCalculating(true);
        setProgress(0); // Сбрасываем перед новым расчетом

        const worker = new Worker(
            new URL("./heating.worker.js", import.meta.url),
            { type: "module" }
        );

        worker.onmessage = (event) => {
            const { type, percent, result2D, error } = event.data;

            if (type === "PROGRESS") {
                setProgress(percent); // Получаем проценты от модели
            } else {
                if (error) {
                    console.error("Worker error:", error);
                } else {
                    setResult2D(result2D);
                    setProgress(100);
                }
                setIsCalculating(false);
            }
        };

        worker.postMessage({ profile });

        return () => {
            worker.terminate();
        };
    }, [profile]);


    // Атомарное кеширование цветов палитры для снижения триггеров пересчета у детей
    const themeColors = useMemo(() => ({
        textPrimary: theme.palette.text.primary,
        textSecondary: theme.palette.text.secondary,
        textDisabled: theme.palette.text.disabled,
        primaryMain: theme.palette.primary.main,
        warningMain: theme.palette.warning.main,
        warningDark: theme.palette.warning.dark,
        errorMain: theme.palette.error.main,
        errorDark: theme.palette.error.dark,
        successMain: theme.palette.success.main,
        successDark: theme.palette.success.dark,
        infoMain: theme.palette.info.main,
        divider: theme.palette.divider
    }), [theme.palette.text, theme.palette.primary, theme.palette.warning, theme.palette.error, theme.palette.success, theme.palette.info, theme.palette.divider]);

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

    const commonYAxis = useMemo(() => {
        const tg = profile?.material?.glassTransitionTemp;
        const decomp = profile?.material?.decompositionTemp;
        const minForm = profile?.material?.minFormingTemp;
        const maxForm = profile?.material?.maxFormingTemp;

        if (tg == null || decomp == null) return { unit: "°", lines: [], ranges: [] };

        return {
            unit: "°",
            lines: [
                { value: Number(tg), color: themeColors.warningMain },
                { value: Number(decomp), color: themeColors.errorMain }
            ],
            ranges: [
                { from: Number(minForm ?? 0), to: Number(maxForm ?? 0), color: themeColors.successMain }
            ]
        };
    }, [
        profile?.material?.glassTransitionTemp,
        profile?.material?.decompositionTemp,
        profile?.material?.minFormingTemp,
        profile?.material?.maxFormingTemp,
        themeColors
    ]);

    const chart1And2 = useMemo(() => {
        if (!result2D) return { chart1: null, chart2: null };
        if (!showVerticalSlice && !showTimeDynamics) return { chart1: null, chart2: null };

        const thickness = Number(profile?.thickness || 0);
        const heatingTimeSeconds = Number(result2D.heatingTimeSeconds || 0);

        const graphsChart1 = [];
        const graphsChart2 = [];

        get1DChartsData(profile, themeColors, graphsChart1, graphsChart2, showVerticalSlice, showTimeDynamics);

        if (showVerticalSlice && result2D?.temperatureProfile) {
            graphsChart1.push(
                {
                    name: "Heating (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "heating"),
                    color: themeColors.textSecondary, opacity: 1, lineWidth: 1,
                },
                {
                    name: "Cooling (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "pause"),
                    color: themeColors.textPrimary, opacity: 1, lineWidth: 1.6,
                }
            );
        }

        if (showTimeDynamics && result2D?.history) {
            const { history: hist2D } = result2D;
            const times = hist2D.time || [];
            const heatTime = Number(result2D?.heatingTimeSeconds || 0);

            const heatFront = [], heatCenter = [], heatBack = [];
            const coolFront = [], coolCenter = [], coolBack = [];

            let lastHeatPoint = null;

            for (let i = 0; i < times.length; i++) {
                const t = times[i];
                const fC = Number(hist2D.frontSurfaceC[i]);
                const cC = Number(hist2D.centerC[i]);
                const bC = Number(hist2D.backSurfaceC[i]);

                if (t <= heatTime) {
                    heatFront.push([t, fC]);
                    heatCenter.push([t, cC]);
                    heatBack.push([t, bC]);
                    lastHeatPoint = [t, fC, cC, bC];
                } else {
                    if (coolFront.length === 0 && lastHeatPoint !== null) {
                        coolFront.push([lastHeatPoint[0], lastHeatPoint[1]]);
                        coolCenter.push([lastHeatPoint[0], lastHeatPoint[2]]);
                        coolBack.push([lastHeatPoint[0], lastHeatPoint[3]]);
                    }
                    coolFront.push([t, fC]);
                    coolCenter.push([t, cC]);
                    coolBack.push([t, bC]);
                }
            }

            graphsChart2.push(
                { name: "Front Surface (2D) - Heating", points: heatFront, color: themeColors.errorMain, opacity: 1, lineWidth: 1, showMarker: false },
                { name: "Center (2D) - Heating", points: heatCenter, color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: false },
                { name: "Back Surface (2D) - Heating", points: heatBack, color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: false },
                { name: "Front Surface (2D) - Cooling", points: coolFront, color: themeColors.errorMain, opacity: 1, lineWidth: 1, showMarker: true },
                { name: "Center (2D) - Cooling", points: coolCenter, color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: true },
                { name: "Back Surface (2D) - Cooling", points: coolBack, color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: true }
            );
        }

        const chart1 = (showVerticalSlice && graphsChart1.length > 0) ? {
            graphs: graphsChart1,
            axes: {
                x: { unit: "mm", lines: [
                        { value: thickness / 2, color: themeColors.textSecondary },
                        { value: thickness * (profile?.material?.kFactor || 0), color: themeColors.infoMain }
                    ], ranges: [] },
                y: commonYAxis
            }
        } : null;

        const chart2 = (showTimeDynamics && graphsChart2.length > 0) ? {
            graphs: graphsChart2,
            axes: {
                x: { unit: "s", lines: [{ value: heatingTimeSeconds, color: themeColors.textSecondary }], ranges: [] },
                y: commonYAxis
            }
        } : null;

        return { chart1, chart2 };
    }, [result2D, commonYAxis, profile, showVerticalSlice, showTimeDynamics, themeColors]);

    const xTgPauseValue = useMemo(() => {
        if (!result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);
        const glassTransition = Number(profile?.material?.glassTransitionTemp);
        const kFactor = typeof profile?.material?.kFactor === "number" ? profile.material.kFactor : 0.5;

        if (!Number.isFinite(glassTransition)) return null;

        const kFactorPoints = getHorizontalSlicePoints(result2D.temperatureProfile, thickness * kFactor, "pause") || [];
        let xTgPause = null;

        for (let i = 0; i < kFactorPoints.length - 1; i++) {
            const p1 = kFactorPoints[i];
            const p2 = kFactorPoints[i + 1];

            if (!p1 || !p2 || p1[0] == null || p1[1] == null || p2[0] == null || p2[1] == null) continue;

            const x1 = p1[0];
            const t1 = p1[1];
            const x2 = p2[0];
            const t2 = p2[1];

            if ((t1 >= glassTransition && t2 <= glassTransition) || (t1 <= glassTransition && t2 >= glassTransition)) {
                if (Math.abs(t2 - t1) < 0.001) {
                    xTgPause = x1;
                } else {
                    xTgPause = x1 + (glassTransition - t1) * (x2 - x1) / (t2 - t1);
                }
                break;
            }
        }

        return (xTgPause !== null && xTgPause <= width / 2) ? xTgPause : null;
    }, [result2D, profile?.thickness, profile?.width, profile?.material?.glassTransitionTemp, profile?.material?.kFactor]);

    const plasticZoneWidthCalculated = useMemo(() => {
        return xTgPauseValue !== null ? xTgPauseValue * 2 : null;
    }, [xTgPauseValue]);

    const maxRadiusCalculated = useMemo(() => {
        if (machineParams?.bendAngle == null || plasticZoneWidthCalculated == null) {
            return null;
        }
        const bendAngle = Number(machineParams?.bendAngle);
        const thickness = Number(profile?.thickness || 0);
        const kFactor = profile?.material?.kFactor ?? 0;

        const turnAngleRad = (bendAngle * Math.PI) / 180;
        if (turnAngleRad <= 0) return 0;

        const rInnerMax = (plasticZoneWidthCalculated / turnAngleRad) - (kFactor * thickness);
        return rInnerMax > 0 ? rInnerMax : 0;
    }, [plasticZoneWidthCalculated, machineParams?.bendAngle, profile?.thickness, profile?.material?.kFactor]);

    const chart3Data = useMemo(() => {
        if (!showHorizontalWidth || !result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);

        const makeSymmetric = (points) => {
            if (!points || !points.length) return [];
            const leftSide = points.filter(p => p && p[0] > 0).map(p => [-p[0], p[1]]);
            const leftSideReversed = [...leftSide].reverse();
            return [...leftSideReversed, ...points];
        };

        const xLines = [{ value: 0, color: themeColors.textSecondary }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(themeColors.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(themeColors.divider, 0.25) });
            }
        }

        if (xTgPauseValue !== null) {
            xLines.push({
                value: xTgPauseValue,
                color: themeColors.warningMain,
                lineWidth: 1.5,
                dashArray: "4 4",
                label: `Гибочная зона (${(xTgPauseValue * 2).toFixed(1)} мм)`
            });
            xLines.push({ value: -xTgPauseValue, color: themeColors.warningMain, lineWidth: 1.5, dashArray: "4 4" });
        }

        return {
            graphs: [
                { name: "Верхняя поверхность", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, 0)), color: themeColors.errorMain, opacity: 0.8, lineWidth: 0.6 },
                { name: "Середина листа", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2)), color: themeColors.successMain, opacity: 0.8, lineWidth: 0.6 },
                { name: "Нижняя поверхность", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness)), color: themeColors.primaryMain, opacity: 0.8, lineWidth: 0.6 },
                { name: "Верхняя поверхность пауза", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, 0, "pause")), color: themeColors.errorMain, opacity: 1, lineWidth: 1.2 },
                { name: "Середина листа пауза", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2, "pause")), color: themeColors.successMain, opacity: 1, lineWidth: 1.2 },
                { name: "Нижняя поверхность пауза", points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness, "pause")), color: themeColors.primaryMain, opacity: 1, lineWidth: 1.2 }
            ],
            axes: { x: { unit: "mm", lines: xLines, ranges: [] }, y: commonYAxis }
        };
    }, [result2D, profile?.thickness, profile?.width, commonYAxis, xTgPauseValue, showHorizontalWidth, themeColors]);

    const chartContourData = useMemo(() => {
        if (!showContours2D || !result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);

        const Tg = Number(profile?.material?.glassTransitionTemp);
        const Tmin = Number(profile?.material?.minFormingTemp);
        const Tmax = Number(profile?.material?.maxFormingTemp);
        const Tdecomp = Number(profile?.material?.decompositionTemp);

        const profileData = result2D.temperatureProfile;
        const { xCoordinatesMm, yCoordinatesMm, Nx, Ny, heating, pause } = profileData;
        const gridConfig = { Nx, Ny, xCoordinatesMm, yCoordinatesMm };

        const boundaryPoints = (() => {
            const points = [];
            const maxWidth = yCoordinatesMm[Ny - 1];
            const maxThickness = xCoordinatesMm[Nx - 1];

            const addPoint = (i, j, position) => {
                const index = i * Ny + j;
                points.push({ x: yCoordinatesMm[j], y: xCoordinatesMm[i], temperature: pause[index], index, position });
            };

            for (let j = 0; j < Ny; j++) addPoint(0, j, yCoordinatesMm[j]);
            for (let i = 1; i < Nx; i++) addPoint(i, Ny - 1, maxWidth + xCoordinatesMm[i]);
            for (let j = Ny - 2; j >= 0; j--) addPoint(Nx - 1, j, maxWidth + maxThickness + maxWidth - yCoordinatesMm[j]);
            for (let i = Nx - 2; i > 0; i--) addPoint(i, 0, 2 * maxWidth + maxThickness + maxThickness - xCoordinatesMm[i]);

            return points;
        })();

        const tgHeatingSegments = findTemperatureIsothermSegments(Tg, heating, gridConfig);
        const tminHeatingSegments = findTemperatureIsothermSegments(Tmin, heating, gridConfig);
        const tmaxHeatingSegments = findTemperatureIsothermSegments(Tmax, heating, gridConfig);
        const tdecompHeatingSegments = findTemperatureIsothermSegments(Tdecomp, heating, gridConfig);

        const tgPauseSegments = findTemperatureIsothermSegments(Tg, pause, gridConfig);
        const tminPauseSegments = findTemperatureIsothermSegments(Tmin, pause, gridConfig);
        const tmaxPauseSegments = findTemperatureIsothermSegments(Tmax, pause, gridConfig);
        const tdecompPauseSegments = findTemperatureIsothermSegments(Tdecomp, pause, gridConfig);

        const isotherms = [
            { name: "Tg", phase: "Heating", segments: tgHeatingSegments, style: { color: themeColors.warningMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "T min", phase: "Heating", segments: tminHeatingSegments, style: { color: themeColors.successMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "T max", phase: "Heating", segments: tmaxHeatingSegments, style: { color: themeColors.successMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "Decomposition", phase: "Heating", segments: tdecompHeatingSegments, style: { color: themeColors.errorMain, lineWidth: 0.7, opacity: 1 } },
            { name: "Tg", phase: "Pause", segments: tgPauseSegments, style: { color: themeColors.warningDark, lineWidth: 1.6, opacity: 0.7 } },
            { name: "T min", phase: "Pause", segments: tminPauseSegments, style: { color: themeColors.successDark, lineWidth: 1.6 } },
            { name: "T max", phase: "Pause", segments: tmaxPauseSegments, style: { color: themeColors.successMain, lineWidth: 1.6 } },
            { name: "Decomposition", phase: "Pause", segments: tdecompPauseSegments, style: { color: themeColors.errorDark, lineWidth: 1.6 } },
        ];

        const graphs = isotherms.flatMap(({ name, phase, segments, style }) =>
            buildSymmetricIsothermGraph(segments, name, phase, style, gridConfig)
        );

        const polygonFillsConfig = [
            { name: "Solid Plastic", fromIsotherm: "Tg", toIsotherm: null, minTemp: -Infinity, maxTemp: Tg, phase: "Pause", color: themeColors.infoMain, opacity: 0.08 },
            { name: "High Elastic", fromIsotherm: "Tg", toIsotherm: "T min", minTemp: Tg, maxTemp: Tmin, phase: "Pause", color: themeColors.successMain, opacity: 0.05 },
            { name: "Optimal Bending", fromIsotherm: "T min", toIsotherm: "T max", minTemp: Tmin, maxTemp: Tmax, phase: "Pause", color: themeColors.successMain, opacity: 0.15 },
            { name: "High Temperature", fromIsotherm: "T max", toIsotherm: "Decomposition", minTemp: Tmax, maxTemp: Tdecomp, phase: "Pause", color: themeColors.warningMain, opacity: 0.1 },
            { name: "Decomposition Risk", fromIsotherm: "Decomposition", toIsotherm: null, minTemp: Tdecomp, maxTemp: Infinity, phase: "Heating", color: themeColors.errorMain, opacity: 0.3 }
        ];

        const fillPolygons = buildSymmetricFillPolygons(
            buildIsothermFillPolygons(polygonFillsConfig, boundaryPoints, isotherms, heating, pause)
        );

        //console.log(fillPolygons)

        const xLines = [{ value: 0, color: themeColors.textSecondary, label: "Центр" }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(themeColors.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(themeColors.divider, 0.25) });
            }
        }

        return {
            graphs: graphs,
            axes: {
                x: { unit: "mm", lines: xLines, ranges: [] },
                y: {
                    unit: "mm", min: xCoordinatesMm[Nx - 1], max: 0,
                    lines: [
                        { value: 0, color: themeColors.textPrimary, label: "Верх" },
                        { value: thickness / 2, color: alpha(themeColors.divider, 0.3) },
                        { value: thickness, color: themeColors.textPrimary, label: "Низ" },
                        { value: thickness * (profile?.material?.kFactor || 0), color: themeColors.infoMain, label: `K = ${profile?.material?.kFactor || 0}` }
                    ],
                    ranges: []
                }
            },
            fillPolygons: fillPolygons
        };
    }, [result2D, profile?.thickness, profile?.width, profile?.material, showContours2D, themeColors]);

    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader profile={profile} />

            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{
                    flex: 1, minWidth: 360, maxHeight: 480, width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"
                }}
            >
                {validationError ? (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <Typography variant="body2" fontWeight={500} color="warning.main">
                            {validationError}
                        </Typography>
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

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", width: "100%", flexShrink: 0, gap: 1, mt: 1 }}>
                <Box sx={{ flex: "1 1 18rem" }}>
                    <Parameters
                        profile={profile}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        heatingTimeSeconds={result2D?.heatingTimeSeconds}
                        coolingTimeSeconds={result2D?.coolingTimeSeconds}
                        calculationTimeMs={result2D?.calculationTimeMs}
                        status={result2D?.status}
                        temperatureProfile={result2D?.temperatureProfile}
                        plasticZoneWidth={plasticZoneWidthCalculated}
                        maxRadius={maxRadiusCalculated}
                    />
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        mx: "auto",
                        gap: 1,
                        position: "relative" // База для абсолютного позиционирования серого оверлея
                    }}
                >
                    {/* НАКРЫВАЕМ ЭФФЕКТОМ РАЗМЫТИЯ И ПРОЗРАЧНОСТИ ВСЕ ВНУТРЕННИЕ ГРАФИКИ СРАЗУ */}
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            width: "100%",
                            opacity: isCalculating ? 0.4 : 1, // Мягко приглушаем яркость линий под оверлеем
                            filter: isCalculating ? "blur(1px)" : "none", // Аппаратное размытие SVG на 1px (можно поставить 0.5px)
                            transition: "all 0.3s ease",
                            pointerEvents: isCalculating ? "none" : "auto"
                        }}
                    >
                        {showVerticalSlice && chart1And2?.chart1 && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart1And2.chart1} />
                            </Box>
                        )}

                        {showTimeDynamics && chart1And2?.chart2 && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart1And2.chart2} />
                            </Box>
                        )}

                        {showHorizontalWidth && chart3Data && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart3Data} />
                            </Box>
                        )}

                        {showContours2D && chartContourData && (
                            <Box mx="auto">
                                <SvgLineChart chart={chartContourData} />
                            </Box>
                        )}
                    </Box>

                    {/* ЕДИНЫЙ ОБЩИЙ ОВЕРЛЕЙ ЗАГРУЗКИ ПОВЕРХ ВСЕЙ ПАНЕЛИ ГРАФИКОВ */}
                    {isCalculating && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                // Используем легкий полупрозрачный серый фон из палитры MUI
                                backgroundColor: alpha(theme.palette.action.disabledBackground, 0.1),
                                borderRadius: 1,
                                zIndex: 10,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1.5,
                                px: 3,
                                minHeight: 200 // Защита от схлопывания контейнера до монтирования графиков
                            }}
                        >
                            <Typography variant="body2" fontWeight={600} color="text.secondary">
                                2D simulation in progress...
                            </Typography>

                            <Box sx={{ width: '100%', maxWidth: 220, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                                />
                                <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ minWidth: 35 }}>
                                    {progress}%
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>

            </Box>
        </Box>
    );
};

export default BendingPreview;