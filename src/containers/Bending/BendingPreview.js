import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./SvgLineChart";
import { getHorizontalSlicePoints, getVerticalSlicePoints, simulate2DHeating } from "./heating2DModel";

// ============================================================================
// !!! БЛОК 1D СИМУЛЯЦИИ (ДЛЯ УДАЛЕНИЯ) !!!
// ============================================================================
import { simulate1DHeating } from "./pvc-1d-transient-heating";

const isDev = process.env.REACT_APP_DEVELOPMENT === 'true';

// Хелпер для быстрой сборки точек графика
const getChartPoints = (valuesArray, step, xOffset = 0) => {
    return Array.from(valuesArray || [], (value, index) => [
        xOffset + index * step,
        Number(value)
    ]);
};

const get1DChartsData = (profile, theme, graphsChart1, graphsChart2) => {
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

    if (dataSimulate.temperatureProfile) {
        const dxMm1D = dataSimulate.temperatureProfile.dxMm || 0;
        graphsChart1.push(
            {
                name: "Heating (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.temperaturesC, dxMm1D),
                color: theme.palette.text.primary, opacity: 0.4, lineWidth: 1,
            },
            {
                name: "Cooling (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.cooldownProfileC, dxMm1D),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1,
            }
        );
    }

    if (dataSimulate.history) {
        const { history: hist1D, heatingTimeSeconds: heatTime1D } = dataSimulate;
        const heatHist = hist1D?.heating;
        const coolHist = hist1D?.cooling;
        const heatStep = heatHist?.stepSeconds || 0;
        const coolStep = coolHist?.stepSeconds || heatStep || 0;

        // --- Графики НАГРЕВА (Heating) ---
        graphsChart2.push(
            {
                name: "Front Surface (1D) - Heating",
                points: getChartPoints(heatHist?.frontSurfaceC, heatStep),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Center (1D) - Heating",
                points: getChartPoints(heatHist?.centerC, heatStep),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Back Surface (1D) - Heating",
                points: getChartPoints(heatHist?.backSurfaceC, heatStep),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            }
        );

        // --- Графики ОХЛАЖДЕНИЯ (Cooling) ---
        // Передаем Number(heatTime1D) как смещение начала координат по оси X (времени)
        graphsChart2.push(
            {
                name: "Front Surface (1D) - Cooling",
                points: getChartPoints(coolHist?.frontSurfaceC, coolStep, Number(heatTime1D)),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Center (1D) - Cooling",
                points: getChartPoints(coolHist?.centerC, coolStep, Number(heatTime1D)),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Back Surface (1D) - Cooling",
                points: getChartPoints(coolHist?.backSurfaceC, coolStep, Number(heatTime1D)),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1, showMarker: false,
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

        const temperatures = points
            .map(p => Number(p?.[1]))
            .filter(Number.isFinite);

        if (!temperatures.length) return null;

        return Math.max(...temperatures) - Math.min(...temperatures);
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

    const validationError = useMemo(() => validateProfile(profile), [profile]);
    const view = profile?.view;

    useEffect(() => {
        let animationFrameId;
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries || !entries.length) return;
            const { width, height } = entries[0].contentRect;

            // Предотвращаем избыточные рендеры с помощью requestAnimationFrame
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

    const result2D = useMemo(() => {
        if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
            return null;
        }

        return simulate2DHeating({
            thicknessMm: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation,
            storeHistory: profile.simulation?.recordHistory ?? false
        });
    }, [profile?.thickness, profile?.material, profile?.machine, profile?.simulation]);

    if (isDev && result2D) {
        console.log("2D Simulation Result:", result2D);
    }

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

    const commonYAxis = useMemo(() => {
        const glassTransition = Number(profile?.material?.glassTransitionTemp);
        const decomposition = Number(profile?.material?.decompositionTemp);

        return {
            unit: "°",
            lines: [
                { value: glassTransition, color: theme.palette.warning.main },
                { value: decomposition, color: theme.palette.error.main }
            ],
            ranges: [
                { from: Number(profile?.material?.minFormingTemp), to: Number(profile?.material?.maxFormingTemp), color: theme.palette.success.main }
            ]
        };
    }, [profile?.material, theme]);

    const chart1And2 = useMemo(() => {
        if (!result2D) return { chart1: null, chart2: null };

        const thickness = Number(profile?.thickness || 0);
        const heatingTimeSeconds = Number(result2D.heatingTimeSeconds || 0);

        const graphsChart1 = [];
        const graphsChart2 = [];

        // Вызов 1D симуляции
        get1DChartsData(profile, theme, graphsChart1, graphsChart2);

        if (result2D?.temperatureProfile) {
            graphsChart1.push(
                {
                    name: "Heating (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "heating"),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 1.5,
                },
                {
                    name: "Cooling (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "pause"),
                    color: theme.palette.text.secondary, opacity: 1, lineWidth: 1,
                }
            );
        }

        if (result2D?.history) {
            const { history: hist2D } = result2D;
            const times = hist2D.time || [];
            const heatTime = Number(result2D?.heatingTimeSeconds || 0);

// Инициализируем плоские массивы под каждую кривую
            const heatFront = [], heatCenter = [], heatBack = [];
            const coolFront = [], coolCenter = [], coolBack = [];

            let lastHeatPoint = null;

// Одиночный цикл вместо раздельных проходов итератора
            for (let i = 0; i < times.length; i++) {
                const t = times[i];
                const fC = Number(hist2D.frontSurfaceC[i]);
                const cC = Number(hist2D.centerC[i]);
                const bC = Number(hist2D.backSurfaceC[i]);

                const pt = [t, fC, cC, bC];

                if (t <= heatTime) {
                    heatFront.push([t, fC]);
                    heatCenter.push([t, cC]);
                    heatBack.push([t, bC]);
                    lastHeatPoint = pt; // Запоминаем финальную точку нагрева
                } else {
                    // Если это первый шаг охлаждения, бесшовно добавляем стыковочную точку
                    if (coolFront.length === 0 && lastHeatPoint !== null) {
                        const [lt, lf, lc, lb] = lastHeatPoint;
                        coolFront.push([lt, lf]);
                        coolCenter.push([lt, lc]);
                        coolBack.push([lt, lb]);
                    }
                    coolFront.push([t, fC]);
                    coolCenter.push([t, cC]);
                    coolBack.push([t, bC]);
                }
            }

// За один вызов пушим готовые структуры в конфигурацию графика
            graphsChart2.push(
                // --- Нагрев (Heating) ---
                {
                    name: "Front Surface (2D) - Heating", points: heatFront,
                    color: theme.palette.error.main, opacity: 1, lineWidth: 1, showMarker: false,
                },
                {
                    name: "Center (2D) - Heating", points: heatCenter,
                    color: theme.palette.success.main, opacity: 1, lineWidth: 1, showMarker: false,
                },
                {
                    name: "Back Surface (2D) - Heating", points: heatBack,
                    color: theme.palette.primary.main, opacity: 1, lineWidth: 1, showMarker: false,
                },
                // --- Охлаждение (Cooling) ---
                {
                    name: "Front Surface (2D) - Cooling", points: coolFront,
                    color: theme.palette.error.main, opacity: 1, lineWidth: 1, showMarker: true,
                },
                {
                    name: "Center (2D) - Cooling", points: coolCenter,
                    color: theme.palette.success.main, opacity: 1, lineWidth: 1, showMarker: true,
                },
                {
                    name: "Back Surface (2D) - Cooling", points: coolBack,
                    color: theme.palette.primary.main, opacity: 1, lineWidth: 1, showMarker: true,
                }
            );
        }

        const chart1 = {
            graphs: graphsChart1,
            axes: {
                x: { unit: "mm", lines: [{ value: thickness / 2, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        };

        const chart2 = graphsChart2.length > 0 ? {
            graphs: graphsChart2,
            axes: {
                x: { unit: "s", lines: [{ value: heatingTimeSeconds, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        } : null;

        return { chart1, chart2 };
    }, [result2D, commonYAxis, theme, profile]);

    const xTgPauseValue = useMemo(() => {
        if (!result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);
        const glassTransition = Number(profile?.material?.glassTransitionTemp);

        if (!Number.isFinite(glassTransition)) return null;

        const topPoints = getHorizontalSlicePoints(result2D.temperatureProfile, 0, "pause") || [];
        const midPoints = getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2, "pause") || [];
        const bottomPoints = getHorizontalSlicePoints(result2D.temperatureProfile, thickness, "pause") || [];

        const minTempsAtX = [];
        for (let i = 0; i < topPoints.length; i++) {
            if (!topPoints[i]) continue;
            const x = topPoints[i][0];
            const tTop = topPoints[i][1];

            const tMid = midPoints.find(p => p && Math.abs(p[0] - x) < 0.01)?.[1] ?? tTop;
            const tBot = bottomPoints.find(p => p && Math.abs(p[0] - x) < 0.01)?.[1] ?? tTop;

            const minT = Math.min(tTop, tMid, tBot);
            minTempsAtX.push({ x, minT });
        }

        let xTgPause = null;
        for (let i = 0; i < minTempsAtX.length - 1; i++) {
            const p1 = minTempsAtX[i];
            const p2 = minTempsAtX[i + 1];

            if ((p1.minT >= glassTransition && p2.minT <= glassTransition) ||
                (p1.minT <= glassTransition && p2.minT >= glassTransition)) {

                if (Math.abs(p2.minT - p1.minT) < 0.001) {
                    xTgPause = p1.x;
                } else {
                    xTgPause = p1.x + (glassTransition - p1.minT) * (p2.x - p1.x) / (p2.minT - p1.minT);
                }
                break;
            }
        }

        return (xTgPause !== null && xTgPause <= width / 2) ? xTgPause : null;
    }, [result2D, profile?.thickness, profile?.width, profile?.material?.glassTransitionTemp]);

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
        if (!result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);

        const makeSymmetric = (points) => {
            if (!points || !points.length) return [];
            const leftSide = points
                .filter(p => p && p[0] > 0)
                .map(p => [-p[0], p[1]]);
            const leftSideReversed = [...leftSide].reverse();
            return [...leftSideReversed, ...points];
        };

        const xLines = [{ value: 0, color: theme.palette.text.secondary }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(theme.palette.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(theme.palette.divider, 0.25) });
            }
        }

        if (xTgPauseValue !== null) {
            xLines.push({
                value: xTgPauseValue,
                color: theme.palette.warning.main,
                lineWidth: 1.5,
                dashArray: "4 4",
                label: `Гибочная зона (${(xTgPauseValue * 2).toFixed(1)} мм)`
            });
            xLines.push({
                value: -xTgPauseValue,
                color: theme.palette.warning.main,
                lineWidth: 1.5,
                dashArray: "4 4"
            });
        }

        return {
            graphs: [
                {
                    name: "Верхняя поверхность",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, 0)),
                    color: theme.palette.error.main, opacity: 1, lineWidth: 1.2,
                },
                {
                    name: "Середина листа",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2)),
                    color: theme.palette.success.main, opacity: 1, lineWidth: 1.2,
                },
                {
                    name: "Нижняя поверхность",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness)),
                    color: theme.palette.primary.main, opacity: 1, lineWidth: 1.2,
                },
                {
                    name: "Верхняя поверхность пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, 0, "pause")),
                    color: theme.palette.error.main, opacity: 0.7, lineWidth: 0.6,
                },
                {
                    name: "Середина листа пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2, "pause")),
                    color: theme.palette.success.main, opacity: 0.7, lineWidth: 0.6,
                },
                {
                    name: "Нижняя поверхность пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness, "pause")),
                    color: theme.palette.primary.main, opacity: 0.7, lineWidth: 0.6,
                }
            ],
            axes: {
                x: { unit: "mm", lines: xLines, ranges: [] },
                y: commonYAxis
            }
        };
    }, [result2D, theme, profile?.thickness, profile?.width, commonYAxis, xTgPauseValue]);

    const chartContourData = useMemo(() => {
        if (!result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);

        const Tg = Number(profile?.material?.glassTransitionTemp);
        const Tmin = Number(profile?.material?.minFormingTemp);
        const Tmax = Number(profile?.material?.maxFormingTemp);

        const profileData = result2D.temperatureProfile;
        const { xCoordinatesMm, yCoordinatesMm, Nx, Ny, heating, pause } = profileData;
        const gridConfig = { Nx, Ny, xCoordinatesMm, yCoordinatesMm };

// ==========================================
// ЕДИНАЯ УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ИНТЕРПОЛЯЦИИ
// ==========================================

        /**
         * Вычисляет координату точки пересечения target между двумя узлами.
         * t1, t2 — температуры в узлах
         * c1, c2 — физические координаты этих узлов (в мм по ширине или толщине)
         */
        const interpolateCoordinate = (t1, t2, c1, c2, target) => {
            if (Math.abs(t2 - t1) >= 0.001) {
                return c1 + (target - t1) * (c2 - c1) / (t2 - t1);
            }
            return c1;
        };


// ==========================================
// ОСНОВНАЯ ФУНКЦИЯ РАСЧЕТА ИЗОТЕРМЫ
// ==========================================

        const addTemperatureIsotherm = (targetTemp, T_flat, gridConfig, nameLabel, lineStyle = {}) => {
            if (!Number.isFinite(targetTemp) || !T_flat?.length || !gridConfig) return [];

            const { Nx, Ny, xCoordinatesMm, yCoordinatesMm } = gridConfig;

            // Хелпер для точной интерполяции координаты Y на оси симметрии X=0
            const getCenterY = (i1, i2) => {
                const idx1 = Math.max(0, Math.min(i1, Nx - 1));
                const idx2 = Math.max(0, Math.min(i2, Nx - 1));

                return interpolateCoordinate(
                    T_flat[idx1 * Ny],
                    T_flat[idx2 * Ny],
                    xCoordinatesMm[idx1],
                    xCoordinatesMm[idx2],
                    targetTemp
                );
            };

            // Хелпер для зеркалирования правого крыла (исключаем точки на оси X = 0, чтобы избежать дублирования)
            const getLeftSideDirect = (seg) => {
                return seg
                    .filter(([x]) => x > 0.001)
                    .map(([x, y]) => [-x, y]);
            };

            const segmentsRight = [];
            let currentSegment = [];
            let lastValidI = -2;

            // --- 1. Сбор правого крыла изотермы по слоям сетки ---
            for (let i = 0; i < Nx; i++) {
                const thicknessMm = xCoordinatesMm[i];
                const rowOffset = i * Ny;
                let interpolatedWidthMm = null;

                for (let j = 0; j < Ny - 1; j++) {
                    const t1 = T_flat[rowOffset + j];
                    const t2 = T_flat[rowOffset + j + 1];

                    if ((t1 >= targetTemp && t2 <= targetTemp) || (t1 <= targetTemp && t2 >= targetTemp)) {
                        const w1 = yCoordinatesMm[j];
                        const w2 = yCoordinatesMm[j + 1];
                        const wMm = interpolateCoordinate(t1, t2, w1, w2, targetTemp);

                        if (wMm >= 0) {
                            interpolatedWidthMm = wMm;
                            break; // Нашли первое пересечение в слое — выходим
                        }
                    }
                }

                if (interpolatedWidthMm !== null) {
                    // Обнаружен разрыв между сегментами
                    if (i !== lastValidI + 1 && currentSegment.length > 0) {
                        currentSegment.exactCenterYEnd = getCenterY(lastValidI, lastValidI + 1);
                        segmentsRight.push(currentSegment);

                        currentSegment = [];
                        currentSegment.exactCenterYStart = getCenterY(i - 1, i);
                    }
                    // Изотерма началась не с первого слоя плиты
                    else if (currentSegment.length === 0) {
                        currentSegment.exactCenterYStart = i > 0 ? getCenterY(i - 1, i) : getCenterY(0, 0);
                    }

                    currentSegment.push([interpolatedWidthMm, thicknessMm]);
                    lastValidI = i;
                }
            }

            // Сохраняем последний активный сегмент
            if (currentSegment.length > 0) {
                currentSegment.exactCenterYEnd = lastValidI < Nx - 1 ? getCenterY(lastValidI, lastValidI + 1) : getCenterY(Nx - 1, Nx - 1);
                segmentsRight.push(currentSegment);
            }

            if (segmentsRight.length === 0) return [];

            // --- 2. Настройка стилей графика ---
            const baseProps = {
                showMarker: false,
                showPoints: false,
                ...lineStyle
            };

            const resultGraphs = [];

            // --- 3. Зеркалирование и сшивание контуров ---
            const totalThickness = xCoordinatesMm[Nx - 1] || 0;

            segmentsRight.forEach((segRight, segIdx) => {
                const n = segRight.length;

                // Случай 1: Изотерма сквозная по всей толщине плиты (быстрый путь)
                if (n === Nx) {
                    const leftSide = getLeftSideDirect(segRight);
                    resultGraphs.push(
                        { name: `${nameLabel} (Лев)`, points: leftSide, ...baseProps },
                        { name: `${nameLabel} (Прав)`, points: segRight, ...baseProps }
                    );
                    return;
                }

                // Случай 2: Точечный сегмент (одиночный узел сетки)
                if (n === 1) {
                    const [x, y] = segRight[0];
                    resultGraphs.push({
                        name: `${nameLabel}${segmentsRight.length > 1 ? ` Зона \${segIdx + 1}` : ""}`,
                        points: x > 0.001 ? [[-x, y], [0, y], [x, y]] : [[0, y]],
                        ...baseProps
                    });
                    return;
                }

                // Случай 3: Сложные геометрические капы (овалы, полукруги)
                const yStart = segRight[0][1];
                const yEnd = segRight[n - 1][1];

                const isStartOnSurface = Math.abs(yStart) < 0.001 || Math.abs(yStart - totalThickness) < 0.001;
                const isEndOnSurface = Math.abs(yEnd - totalThickness) < 0.001 || Math.abs(yEnd) < 0.001;

                const centerYStart = segRight.exactCenterYStart;
                const centerYEnd = segRight.exactCenterYEnd;

                // Формируем чистые левые массивы без дублирования точек оси X=0
                const leftSideDirect = getLeftSideDirect(segRight);
                const leftSideReversed = [...leftSideDirect].reverse();

                let smoothCapPoints;

                if (isEndOnSurface && !isStartOnSurface) {
                    // Конец на поверхности, старт внутри (замыкание через точный centerYStart)
                    smoothCapPoints = [...leftSideReversed, [0, centerYStart], ...segRight];
                }
                else if (isStartOnSurface && !isEndOnSurface) {
                    // Старт на поверхности, конец внутри (замыкание через точный centerYEnd)
                    const rightSideReversed = [...segRight].reverse();
                    smoothCapPoints = [...leftSideDirect, [0, centerYEnd], ...rightSideReversed];
                }
                else if (!isStartOnSurface && !isEndOnSurface) {
                    // Полностью изолированный овал (замкнутый контур с обоих концов)
                    smoothCapPoints = [[0, centerYStart], ...segRight, [0, centerYEnd], ...leftSideReversed, [0, centerYStart]];
                }
                else {
                    // Касается обеих поверхностей плиты (разрезанный пополам объект)
                    smoothCapPoints = [...leftSideReversed, ...segRight];
                }

                const segmentIdStr = segmentsRight.length > 1 ? ` Зона ${segIdx + 1}` : "";
                resultGraphs.push({
                    name: `${nameLabel}${segmentIdStr}`,
                    points: smoothCapPoints,
                    ...baseProps
                });
            });

            return resultGraphs;
        };

        const graphs = [
            // --- Нагрев ---
            ...addTemperatureIsotherm(Tg, heating, gridConfig, "Tg Нагрев", {
                color: theme.palette.warning.main, lineWidth: 1.6
            }),
            ...addTemperatureIsotherm(Tmin, heating, gridConfig, "T min Нагрев", {
                color: theme.palette.success.main, lineWidth: 1.6
            }),
            ...addTemperatureIsotherm(Tmax, heating, gridConfig, "T max Нагрев", {
                color: theme.palette.success.main, lineWidth: 1.6
            }),

            // --- Пауза ---
            ...addTemperatureIsotherm(Tg, pause, gridConfig, "Tg Пауза", {
                color: theme.palette.warning.dark, lineWidth: 1.0, opacity: 0.7
            }),
            ...addTemperatureIsotherm(Tmin, pause, gridConfig, "T min Пауза", {
                color: theme.palette.success.dark, lineWidth: 1.0, opacity: 0.7
            }),
            ...addTemperatureIsotherm(Tmax, pause, gridConfig, "T max Пауза", {
                color: theme.palette.success.main, lineWidth: 1.0, opacity: 0.7
            })
        ];

        const xLines = [{ value: 0, color: theme.palette.text.secondary, label: "Центр" }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(theme.palette.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(theme.palette.divider, 0.25) });
            }
        }

        return {
            graphs,
            axes: {
                x: { unit: "mm",
                    lines: xLines,
                    ranges: [],
                    // Передаем границы по ширине: от левого края (-полуширина) до правого (+полуширина)
                },
                y: {
                    unit: "mm",
                    // Передаем границы по толщине листа: от 0 до полной толщины
                    min: 0,
                    max: thickness,
                    lines: [
                        { value: 0, color: theme.palette.text.primary, label: "Верх" },
                        { value: thickness / 2, color: alpha(theme.palette.divider, 0.3) },
                        { value: thickness, color: theme.palette.text.primary, label: "Низ" }
                    ],
                    ranges: []
                }
            }
        };
    }, [result2D, theme, profile?.thickness, profile?.width, profile?.material]);

    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader profile={profile} />

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
                    overflow: "hidden"
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

            <Box className="bend-preview-bottom" sx={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", width: "100%", flexShrink: 0, gap: 1 }}>
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

                {(chart1And2?.chart1 || chart3Data || chart1And2?.chart2) && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", mx: "auto", gap: 1 }}>
                        {chart1And2?.chart1 && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart1And2.chart1} />
                            </Box>
                        )}

                        {chart3Data && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart3Data} />
                            </Box>
                        )}

                        {chart1And2?.chart2 && (
                            <Box mx="auto">
                                <SvgLineChart chart={chart1And2.chart2} />
                            </Box>
                        )}

                        {chartContourData && (
                            <Box mx="auto">
                                <SvgLineChart chart={chartContourData} />
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default BendingPreview;
