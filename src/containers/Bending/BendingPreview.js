import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {Box, LinearProgress, Typography, useTheme} from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./SvgLineChart";
import {
    buildIsothermFillPolygons,
    buildSymmetricFillPolygons,
    buildSymmetricIsothermGraph,
    findMultipleIsothermsBatch
} from "./IsothermsModel";

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
        const { Nx, Ny, heating, pause } = tempProfile;
        if (Nx < 1 || Ny < 1) return null;

        const temperatures = phase === "heating" ? heating : pause;
        let maxT = -Infinity;
        let minT = Infinity;
        let hasValid = false;

        for (let i = 0; i < Nx; i++) {
            const val = temperatures[i * Ny];
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
                        , Pause: <strong>{coolingTimeSeconds}s</strong> (ΔT = {pauseDeltaT !== null ? pauseDeltaT.toFixed(1) : "—"}°C)
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
    const [isCalculating, setIsCalculating] = useState(false);
    const [progress, setProgress] = useState(0);

    const showVerticalSlice = profile?.simulation?.ui?.showVerticalSlice ?? true;
    const showHorizontalWidth = profile?.simulation?.ui?.showHorizontalWidth ?? true;
    const showTimeDynamics = profile?.simulation?.ui?.showTimeDynamics ?? true;
    const showContours2D = profile?.simulation?.ui?.showContours2D ?? true;

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

    useEffect(() => {
        if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
            setResult2D(null);
            return;
        }

        setIsCalculating(true);
        setProgress(0);

        const worker = new Worker(
            new URL("./heating.worker.js", import.meta.url),
            { type: "module" }
        );

        worker.onmessage = (event) => {
            const { type, percent, result2D: workerResult, error } = event.data;

            if (type === "PROGRESS") {
                setProgress(percent);
            } else {
                if (error) {
                    console.error("Worker error:", error);
                } else {
                    setResult2D(workerResult);
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

    // 1. Деструктурируем только те палитры, которые реально используем
    const { text, primary, warning, error, success, info, divider } = theme.palette;

    // 2. Оформляем хук с честными атомарными зависимостями для ESLint
    const themeColors = useMemo(() => ({
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
    }), [text, primary, warning, error, success, info, divider]);

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
        if (matGlassTransitionTemp == null || matDecompositionTemp == null) return { unit: "°", lines: [], ranges: [] };

        return {
            unit: "°",
            lines: [
                { value: Number(matGlassTransitionTemp), color: themeColors.warningMain },
                { value: Number(matDecompositionTemp), color: themeColors.errorMain }
            ],
            ranges: [
                { from: Number(matMinFormingTemp ?? 0), to: Number(matMaxFormingTemp ?? 0), color: themeColors.successMain }
            ]
        };
    }, [matGlassTransitionTemp, matDecompositionTemp, matMinFormingTemp, matMaxFormingTemp, themeColors]);

    const profileData = result2D?.temperatureProfile;
    const hasHistory = !!result2D?.history;
    const heatingTimeSeconds = result2D?.heatingTimeSeconds;

    const chart2Data = useMemo(() => {
        if (!result2D || !hasHistory || !showTimeDynamics) return null;

        const heatTimeSec = Number(heatingTimeSeconds || 0);
        const graphsChart2 = [];

        const { history: hist2D } = result2D;
        const times = hist2D.time || [];

        const heatFront = [], heatCenter = [], heatBack = [];
        const coolFront = [], coolCenter = [], coolBack = [];

        let lastHeatPoint = null;

        for (let i = 0; i < times.length; i++) {
            const t = times[i];
            const fC = Number(hist2D.frontSurfaceC[i]);
            const cC = Number(hist2D.centerC[i]);
            const bC = Number(hist2D.backSurfaceC[i]);

            if (t <= heatTimeSec) {
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

        return {
            graphs: graphsChart2,
            axes: {
                x: { unit: "s", lines: [{ value: heatTimeSec, color: themeColors.textSecondary }], ranges: [] },
                y: commonYAxis
            }
        };
    }, [result2D, hasHistory, heatingTimeSeconds, showTimeDynamics, themeColors, commonYAxis]);

    const chartsBundle = useMemo(() => {
        if (!profileData) return null;

        const { xCoordinatesMm, yCoordinatesMm, Nx, Ny, heating, pause } = profileData;
        const thickness = xCoordinatesMm[Nx - 1] || profileThickness;
        const width = (yCoordinatesMm[Ny - 1] * 2) || profileWidth;

        const vertPointsHeating = [];
        const vertPointsPause = [];

        for (let i = 0; i < Nx; i++) {
            const xCoord = xCoordinatesMm[i];
            const baseIdx = i * Ny;
            vertPointsHeating.push([xCoord, heating[baseIdx]]);
            vertPointsPause.push([xCoord, pause[baseIdx]]);
        }

        const rawHorTopH = [], rawHorMidH = [], rawHorBotH = [];
        const rawHorTopP = [], rawHorMidP = [], rawHorBotP = [];

        // Индексы слоев по толщине листа
        const midXIdx = Math.floor(Nx / 2);
        const botXIdx = Nx - 1;

        // 1. Сначала идем СПРАВА НАЛЕВО (от Ny - 1 до 1) и пушим ОТРИЦАТЕЛЬНЫЕ координаты для левой половины
        for (let j = Ny - 1; j > 0; j--) {
            const yCoord = yCoordinatesMm[j];
            if (yCoord > 0) {
                const negY = -yCoord;
                rawHorTopH.push([negY, heating[j]]);
                rawHorMidH.push([negY, heating[midXIdx * Ny + j]]);
                rawHorBotH.push([negY, heating[botXIdx * Ny + j]]);

                rawHorTopP.push([negY, pause[j]]);
                rawHorMidP.push([negY, pause[midXIdx * Ny + j]]);
                rawHorBotP.push([negY, pause[botXIdx * Ny + j]]);
            }
        }

        // 2. Затем идем СЛЕВА НАПРАВО (от 0 до Ny - 1) и пушим ПОЛОЖИТЕЛЬНЫЕ координаты для правой половины
        for (let j = 0; j < Ny; j++) {
            const yCoord = yCoordinatesMm[j];
            rawHorTopH.push([yCoord, heating[j]]);
            rawHorMidH.push([yCoord, heating[midXIdx * Ny + j]]);
            rawHorBotH.push([yCoord, heating[botXIdx * Ny + j]]);

            rawHorTopP.push([yCoord, pause[j]]);
            rawHorMidP.push([yCoord, pause[midXIdx * Ny + j]]);
            rawHorBotP.push([yCoord, pause[botXIdx * Ny + j]]);
        }

        const glassTransition = Number(matGlassTransitionTemp);
        const kFactorPoints = rawHorTopP;
        let xTgPause = null;

        if (Number.isFinite(glassTransition) && kFactorPoints.length > 1) {
            for (let i = 0; i < kFactorPoints.length - 1; i++) {
                const p1 = kFactorPoints[i];
                const p2 = kFactorPoints[i + 1];
                if (!p1 || !p2) continue;

                const x1 = p1[0], t1 = p1[1];
                const x2 = p2[0], t2 = p2[1];

                if ((t1 >= glassTransition && t2 <= glassTransition) || (t1 <= glassTransition && t2 >= glassTransition)) {
                    xTgPause = Math.abs(t2 - t1) < 0.001 ? x1 : x1 + (glassTransition - t1) * (x2 - x1) / (t2 - t1);
                    break;
                }
            }
        }
        const finalXTgPauseValue = (xTgPause !== null && xTgPause <= width / 2) ? xTgPause : null;

        const Tg = Number(matGlassTransitionTemp);
        const Tmin = Number(matMinFormingTemp);
        const Tmax = Number(matMaxFormingTemp);
        const Tdecomp = Number(matDecompositionTemp);
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

        const heatingTargets = [{ targetTemp: Tg, key: "tg" }, { targetTemp: Tmin, key: "tmin" }, { targetTemp: Tmax, key: "tmax" }, { targetTemp: Tdecomp, key: "tdecomp" }];
        const pauseTargets = [{ targetTemp: Tg, key: "tg" }, { targetTemp: Tmin, key: "tmin" }, { targetTemp: Tmax, key: "tmax" }, { targetTemp: Tdecomp, key: "tdecomp" }];

        const heatingBatch = findMultipleIsothermsBatch(heatingTargets, heating, gridConfig);
        const pauseBatch = findMultipleIsothermsBatch(pauseTargets, pause, gridConfig);

        const isotherms = [
            { name: "Tg", phase: "Heating", segments: heatingBatch.tg, style: { color: themeColors.warningMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "T min", phase: "Heating", segments: heatingBatch.tmin, style: { color: themeColors.successMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "T max", phase: "Heating", segments: heatingBatch.tmax, style: { color: themeColors.successMain, lineWidth: 0.7, opacity: 0.7 } },
            { name: "Decomposition", phase: "Heating", segments: heatingBatch.tdecomp, style: { color: themeColors.errorMain, lineWidth: 0.7, opacity: 1 } },
            { name: "Tg", phase: "Pause", segments: pauseBatch.tg, style: { color: themeColors.warningDark, lineWidth: 1.6, opacity: 0.7 } },
            { name: "T min", phase: "Pause", segments: pauseBatch.tmin, style: { color: themeColors.successDark, lineWidth: 1.6 } },
            { name: "T max", phase: "Pause", segments: pauseBatch.tmax, style: { color: themeColors.successMain, lineWidth: 1.6 } },
            { name: "Decomposition", phase: "Pause", segments: pauseBatch.tdecomp, style: { color: themeColors.errorDark, lineWidth: 1.6 } },
        ];

        const contourGraphs = isotherms.flatMap(({ name, phase, segments, style }) =>
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

        const xLinesHor = [{ value: 0, color: themeColors.textSecondary }];
        const xLinesCont = [{ value: 0, color: themeColors.textSecondary, label: "Центр" }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                const lineGrid = { value: val, color: alpha(themeColors.divider, 0.25) };
                const lineGridNeg = { value: -val, color: alpha(themeColors.divider, 0.25) };
                xLinesHor.push(lineGrid, lineGridNeg);
                xLinesCont.push(lineGrid, lineGridNeg);
            }
        }

        if (finalXTgPauseValue !== null) {
            const bZoneLine = { value: finalXTgPauseValue, color: themeColors.warningMain, lineWidth: 1.5, dashArray: "4 4", label: `Гибочная зона (${(finalXTgPauseValue * 2).toFixed(1)} мм)` };
            const bZoneLineNeg = { value: -finalXTgPauseValue, color: themeColors.warningMain, lineWidth: 1.5, dashArray: "4 4" };
            xLinesHor.push(bZoneLine, bZoneLineNeg);
        }

        const graphsChart1 = [
            { name: "Heating (Vertical Slice)", points: vertPointsHeating, color: themeColors.textSecondary, opacity: 1, lineWidth: 1 },
            { name: "Cooling (Vertical Slice)", points: vertPointsPause, color: themeColors.textPrimary, opacity: 1, lineWidth: 1.6 }
        ];

        return {
            xTgPauseValue: finalXTgPauseValue,
            chart1: {
                graphs: graphsChart1,
                axes: { x: { unit: "mm", lines: [{ value: thickness / 2, color: themeColors.textSecondary }, { value: thickness * matKFactor, color: themeColors.infoMain }], ranges: [] }, y: commonYAxis }
            },
            chart3: {
                graphs: [
                    { name: "Верхняя поверхность", points: rawHorTopH, color: themeColors.errorMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Середина листа", points: rawHorMidH, color: themeColors.successMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Нижняя поверхность", points: rawHorBotH, color: themeColors.primaryMain, opacity: 0.8, lineWidth: 0.6 },
                    { name: "Верхняя поверхность пауза", points: rawHorTopP, color: themeColors.errorMain, opacity: 1, lineWidth: 1.2 },
                    { name: "Середина листа пауза", points: rawHorMidP, color: themeColors.successMain, opacity: 1, lineWidth: 1.2 },
                    { name: "Нижняя поверхность пауза", points: rawHorBotP, color: themeColors.primaryMain, opacity: 1, lineWidth: 1.2 }
                ],
                axes: { x: { unit: "mm", lines: xLinesHor, ranges: [] }, y: commonYAxis }
            },
            chart4: {
                graphs: contourGraphs,
                axes: { x: { unit: "mm", lines: xLinesCont, ranges: [] }, y: { unit: "mm", min: xCoordinatesMm[Nx - 1], max: 0, lines: [{ value: xCoordinatesMm[Nx - 1] / 2, color: alpha(themeColors.divider, 0.3) }, { value: xCoordinatesMm[Nx - 1] * matKFactor, color: themeColors.infoMain, label: `K = ${matKFactor}` }], ranges: [] } },
                fillPolygons: fillPolygons
            }
        };
    }, [profileData, profileWidth, profileThickness, matGlassTransitionTemp, matMinFormingTemp, matMaxFormingTemp, matDecompositionTemp, matKFactor, themeColors, commonYAxis]);

    const plasticZoneWidthCalculated = useMemo(() => {
        return chartsBundle?.xTgPauseValue !== undefined && chartsBundle?.xTgPauseValue !== null
            ? chartsBundle.xTgPauseValue * 2
            : null;
    }, [chartsBundle?.xTgPauseValue]);

    const maxRadiusCalculated = useMemo(() => {
        if (machineParams?.bendAngle == null || plasticZoneWidthCalculated == null) return null;
        const turnAngleRad = (Number(machineParams.bendAngle) * Math.PI) / 180;
        if (turnAngleRad <= 0) return 0;
        const rInnerMax = (plasticZoneWidthCalculated / turnAngleRad) - (matKFactor * profileThickness);
        return rInnerMax > 0 ? rInnerMax : 0;
    }, [plasticZoneWidthCalculated, machineParams?.bendAngle, profileThickness, matKFactor]);

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

                <Box sx={{ display: "flex", flexWrap: "wrap", mx: "auto", gap: 1, position: "relative" }}>
                    <Box
                        sx={{
                            display: "flex", flexWrap: "wrap", gap: 1, width: "100%",
                            opacity: isCalculating ? 0.4 : 1,
                            filter: isCalculating ? "blur(1px)" : "none",
                            transition: "all 0.3s ease",
                            pointerEvents: isCalculating ? "none" : "auto"
                        }}
                    >
                        {showVerticalSlice && chartsBundle?.chart1 && (
                            <Box mx="auto"><SvgLineChart chart={chartsBundle.chart1} /></Box>
                        )}

                        {showTimeDynamics && chart2Data && (
                            <Box mx="auto"><SvgLineChart chart={chart2Data} /></Box>
                        )}

                        {showHorizontalWidth && chartsBundle?.chart3 && (
                            <Box mx="auto"><SvgLineChart chart={chartsBundle.chart3} /></Box>
                        )}

                        {showContours2D && chartsBundle?.chart4 && (
                            <Box mx="auto"><SvgLineChart chart={chartsBundle.chart4} /></Box>
                        )}
                    </Box>

                    {isCalculating && (
                        <Box
                            sx={{
                                position: "absolute", inset: 0, backgroundColor: alpha(theme.palette.action.disabledBackground, 0.1),
                                borderRadius: 1, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, px: 3, minHeight: 200
                            }}
                        >
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