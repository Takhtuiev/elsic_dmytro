import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./Chart/SvgLineChart";
import { validateProfile } from "./profileValidation";
import { formatTime } from "./formatters";
import { calculateMass, calculatePlasticZoneWidth, calculateMaxInnerRadius } from "./bendingMetrics";
import { useHeatingSimulation } from "./useHeatingSimulation";
import {
    extractThemeColors,
    getLayerColors,
    createTemperatureYAxis,
    buildTimeDynamicsChart,
    buildHeaterDynamicsChart,
    buildSpatialCharts,
} from "./Chart/chartBuilders";

const PARAMETER_TEXT_COLOR = "text.primary";
const PARAMETER_TEXT_SIZE = "0.8rem";

const PartHeader = React.memo(({ partName, materialName, thickness }) => (
    <Box
        className="bend-preview-header"
        sx={{
            px: 1,
            py: 0.75,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            borderTop: "1px solid",
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
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

const prepareTechnicalMetrics = (technicalMetrics) => {
    if (!technicalMetrics) return null;

    const { calculationTimeMs, accuracy, iterations } = technicalMetrics;
    const picardErr = accuracy?.picardConvergenceErrorC;

    return {
        calculationTimeStr: Number.isFinite(calculationTimeMs)
            ? `${calculationTimeMs.toFixed(1)} ms`
            : "— ms",
        mode: accuracy?.accuracyMode
            ? accuracy.accuracyMode.charAt(0).toUpperCase() + accuracy.accuracyMode.slice(1)
            : "—",
        totalErrorScore: Number.isFinite(accuracy?.totalErrorScore)
            ? accuracy.totalErrorScore.toFixed(3)
            : "—",
        errorDetails: accuracy
            ? {
                time: Number.isFinite(accuracy.timeIntegrationErrorC)
                    ? `${accuracy.timeIntegrationErrorC.toFixed(3)}°C`
                    : "—",
                grid: Number.isFinite(accuracy.spatialGridErrorC)
                    ? `${accuracy.spatialGridErrorC.toFixed(3)}°C`
                    : "—",
                picard: Number.isFinite(picardErr)
                    ? `${Math.abs(picardErr).toFixed(3)}°C`
                    : "—",
                residual: Number.isFinite(accuracy.linearResidual)
                    ? accuracy.linearResidual.toExponential(1)
                    : null,
            }
            : null,
        steps: iterations?.totalTimeSteps ?? "—",
        rejectedSteps: iterations?.rejectedTimeSteps ?? 0,
        picardIters: iterations?.totalPicardIterations ?? "—",
        loadStr: iterations?.totalGridPointsProcessed
            ? `${iterations.totalGridPointsProcessed.toLocaleString("en-US").replace(/,/g, "\u00A0")} pts`
            : "— pts",
    };
};

const Parameters = React.memo(({
                                   width,
                                   thickness,
                                   density,
                                   blankLength,
                                   machineParams,
                                   heatingTimeSeconds,
                                   coolingTimeSeconds,
                                   status,
                                   heatingDeltaT,
                                   pauseDeltaT,
                                   plasticZoneWidth,
                                   maxRadius,
                                   technicalMetrics,
                               }) => {
    const mass = useMemo(
        () => calculateMass(blankLength, width, thickness, density),
        [blankLength, width, thickness, density]
    );

    const metrics = useMemo(() => prepareTechnicalMetrics(technicalMetrics), [technicalMetrics]);

    const statusColor = status?.type === "error" ? "error" : status?.type === "warn" ? "warning" : "text.secondary";

    const SYS_TEXT_SIZE = `calc(${PARAMETER_TEXT_SIZE} * 0.75)`;
    const SYS_BOX_SX = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mt: 0.4 };

    return (
        <Box className="bend-preview-parameters">
            {/* ТЕХНОЛОГИЧЕСКИЕ ПАРАМЕТРЫ */}
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
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 0.25 }}>
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

            <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE} sx={{ mt: 0.25 }}>
                Heating: <strong>{formatTime(heatingTimeSeconds)}</strong>{" "}
                <span style={{ fontSize: "0.85em", opacity: 0.85 }}>
                    (ΔT = {Number.isFinite(heatingDeltaT) ? heatingDeltaT.toFixed(1) : "—"}°C)
                </span>
                {Number.isFinite(Number(coolingTimeSeconds)) && (
                    <>
                        , Pause: <strong>{coolingTimeSeconds}s</strong>{" "}
                        <span style={{ fontSize: "0.85em", opacity: 0.85 }}>
                            (ΔT = {Number.isFinite(pauseDeltaT) ? pauseDeltaT.toFixed(1) : "—"}°C)
                        </span>
                    </>
                )}
            </Typography>

            {Number.isFinite(plasticZoneWidth) && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 0.25 }}>
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

            {/* ТЕХНИЧЕСКИЕ ВЫЧИСЛИТЕЛЬНЫЕ ДАННЫЕ */}
            {metrics && (
                <>
                    <Box sx={SYS_BOX_SX}>
                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Simulation calculation time: <strong>{metrics.calculationTimeStr}</strong>
                        </Typography>
                    </Box>

                    <Box sx={SYS_BOX_SX}>
                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Error score: <strong>{metrics.totalErrorScore}</strong>
                            {metrics.errorDetails && (
                                <span style={{ marginLeft: 6, opacity: 0.85 }}>
                                    (Time: <strong>{metrics.errorDetails.time}</strong>, Grid: <strong>{metrics.errorDetails.grid}</strong>, Picard: <strong>{metrics.errorDetails.picard}</strong>
                                    {metrics.errorDetails.residual !== null && (
                                        <>, Residual: <strong>{metrics.errorDetails.residual}</strong></>
                                    )})
                                </span>
                            )}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Mode: <strong>{metrics.mode}</strong>
                        </Typography>
                    </Box>

                    <Box sx={SYS_BOX_SX}>
                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Solver steps: <strong>{metrics.steps}</strong>
                            {metrics.rejectedSteps > 0 && (
                                <span style={{ color: "var(--mui-palette-warning-main)", marginLeft: 4 }}>
                                    ({metrics.rejectedSteps} rejected)
                                </span>
                            )}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Picard iterations: <strong>{metrics.picardIters}</strong>
                        </Typography>

                        <Typography variant="body2" color="text.secondary" fontSize={SYS_TEXT_SIZE}>
                            Computational load: <strong>{metrics.loadStr}</strong>
                        </Typography>
                    </Box>
                </>
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
    const showTimeDynamics = simulationUi.showTimeDynamics;
    const showContours2D = simulationUi.showContours2D && simulation?.widthHalfMm !== 0;
    const showHeaterDynamics = simulationUi.showHeaterDynamics ?? true;

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

    const matKFactor = profile?.material?.kFactor ?? 0;
    const profileWidth = Number(profile?.width || 0);
    const profileThickness = Number(profile?.thickness || 0);
    const ambientTemp = profile?.simulation?.temperatures?.ambientC ?? 20;

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

    const themeColors = useMemo(() => extractThemeColors(theme.palette), [theme.palette]);
    const layerColors = useMemo(() => getLayerColors(themeColors), [themeColors]);

    const colors = useMemo(
        () => ({
            active: {
                line: themeColors.textPrimary,
                fill: alpha(themeColors.textPrimary, 0.1),
                annotation: alpha(themeColors.textPrimary, 0.75),
            },
            ghost: {
                line: themeColors.textDisabled,
                fill: alpha(themeColors.textDisabled, 0.02),
                annotation: alpha(themeColors.textDisabled, 0.4),
            },
            blue: {
                line: themeColors.primaryMain,
                fill: alpha(themeColors.primaryMain, 0.08),
                annotation: themeColors.primaryMain,
            },
        }),
        [themeColors]
    );

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
    // ПОДГОТОВКА ГРАФИКОВ ЧЕРЕЗ CHARTBUILDERS
    // ==========================================
    const rawData = result2D?.geometryData;
    const heatTimeSec = Number(result2D?.heatingTimeSeconds || 0);

    const baseYAxis = useMemo(
        () => createTemperatureYAxis(profile?.material, themeColors),
        [profile?.material, themeColors]
    );

    const timeDynamicsChart = useMemo(() => {
        if (!showTimeDynamics) return null;
        return buildTimeDynamicsChart(rawData, heatTimeSec, baseYAxis, themeColors, layerColors);
    }, [showTimeDynamics, rawData, heatTimeSec, baseYAxis, themeColors, layerColors]);

    const heaterDynamicsChart = useMemo(() => {
        if (!showHeaterDynamics) return null;
        return buildHeaterDynamicsChart(rawData, heatTimeSec, themeColors, layerColors, profile?.machine?.name, profile?.machine?.pidPhaseOffsetSeconds);
    }, [showHeaterDynamics, rawData, heatTimeSec, themeColors, layerColors, profile?.machine?.name, profile?.machine?.pidPhaseOffsetSeconds]);

    const spatialCharts = useMemo(
        () => buildSpatialCharts(rawData, baseYAxis, ambientTemp, matKFactor, themeColors, layerColors),
        [rawData, baseYAxis, ambientTemp, matKFactor, themeColors, layerColors]
    );

    const plasticZoneWidthCalculated = useMemo(
        () => calculatePlasticZoneWidth(spatialCharts?.xTgPauseValue),
        [spatialCharts?.xTgPauseValue]
    );

    const maxRadiusCalculated = useMemo(
        () => calculateMaxInnerRadius(plasticZoneWidthCalculated, machineParams?.bendAngle, profileThickness, matKFactor),
        [plasticZoneWidthCalculated, machineParams?.bendAngle, profileThickness, matKFactor]
    );

    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader partName={profile?.name} materialName={profile?.material?.name} thickness={profile?.thickness} />

            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{
                    flex: 1,
                    minWidth: 360,
                    maxHeight: 480,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                {validationError ? (
                    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                        <Typography variant="body2" fontWeight={500} color="warning.main">
                            {validationError}
                        </Typography>
                    </Box>
                ) : (
                    svgData && (
                        <svg className="bend-preview-svg" viewBox={svgData.viewBox} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                            <g transform={visualRotation ? `rotate(${visualRotation},${rotationCenter.x},${rotationCenter.y})` : undefined}>
                                <BendProfileRender data={svgData.activeData} strokeColor={colors.active.line} fillColor={colors.active.fill} annotationColor={colors.active.annotation} />
                                <BendProfileRender data={svgData.ghostData} strokeColor={colors.ghost.line} fillColor={colors.ghost.fill} annotationColor={colors.ghost.annotation} isGhost />
                                <BendProfileRender data={svgData.blueData} strokeColor={colors.blue.line} fillColor={colors.blue.fill} annotationColor={colors.blue.annotation} />
                            </g>
                        </svg>
                    )
                )}
            </Box>

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 3, mt: 1 }}>
                <Box sx={{ width: "100%" }}>
                    <Parameters
                        width={profileWidth}
                        thickness={profileThickness}
                        density={profile?.material?.density}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        heatingTimeSeconds={result2D?.heatingTimeSeconds}
                        coolingTimeSeconds={result2D?.coolingTimeSeconds}
                        status={result2D?.status}
                        heatingDeltaT={result2D?.geometryData?.heatingDeltaT}
                        pauseDeltaT={result2D?.geometryData?.pauseDeltaT}
                        plasticZoneWidth={plasticZoneWidthCalculated}
                        maxRadius={maxRadiusCalculated}
                        technicalMetrics={result2D?.technicalMetrics}
                    />
                </Box>

                <Box sx={{ width: "100%", position: "relative" }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "100%", md: "repeat(2, 1fr)" },
                            gap: 2,
                            width: "100%",
                            opacity: isCalculating ? 0.4 : 1,
                            filter: isCalculating ? "blur(1px)" : "none",
                            transition: "all 0.3s ease",
                            pointerEvents: isCalculating ? "none" : "auto",
                        }}
                    >
                        {showVerticalSlice && spatialCharts?.verticalSlice && <SvgLineChart chart={spatialCharts.verticalSlice} maxHeight={150} />}
                        {showContours2D && spatialCharts?.contours2D && <SvgLineChart chart={spatialCharts.contours2D} maxHeight={150} />}
                        {showHeaterDynamics && heaterDynamicsChart && <SvgLineChart chart={heaterDynamicsChart} maxHeight={150} />}
                        {showTimeDynamics && timeDynamicsChart && <SvgLineChart chart={timeDynamicsChart} maxHeight={150} />}
                        {showHorizontalWidth && spatialCharts?.horizontalWidth && <SvgLineChart chart={spatialCharts.horizontalWidth} maxHeight={150} />}
                    </Box>

                    {isCalculating && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: alpha(theme.palette.action.disabledBackground, 0.1),
                                borderRadius: 1,
                                zIndex: 10,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 1.5,
                                px: 3,
                                minHeight: 200,
                            }}
                        >
                            <Typography variant="body2" fontWeight={600} color="text.secondary">
                                2D simulation in progress...
                            </Typography>
                            <Box sx={{ width: "100%", maxWidth: 220, display: "flex", alignItems: "center", gap: 1.5 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{
                                        flexGrow: 1,
                                        height: 6,
                                        borderRadius: 3,
                                        "& .MuiLinearProgress-bar": {
                                            transition: "transform 0.2s ease-out",
                                        },
                                    }}
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
