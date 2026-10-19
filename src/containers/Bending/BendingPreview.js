import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./SvgLineChart";

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
                                   maxRadius
                               }) => {
    const mass = useMemo(() => {
        if (Number.isFinite(blankLength) && Number.isFinite(width) && Number.isFinite(thickness) && Number.isFinite(density)) {
            return (blankLength * width * thickness * density) / 1e9;
        }
        return null;
    }, [blankLength, width, thickness, density]);

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

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.8)`}>
                Simulation calculation time: {Number.isFinite(calculationTimeMs) ? calculationTimeMs.toFixed(1) : "—"} ms
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

        // Флаг отмены для предотвращения гонки состояний при быстром вводе данных
        let isCancelled = false;

        const worker = new Worker(
            new URL("./heating.worker.js", import.meta.url),
            { type: "module" }
        );

        worker.onmessage = (event) => {
            if (isCancelled) return; // Игнорируем сообщения, если хук размонтирован
            const { type, percent, result2D: workerResult, geometryData, error } = event.data;

            if (type === "PROGRESS") {
                setProgress(percent);
            } else {
                if (error) {
                    console.error("Worker error:", error);
                } else {
                    setResult2D({ ...workerResult, geometryData });
                    setProgress(100);
                }
                setIsCalculating(false);
            }
        };

        worker.postMessage({ profile });

        return () => {
            isCancelled = true;
            worker.terminate(); // Принудительно завершаем поток воркера
        };
    }, [profile]);


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

    const chart2Data = useMemo(() => {
        const rawData = result2D?.geometryData;
        if (!rawData || !rawData.graphsChart2Raw || !showTimeDynamics) return null;

        const heatTimeSec = Number(result2D?.heatingTimeSeconds || 0);

        const styleMap = {
            frontHeat:  { color: themeColors.errorMain,   opacity: 1, lineWidth: 1, showMarker: false },
            centerHeat: { color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: false },
            backHeat:   { color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: false },
            frontCool:  { color: themeColors.errorMain,   opacity: 1, lineWidth: 1, showMarker: true },
            centerCool: { color: themeColors.successMain, opacity: 1, lineWidth: 1, showMarker: true },
            backCool:   { color: themeColors.primaryMain, opacity: 1, lineWidth: 1, showMarker: true },
        };

        const graphs = rawData.graphsChart2Raw.map(g => ({
            ...g,
            ...styleMap[g.typeKey]
        }));

        return {
            graphs,
            axes: {
                x: { unit: "s", lines: [{ value: heatTimeSec, color: themeColors.textSecondary }], ranges: [] },
                y: commonYAxis
            }
        };
    }, [result2D, showTimeDynamics, themeColors, commonYAxis]);

    const chartsBundle = useMemo(() => {
        const rawData = result2D?.geometryData;
        if (!rawData) return null;

        const {
            thickness, width, finalXTgPauseValue,
            vertPointsHeating, vertPointsPause,
            rawHorTopH, rawHorMidH, rawHorBotH,
            rawHorTopP, rawHorMidP, rawHorBotP,
            contourGraphsRaw, fillPolygonsRaw,
            xCoordinatesMm
        } = rawData;

        const contourGraphs = contourGraphsRaw.map(g => {
            let dynamicStyle = { lineWidth: 0.7, opacity: 0.7, color: themeColors.textPrimary };

            if (g.name === "Tg") {
                dynamicStyle.color = g.phase === "Heating" ? themeColors.warningMain : themeColors.warningDark;
            } else if (g.name === "T min") {
                dynamicStyle.color = g.phase === "Heating" ? themeColors.successMain : themeColors.successDark;
            } else if (g.name === "T max") {
                dynamicStyle.color = themeColors.successMain;
            } else if (g.name === "Decomposition") {
                dynamicStyle.color = g.phase === "Heating" ? themeColors.errorMain : themeColors.errorDark;
                dynamicStyle.opacity = 1;
            }

            if (g.phase === "Pause") {
                dynamicStyle.lineWidth = 1.6;
            }

            return {
                ...g,
                color: dynamicStyle.color,
                opacity: dynamicStyle.opacity,
                lineWidth: dynamicStyle.lineWidth
            };
        });

        const polygonStyleMap = {
            "Solid Plastic":       { color: themeColors.infoMain,    opacity: 0.3 },
            "High Elastic":        { color: themeColors.successMain, opacity: 0.05 },
            "Optimal Bending":     { color: themeColors.successMain, opacity: 0.15 },
            "High Temperature":    { color: themeColors.warningMain, opacity: 0.1 },
            "Decomposition Risk":  { color: themeColors.errorMain,   opacity: 0.3 }
        };

        const fillPolygons = fillPolygonsRaw.map(p => ({
            ...p,
            color: polygonStyleMap[p.name]?.color || themeColors.successMain,
            opacity: polygonStyleMap[p.name]?.opacity || 0.15
        }));

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

        return {
            xTgPauseValue: finalXTgPauseValue,
            chart1: {
                graphs: [
                    { name: "Heating (Vertical Slice)", points: vertPointsHeating, color: themeColors.textSecondary, opacity: 1, lineWidth: 1 },
                    { name: "Cooling (Vertical Slice)", points: vertPointsPause, color: themeColors.textPrimary, opacity: 1, lineWidth: 1.6 }
                ],
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
                ].map(graph => {
                    // 1. Получаем исходные точки графика. Если их нет, возвращаем пустой массив
                    const points = graph.points || [];
                    if (points.length === 0) return graph;

                    // 2. Определяем температуру окружающей среды (дефолт 20°C, если в объекте нет явного поля)
                    const ambientTemp = Number(profile?.simulation?.ambientTemp ?? profile?.material?.initialTemp ?? 20);

                    // 3. Рассчитываем физическую границу листа по оси X (половина ширины)
                    const maxSheetX = width > 0 ? width / 2 : points[points.length - 1].x;

                    // Сортируем точки по возрастанию X на случай, если воркер отдал их зеркально
                    const sortedPoints = [...points].sort((a, b) => a.x - b.x);
                    const firstPoint = sortedPoints[0];
                    const lastPoint = sortedPoints[sortedPoints.length - 1];

                    const extendedPoints = [];

                    // 4. Добавляем точку старта на краю листа с комнатной температурой
                    if (firstPoint.x > -maxSheetX) {
                        extendedPoints.push({ x: -maxSheetX, y: ambientTemp });
                    }

                    // Вставляем все рассчитанные симуляцией точки
                    extendedPoints.push(...sortedPoints);

                    // 5. Добавляем точку финиша на противоположном краю листа
                    if (lastPoint.x < maxSheetX) {
                        extendedPoints.push({ x: maxSheetX, y: ambientTemp });
                    }

                    return {
                        ...graph,
                        points: extendedPoints
                    };
                }),
                axes: { x: { unit: "mm", lines: xLinesHor, ranges: [] }, y: commonYAxis }
            },

            chart4: {
                graphs: contourGraphs,
                showLabels: false,
                showPoints: false,
                axes: {
                    x: { unit: "mm", lines: xLinesCont, ranges: [] },
                    y: { unit: "mm", min: xCoordinatesMm[xCoordinatesMm.length - 1], max: 0, lines: [{ value: xCoordinatesMm[xCoordinatesMm.length - 1] / 2, color: alpha(themeColors.divider, 0.3) }, { value: xCoordinatesMm[xCoordinatesMm.length - 1] * matKFactor, color: themeColors.infoMain, label: `K = ${matKFactor}` }], ranges: [] }
                },
                fillPolygons: fillPolygons
            }
        };
    }, [result2D?.geometryData, themeColors.infoMain, themeColors.successMain, themeColors.warningMain, themeColors.errorMain, themeColors.textSecondary, themeColors.textPrimary, themeColors.primaryMain, themeColors.divider, themeColors.warningDark, themeColors.successDark, themeColors.errorDark, matKFactor, commonYAxis, profile?.simulation?.ambientTemp, profile?.material?.initialTemp]);

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
            <PartHeader
                partName={profile?.name}
                materialName={profile?.material?.name}
                thickness={profile?.thickness}
            />

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
                        width={profileWidth}
                        thickness={profileThickness}
                        density={profile?.material?.density}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        heatingTimeSeconds={result2D?.heatingTimeSeconds}
                        coolingTimeSeconds={result2D?.coolingTimeSeconds}
                        calculationTimeMs={result2D?.calculationTimeMs}
                        status={result2D?.status}
                        heatingDeltaT={result2D?.geometryData?.heatingDeltaT}
                        pauseDeltaT={result2D?.geometryData?.pauseDeltaT}
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
                            <Box sx={{ display: "flex", justifyContent: "center", flexGrow: 1, minWidth: 0 }}>
                                <SvgLineChart chart={chartsBundle.chart1} />
                            </Box>
                        )}

                        {showTimeDynamics && chart2Data && (
                            <Box sx={{ display: "flex", justifyContent: "center", flexGrow: 1, minWidth: 0 }}>
                                <SvgLineChart chart={chart2Data} />
                            </Box>
                        )}

                        {showHorizontalWidth && chartsBundle?.chart3 && (
                            <Box sx={{ display: "flex", justifyContent: "center", flexGrow: 1, minWidth: 0 }}>
                                <SvgLineChart chart={chartsBundle.chart3} />
                            </Box>
                        )}

                        {showContours2D && chartsBundle?.chart4 && (
                            <Box sx={{ display: "flex", justifyContent: "center", flexGrow: 1, minWidth: 0 }}>
                                <SvgLineChart chart={chartsBundle.chart4} />
                            </Box>
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
