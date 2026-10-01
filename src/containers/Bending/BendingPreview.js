import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import { simulate1DHeating } from "./pvc-1d-transient-heating";
import SvgLineChart from "./SvgLineChart";

const PARAMETER_TEXT_COLOR = "text.primary";
const PARAMETER_TEXT_SIZE = "0.8rem";

// Чистая функция валидации
const validateProfile = (profile) => {
    if (!profile) return "Profile is missing";

    const thickness = Number(profile.thickness);
    if (!Number.isFinite(thickness) || thickness <= 0) {
        return "Thickness must be greater than 0 mm";
    }

    if (!Array.isArray(profile.shelves) || !profile.shelves.length) {
        return "At least one leg is required";
    }

    if (!Array.isArray(profile.bends)) return "Bends are missing";

    if (profile.shelves.length !== profile.bends.length + 1) {
        return "Invalid profile geometry";
    }

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

// Хелпер для быстрой сборки точек графика без дублирования кода
const getChartPoints = (valuesArray, step, xOffset = 0) => {
    return Array.from(valuesArray || [], (value, index) => [
        xOffset + index * step,
        Number(value)
    ]);
};

// Мемоизированный заголовок
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

// Мемоизированные параметры
const Parameters = React.memo(({ profile, part, machineParams, data }) => {
    const material = profile?.material;
    const blankLength = Number(part?.blankLength);
    const width = Number(profile?.width);
    const thickness = Number(profile?.thickness);
    const density = Number(material?.density);

    const mass = useMemo(() => {
        if (Number.isFinite(blankLength) && Number.isFinite(width) && Number.isFinite(thickness) && Number.isFinite(density)) {
            return (blankLength * width * thickness * density) / 1e9;
        }
        return null;
    }, [blankLength, width, thickness, density]);

    const status = data?.status;
    const statusColor = status?.type === "error" ? "error" : status?.type === "warning" ? "warning" : "text.secondary";

    const getDeltaT = useCallback((values) => {
        if (!values) return null;
        const numericValues = Array.from(values).map(Number).filter(Number.isFinite);
        if (!numericValues.length) return null;
        return Math.max(...numericValues) - Math.min(...numericValues);
    }, []);

    const heatingDeltaT = useMemo(() => getDeltaT(data?.temperatureProfile?.temperaturesC), [data?.temperatureProfile?.temperaturesC, getDeltaT]);
    const pauseDeltaT = useMemo(() => getDeltaT(data?.temperatureProfile?.cooldownProfileC), [data?.temperatureProfile?.cooldownProfileC, getDeltaT]);

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

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                    Heat temp: <strong>top: {data?.heaterTemperaturesC?.top ?? "—"}°C, bottom: {data?.heaterTemperaturesC?.bottom ?? "—"}°C</strong>
                </Typography>
            </Box>

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                Heating: <strong>{formatTime(data?.heatingTimeSeconds)}</strong> (ΔT = {heatingDeltaT !== null ? heatingDeltaT.toFixed(1) : "—"}°C)
                {Number.isFinite(Number(data?.cooldownTimeSec)) && (
                    <>
                        , Pause: <strong>{formatTime(data.cooldownTimeSec)}</strong> (ΔT = {pauseDeltaT !== null ? pauseDeltaT.toFixed(1) : "—"}°C)
                    </>
                )}
            </Typography>

            {status?.type !== "ok" && status?.message && (
                <Typography variant="body2" color={statusColor} fontSize={PARAMETER_TEXT_SIZE} fontWeight={500} sx={{ mt: 0.5 }}>
                    {status.message}
                </Typography>
            )}

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={`calc(${PARAMETER_TEXT_SIZE} * 0.8)`}>
                Simulation calculation time: {data?.calculationTimeMs?.toFixed(1)} ms
            </Typography>
        </Box>
    );
});
Parameters.displayName = "Parameters";

const BendingPreview = ({ profile, geometry, blankLength, machineParams, rotationPreview }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(([{ contentRect }]) => {
            const { width, height } = contentRect;
            if (width && height) {
                setContainerSize({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const dataSimulate = useMemo(() => {
        if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
            return null;
        }

        return simulate1DHeating({
            thicknessMm: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation,
            storeHistory: profile.simulation?.recordHistory??false
        });
    }, [profile?.thickness, profile?.material, profile?.machine, profile?.simulation]);

    const colors = useMemo(() => ({
        active: { line: theme.palette.text.primary, fill: alpha(theme.palette.text.primary, 0.1), annotation: alpha(theme.palette.text.primary, 0.75) },
        ghost: { line: theme.palette.text.disabled, fill: alpha(theme.palette.text.disabled, 0.02), annotation: alpha(theme.palette.text.disabled, 0.4) },
        blue: { line: theme.palette.primary.main, fill: alpha(theme.palette.primary.main, 0.08), annotation: theme.palette.primary.main }
    }), [theme]);

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

    // Выделенный хук для конфигурации обоих графиков
    const chartData = useMemo(() => {
        if (!dataSimulate) return { chart1: null, chart2: null };

        const { temperatureProfile, history, heatingTimeSeconds } = dataSimulate;
        const dxMm = temperatureProfile?.dxMm || 0;
        const heatHist = history?.heating;
        const coolHist = history?.cooling;
        const heatStep = heatHist?.stepSeconds || 0;
        const coolStep = coolHist?.stepSeconds || heatStep || 0;

        const glassTransition = Number(profile?.material?.glassTransitionTemp);
        const decomposition = Number(profile?.material?.decompositionTemp);

        const commonYAxis = {
            unit: "°",
            lines: [
                { value: glassTransition, color: theme.palette.warning.main },
                { value: decomposition, color: theme.palette.error.main }
            ],
            ranges: [
                { from: Number(profile?.material?.minFormingTemp), to: Number(profile?.material?.maxFormingTemp), color: theme.palette.success.main }
            ]
        };

        const chart1 = {
            graphs: [
                {
                    name: "Heating",
                    points: getChartPoints(temperatureProfile?.temperaturesC, dxMm),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 2,
                },
                {
                    name: "Cooling",
                    points: getChartPoints(temperatureProfile?.cooldownProfileC, dxMm),
                    color: theme.palette.text.secondary, opacity: 0.7, lineWidth: 1,
                }
            ],
            axes: {
                x: { unit: "mm", lines: [{ value: Number(profile?.thickness) / 2, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        };

        const chart2 = {
            graphs: [
                {
                    name: "frontSurfaceC",
                    points: getChartPoints(heatHist?.frontSurfaceC, heatStep)
                        .concat([[heatingTimeSeconds, coolHist?.frontSurfaceC?.[0] || 0]]),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 1.5, showMarker: false,
                },
                {
                    name: "frontSurfaceCooling",
                    points: getChartPoints(coolHist?.frontSurfaceC, coolStep, Number(heatingTimeSeconds)),
                    color: theme.palette.text.secondary, opacity: 0.7, lineWidth: 1, showMarker: true,
                },
                {
                    name: "backSurfaceC",
                    points: getChartPoints(heatHist?.backSurfaceC, heatStep)
                        .concat([[heatingTimeSeconds, coolHist?.backSurfaceC?.[0] || 0]]),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 1.5, showMarker: false,
                },
                {
                    name: "backSurfaceCooling",
                    points: getChartPoints(coolHist?.backSurfaceC, coolStep, Number(heatingTimeSeconds)),
                    color: theme.palette.text.secondary, opacity: 0.7, lineWidth: 1, showMarker: true,
                },
                {
                    name: "centerC",
                    points: getChartPoints(heatHist?.centerC, heatStep)
                        .concat([[heatingTimeSeconds, coolHist?.centerC?.[0] || 0]]),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 1.5, showMarker: false,
                },
                {
                    name: "centerCooling",
                    points: getChartPoints(coolHist?.centerC, coolStep, Number(heatingTimeSeconds)),
                    color: theme.palette.text.secondary, opacity: 0.7, lineWidth: 1, showMarker: true,
                }
            ],
            axes: {
                x: { unit: "s", lines: [{ value: Number(heatingTimeSeconds), color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        };

        return { chart1, chart2 };
    }, [dataSimulate, theme, profile]);

    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader profile={profile} />

            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
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

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", width: "100%", flexShrink: 0, gap: 1 }}>
                <Box sx={{ flex: "1 1 18rem" }}>
                    <Parameters profile={profile} part={{ blankLength }} machineParams={machineParams} data={dataSimulate} />
                </Box>

                {chartData.chart1 && chartData.chart2 && (
                    <Box sx={{ flex: "0 1 auto", maxWidth: "100%", mx: "auto" }}>
                        <Box><SvgLineChart chart={chartData.chart1} /></Box>
                        <Box><SvgLineChart chart={chartData.chart2} /></Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default BendingPreview;
