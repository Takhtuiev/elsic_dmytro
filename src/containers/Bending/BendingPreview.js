import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./Chart/SvgLineChart";
import { validateProfile } from "./profileValidation";
import { formatTime } from "./formatters";
import { calculateMass, calculatePlasticZoneWidth, calculateMaxInnerRadius } from "./bendingMetrics";
import { useHeatingSimulation } from "./useHeatingSimulation";
import { ChartCard, NUMERIC_SX, SectionHeader, ValueTile } from "./uiKit";
import {
    extractThemeColors,
    getLayerColors,
    createTemperatureYAxis,
    buildTimeDynamicsChart,
    buildHeaterDynamicsChart,
    buildSpatialCharts
} from "./Chart/chartBuilders";

const CHART_HEIGHT = 160;
const TILE_GRID_SX = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(8.5rem, 1fr))",
    gap: 1,
    px: 1.5
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fixed = (v, digits) => (isNum(v) ? v.toFixed(digits) : null);

// --- Шапка: деталь, материал, толщина и состояние расчёта ---------------------

const StatusBadge = ({ isCalculating, progress, status }) => {
    const tone = isCalculating ? "info" : status?.type === "error" ? "error" : status?.type === "warn" ? "warning" : "success";
    const text = isCalculating ? `Calculating ${progress}%` : status?.type === "error" ? "Error" : status?.type === "warn" ? "Warning" : status ? "Ready" : "—";
    return (
        <Box
            sx={(theme) => ({
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: 10,
                fontSize: "0.72rem",
                fontWeight: 600,
                ...NUMERIC_SX,
                color: theme.palette[tone].main,
                bgcolor: alpha(theme.palette[tone].main, 0.1)
            })}
        >
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: `${tone}.main` }} />
            {text}
        </Box>
    );
};

const HeaderItem = ({ label, value }) => (
    <Typography noWrap sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
        {label}{" "}
        <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{value}</Box>
    </Typography>
);

const PartHeader = React.memo(({ partName, materialName, thickness, width, isCalculating, progress, status }) => (
    <Box
        className="bend-preview-header"
        sx={{
            px: 1.5,
            py: 0.75,
            display: "flex",
            flexWrap: "wrap",
            columnGap: 2,
            rowGap: 0.5,
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0
        }}
    >
        <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 700, mr: 0.5 }}>{partName || "Untitled part"}</Typography>
        <HeaderItem label="Material" value={materialName || "—"} />
        <HeaderItem label="t =" value={isNum(thickness) && thickness > 0 ? `${thickness} mm` : "—"} />
        <HeaderItem label="b =" value={isNum(width) && width > 0 ? `${width} mm` : "—"} />
        <Box sx={{ ml: "auto" }}>
            <StatusBadge isCalculating={isCalculating} progress={progress} status={status} />
        </Box>
    </Box>
));
PartHeader.displayName = "PartHeader";

// --- Сообщение о проблеме -----------------------------------------------------

const Notice = ({ type, children }) => {
    const tone = type === "error" ? "error" : "warning";
    const Icon = type === "error" ? ErrorOutlineIcon : WarningAmberIcon;
    return (
        <Box
            role="status"
            sx={(theme) => ({
                mx: 1.5,
                mt: 1,
                px: 1.25,
                py: 0.75,
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: alpha(theme.palette[tone].main, 0.5),
                bgcolor: alpha(theme.palette[tone].main, 0.07),
                color: `${tone}.main`,
                fontSize: "0.8rem",
                fontWeight: 500
            })}
        >
            <Icon fontSize="small" />
            <Box sx={{ color: "text.primary" }}>{children}</Box>
        </Box>
    );
};

// --- Строка диагностики решателя ---------------------------------------------

const SolverLine = React.memo(({ metrics }) => {
    if (!metrics) return null;
    const { calculationTimeMs, accuracy, iterations } = metrics;
    const mode = accuracy?.accuracyMode
        ? accuracy.accuracyMode.charAt(0).toUpperCase() + accuracy.accuracyMode.slice(1)
        : null;
    const load = iterations?.totalGridPointsProcessed;
    const loadText = isNum(load) ? (load >= 1e6 ? `${(load / 1e6).toFixed(1)} M` : `${Math.round(load / 1e3)} k`) : null;

    const items = [
        mode && ["Mode", mode],
        isNum(calculationTimeMs) && ["Time", `${calculationTimeMs.toFixed(0)} ms`],
        isNum(iterations?.totalTimeSteps) && ["Steps", `${iterations.totalTimeSteps}${iterations.rejectedTimeSteps > 0 ? ` (${iterations.rejectedTimeSteps} rej.)` : ""}`],
        isNum(iterations?.totalPicardIterations) && ["Picard", String(iterations.totalPicardIterations)],
        loadText && ["Load", `${loadText} pts`],
        isNum(accuracy?.totalErrorScore) && ["Error score", accuracy.totalErrorScore.toFixed(3)]
    ].filter(Boolean);

    const details = accuracy && [
        isNum(accuracy.timeIntegrationErrorC) && `time ${accuracy.timeIntegrationErrorC.toFixed(3)}`,
        isNum(accuracy.spatialGridErrorC) && `grid ${accuracy.spatialGridErrorC.toFixed(3)}`,
        isNum(accuracy.picardConvergenceErrorC) && `Picard ${Math.abs(accuracy.picardConvergenceErrorC).toFixed(3)}`,
        isNum(accuracy.linearResidual) && `residual ${accuracy.linearResidual.toExponential(1)}`
    ].filter(Boolean).join(" · ");

    return (
        <Box
            title={details ? `Error components, °C: ${details}` : undefined}
            sx={{
                mx: 1.5,
                mt: 1,
                display: "flex",
                flexWrap: "wrap",
                columnGap: 2,
                rowGap: 0.25,
                fontSize: "0.72rem",
                color: "text.secondary",
                ...NUMERIC_SX
            }}
        >
            <Box component="span" sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Solver</Box>
            {items.map(([label, value]) => (
                <Box component="span" key={label}>
                    {label} <Box component="span" sx={{ color: "text.primary" }}>{value}</Box>
                </Box>
            ))}
            {details && <Box component="span" sx={{ opacity: 0.8 }}>({details})</Box>}
        </Box>
    );
});
SolverLine.displayName = "SolverLine";

// --- Чертёж -------------------------------------------------------------------

const BendingPreview = ({ profile, geometry, blankLength, machineParams, simulation, rotationPreview }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 800, height: 420 });

    const simulationUi = simulation?.ui ?? profile?.simulation?.ui ?? {};
    const hasWidthField = Number(simulation?.widthHalfMm) !== 0;
    const showVerticalSlice = simulationUi.showVerticalSlice ?? true;
    const showHorizontalWidth = Boolean(simulationUi.showHorizontalWidth) && hasWidthField;
    const showTimeDynamics = Boolean(simulationUi.showTimeDynamics);
    const showContours2D = Boolean(simulationUi.showContours2D) && hasWidthField;
    const showHeaterDynamics = simulationUi.showHeaterDynamics ?? true;

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

    const matKFactor = profile?.material?.kFactor ?? 0;
    const profileWidth = Number(profile?.width);
    const profileThickness = Number(profile?.thickness);
    const ambientTemp = profile?.simulation?.temperatures?.ambientC ?? 20;

    useEffect(() => {
        const node = containerRef.current;
        if (!node) return undefined;
        let frame = 0;
        const observer = new ResizeObserver((entries) => {
            const rect = entries?.[0]?.contentRect;
            if (!rect) return;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (rect.width && rect.height) {
                    setContainerSize((prev) => (
                        Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
                            ? prev
                            : { width: rect.width, height: rect.height }
                    ));
                }
            });
        });
        observer.observe(node);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, []);

    // Для теплового расчёта нужны только толщина, материал, станок и параметры симуляции:
    // правка полок и углов не перезапускает симуляцию
    const physicsProfile = useMemo(() => {
        if (!(Number(profile?.thickness) > 0) || !profile?.material || !profile?.machine || !profile?.simulation) {
            return null;
        }
        return {
            thickness: Number(profile.thickness),
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation
        };
    }, [profile?.thickness, profile?.material, profile?.machine, profile?.simulation]);

    const thicknessError = Number(profile?.thickness) > 0 ? null : "Thickness must be greater than 0 mm";
    const { result2D, isCalculating, progress } = useHeatingSimulation(physicsProfile, thicknessError);

    const themeColors = useMemo(() => extractThemeColors(theme.palette), [theme.palette]);
    const layerColors = useMemo(() => getLayerColors(themeColors), [themeColors]);

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
    const rotationCenter = useMemo(() => {
        const v = svgData?.viewBox?.split(/\s+/).map(Number);
        return v?.length === 4 ? { x: v[0] + v[2] / 2, y: v[1] + v[3] / 2 } : { x: 0, y: 0 };
    }, [svgData?.viewBox]);

    // --- Графики ---
    const rawData = result2D?.geometryData;
    const heatTimeSec = Number(result2D?.heatingTimeSeconds || 0);

    const baseYAxis = useMemo(() => createTemperatureYAxis(profile?.material, themeColors), [profile?.material, themeColors]);

    const timeDynamicsChart = useMemo(
        () => (showTimeDynamics ? buildTimeDynamicsChart(rawData, heatTimeSec, baseYAxis, themeColors, layerColors) : null),
        [showTimeDynamics, rawData, heatTimeSec, baseYAxis, themeColors, layerColors]
    );

    const heaterDynamicsChart = useMemo(
        () => (showHeaterDynamics
            ? buildHeaterDynamicsChart(rawData, heatTimeSec, themeColors, layerColors, profile?.machine?.name, profile?.machine?.pidPhaseOffsetSeconds)
            : null),
        [showHeaterDynamics, rawData, heatTimeSec, themeColors, layerColors, profile?.machine?.name, profile?.machine?.pidPhaseOffsetSeconds]
    );

    const spatialCharts = useMemo(
        () => buildSpatialCharts(rawData, baseYAxis, ambientTemp, matKFactor, themeColors, layerColors),
        [rawData, baseYAxis, ambientTemp, matKFactor, themeColors, layerColors]
    );

    // --- Показатели ---
    const mass = useMemo(
        () => calculateMass(blankLength, profileWidth, profileThickness, Number(profile?.material?.density)),
        [blankLength, profileWidth, profileThickness, profile?.material?.density]
    );
    const plasticZoneWidth = useMemo(() => calculatePlasticZoneWidth(spatialCharts?.xTgPauseValue), [spatialCharts?.xTgPauseValue]);
    const maxRadius = useMemo(
        () => calculateMaxInnerRadius(plasticZoneWidth, machineParams?.bendAngle, profileThickness, matKFactor),
        [plasticZoneWidth, machineParams?.bendAngle, profileThickness, matKFactor]
    );

    const status = result2D?.status;
    const heatingDeltaT = rawData?.heatingDeltaT;
    const pauseDeltaT = rawData?.pauseDeltaT;
    const coolingSeconds = Number(result2D?.coolingTimeSeconds);
    const bendNumber = (view?.bendIndex ?? -1) + 1;

    const charts = [
        showVerticalSlice && spatialCharts?.verticalSlice && { key: "slice", title: "Temperature through thickness", chart: spatialCharts.verticalSlice },
        showContours2D && spatialCharts?.contours2D && { key: "contours", title: "Cross-section isotherms", chart: spatialCharts.contours2D },
        showHeaterDynamics && heaterDynamicsChart && { key: "heaters", title: "Heater temperatures", chart: heaterDynamicsChart },
        showTimeDynamics && timeDynamicsChart && { key: "time", title: "Temperature vs. time", chart: timeDynamicsChart },
        showHorizontalWidth && spatialCharts?.horizontalWidth && { key: "width", title: "Temperature across width", chart: spatialCharts.horizontalWidth }
    ].filter(Boolean);

    return (
        <Box className="bend-preview" sx={{ width: "100%", display: "flex", flexDirection: "column", minHeight: 0, pb: 1.5 }}>
            <PartHeader
                partName={profile?.name}
                materialName={profile?.material?.name}
                thickness={profileThickness}
                width={profileWidth}
                isCalculating={isCalculating}
                progress={progress}
                status={status}
            />

            {/* Чертёж на фоне инженерной сетки */}
            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{
                    height: "clamp(220px, 42vw, 440px)",
                    width: "100%",
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    backgroundImage: `radial-gradient(${alpha(theme.palette.text.primary, 0.12)} 1px, transparent 1px)`,
                    backgroundSize: "16px 16px",
                    backgroundPosition: "8px 8px"
                }}
            >
                {validationError ? (
                    <Box sx={{ maxWidth: 420, px: 2 }}>
                        <Notice type="warn">{validationError}</Notice>
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

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexDirection: "column", width: "100%", borderTop: "1px solid", borderColor: "divider" }}>
                <SectionHeader title="Blank" />
                <Box sx={TILE_GRID_SX}>
                    <ValueTile label="Blank length" value={fixed(blankLength, 2)} unit="mm" emphasis />
                    <ValueTile label="Width" value={isNum(profileWidth) && profileWidth > 0 ? String(profileWidth) : null} unit="mm" />
                    <ValueTile label="Mass" value={fixed(mass, 3)} unit="kg" />
                </Box>

                {machineParams && (
                    <>
                        <SectionHeader title={`Bend ${bendNumber} · machine setup`} />
                        <Box sx={TILE_GRID_SX}>
                            <ValueTile label="Stop position" value={fixed(machineParams.stopPosition, 2)} unit="mm" emphasis />
                            <ValueTile label="Bar lowering" value={fixed(machineParams.barLowering, 2)} unit="mm" />
                            <ValueTile label="Bend angle" value={fixed(machineParams.bendAngle, 1)} unit="°" />
                        </Box>
                    </>
                )}

                <SectionHeader title="Heating" />
                <Box sx={TILE_GRID_SX}>
                    <ValueTile
                        label="Heating time"
                        value={isNum(result2D?.heatingTimeSeconds) ? formatTime(result2D.heatingTimeSeconds) : null}
                        hint={isNum(heatingDeltaT) ? `ΔT ${heatingDeltaT.toFixed(1)} °C` : undefined}
                        tone={status?.type === "error" ? "error" : undefined}
                        emphasis
                    />
                    <ValueTile
                        label="Pause"
                        value={isNum(coolingSeconds) ? `${coolingSeconds}` : null}
                        unit="s"
                        hint={isNum(pauseDeltaT) ? `ΔT ${pauseDeltaT.toFixed(1)} °C` : undefined}
                    />
                    <ValueTile label="Plastic zone" value={fixed(plasticZoneWidth, 1)} unit="mm" />
                    {maxRadius !== null && (
                        <ValueTile label="Max inner radius" value={fixed(maxRadius, 1)} unit="mm" />
                    )}
                </Box>

                {status?.type && status.type !== "ok" && status.message && (
                    <Notice type={status.type}>{status.message}</Notice>
                )}

                <SolverLine metrics={result2D?.technicalMetrics} />

                {charts.length > 0 && (
                    <>
                        <SectionHeader title="Thermal analysis" />
                        <Box sx={{ position: "relative", px: 1.5 }}>
                            {isCalculating && (
                                <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    aria-label="Simulation progress"
                                    sx={{ position: "absolute", top: -6, left: 12, right: 12, height: 2, borderRadius: 1 }}
                                />
                            )}
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 20rem), 1fr))",
                                    gap: 1.25,
                                    opacity: isCalculating && rawData ? 0.55 : 1,
                                    transition: "opacity 0.2s ease"
                                }}
                            >
                                {charts.map(({ key, title, note, chart }) => (
                                    <ChartCard key={key} title={title} note={note}>
                                        <SvgLineChart chart={chart} maxHeight={CHART_HEIGHT} framed={false} />
                                    </ChartCard>
                                ))}
                            </Box>
                        </Box>
                    </>
                )}

                {charts.length === 0 && isCalculating && (
                    <Box sx={{ px: 1.5, pt: 1.5 }}>
                        <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mb: 0.75 }}>
                            2D simulation in progress…
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} aria-label="Simulation progress" sx={{ height: 3, borderRadius: 1 }} />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default BendingPreview;
