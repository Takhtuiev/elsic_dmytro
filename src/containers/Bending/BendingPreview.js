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

const get1DChartsData = (profile, theme, graphsChart1, graphsChart2, showVerticalSlice, showTimeDynamics) => {
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
                color: theme.palette.text.primary, opacity: 0.4, lineWidth: 1,
            },
            {
                name: "Cooling (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.cooldownProfileC, dxMm1D),
                color: theme.palette.text.secondary, opacity: 0.4, lineWidth: 1,
            }
        );
    }

    if (showTimeDynamics && dataSimulate.history) {
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

// ВСТАВЬТЕ ЭТОТ КОД:

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

    // Чтение флагов видимости из переданного объекта симуляции (дефолт true)
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

    //if (isDev && result2D) {console.log("2D Simulation Result:", result2D);}

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

    // Тщательная проверка активности: если оба графика отключены, функция мгновенно завершается
    const chart1And2 = useMemo(() => {
        if (!result2D) return { chart1: null, chart2: null };
        if (!showVerticalSlice && !showTimeDynamics) return { chart1: null, chart2: null };

        const thickness = Number(profile?.thickness || 0);
        const heatingTimeSeconds = Number(result2D.heatingTimeSeconds || 0);

        const graphsChart1 = [];
        const graphsChart2 = [];

        // Передаем флаги видимости внутрь 1D хелпера
        get1DChartsData(profile, theme, graphsChart1, graphsChart2, showVerticalSlice, showTimeDynamics);

        // Расчет вертикального среза выполняется ТОЛЬКО при активности флага
        if (showVerticalSlice && result2D?.temperatureProfile) {
            graphsChart1.push(
                {
                    name: "Heating (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "heating"),
                    color: theme.palette.text.secondary, opacity: 1, lineWidth: 1,
                },
                {
                    name: "Cooling (Vertical Slice)",
                    points: getVerticalSlicePoints(result2D.temperatureProfile, 0, "pause"),
                    color: theme.palette.text.primary, opacity: 1, lineWidth: 1.6,
                }
            );
        }

        // Цикл прохода по истории выполняется ТОЛЬКО при включенной динамике времени
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

                const pt = [t, fC, cC, bC];

                if (t <= heatTime) {
                    heatFront.push([t, fC]);
                    heatCenter.push([t, cC]);
                    heatBack.push([t, bC]);
                    lastHeatPoint = pt;
                } else {
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

            graphsChart2.push(
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

        const chart1 = (showVerticalSlice && graphsChart1.length > 0) ? {
            graphs: graphsChart1,
            axes: {
                x: { unit: "mm", lines: [
                        { value: thickness / 2, color: theme.palette.text.secondary },
                        // Добавлена простая линия без условий:
                        {
                            value: thickness * (profile?.material?.kFactor || 0),
                            color: theme.palette.info.main, // синий цвет из темы
                        }], ranges: [] },
                y: commonYAxis
            }
        } : null;

        const chart2 = (showTimeDynamics && graphsChart2.length > 0) ? {
            graphs: graphsChart2,
            axes: {
                x: { unit: "s", lines: [{ value: heatingTimeSeconds, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        } : null;

        return { chart1, chart2 };
    }, [result2D, commonYAxis, theme, profile, showVerticalSlice, showTimeDynamics]);

    const xTgPauseValue = useMemo(() => {
        if (!result2D?.temperatureProfile) return null;

        const thickness = Number(profile?.thickness || 0);
        const width = Number(profile?.width || 0);
        const glassTransition = Number(profile?.material?.glassTransitionTemp);

        // Извлекаем k-фактор (если его нет, берем 0.5 как дефолтную серединную линию)
        const kFactor = typeof profile?.material?.kFactor === "number"
            ? profile.material.kFactor
            : 0.5;

        if (!Number.isFinite(glassTransition)) return null;

        // Делаем ТОЛЬКО ОДИН срез — строго на заданной глубине k-фактора
        const kFactorPoints = getHorizontalSlicePoints(result2D.temperatureProfile, thickness * kFactor, "pause") || [];

        let xTgPause = null;

        // Идем прямо по точкам этого среза и ищем пересечение температуры
        for (let i = 0; i < kFactorPoints.length - 1; i++) {
            const p1 = kFactorPoints[i];
            const p2 = kFactorPoints[i + 1];

            // Проверяем структуру точек [x, temp]
            if (!p1 || !p2 || p1[0] == null || p1[1] == null || p2[0] == null || p2[1] == null) continue;

            const x1 = p1[0];
            const t1 = p1[1];
            const x2 = p2[0];
            const t2 = p2[1];

            // Ищем, где температура на слое пересекает glassTransition
            if ((t1 >= glassTransition && t2 <= glassTransition) ||
                (t1 <= glassTransition && t2 >= glassTransition)) {

                if (Math.abs(t2 - t1) < 0.001) {
                    xTgPause = x1;
                } else {
                    // Линейная интерполяция координаты X по температурам слоя k-фактора
                    xTgPause = x1 + (glassTransition - t1) * (x2 - x1) / (t2 - t1);
                }
                break; // Нашли первое пересечение — выходим из цикла
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

    // Проверка активности флага showHorizontalWidth на самом старте хука
    const chart3Data = useMemo(() => {
        if (!showHorizontalWidth || !result2D?.temperatureProfile) return null;

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
                    color: theme.palette.error.main, opacity: 0.8, lineWidth: 0.6,
                },
                {
                    name: "Середина листа",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2)),
                    color: theme.palette.success.main, opacity: 0.8, lineWidth: 0.6,
                },
                {
                    name: "Нижняя поверхность",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness)),
                    color: theme.palette.primary.main, opacity: 0.8, lineWidth: 0.6,
                },
                {
                    name: "Верхняя поверхность пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, 0, "pause")),
                    color: theme.palette.error.main, opacity: 1, lineWidth: 1.2,
                },
                {
                    name: "Середина листа пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness / 2, "pause")),
                    color: theme.palette.success.main, opacity: 1, lineWidth: 1.2,
                },
                {
                    name: "Нижняя поверхность пауза",
                    points: makeSymmetric(getHorizontalSlicePoints(result2D.temperatureProfile, thickness, "pause")),
                    color: theme.palette.primary.main, opacity: 1, lineWidth: 1.2,
                }
            ],
            axes: {
                x: { unit: "mm", lines: xLines, ranges: [] },
                y: commonYAxis
            }
        };
    }, [result2D, theme, profile?.thickness, profile?.width, commonYAxis, xTgPauseValue, showHorizontalWidth]);

    // Проверка активности флага showContours2D на самом старте хука
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
                points.push({
                    x: yCoordinatesMm[j],
                    y: xCoordinatesMm[i],
                    temperature: pause[i * Ny + j],
                    position,
                });
            };

            // Нижняя грань: слева направо.
            for (let j = 0; j < Ny; j++) {
                addPoint(0, j, yCoordinatesMm[j]);
            }

            // Правая грань: снизу вверх.
            for (let i = 1; i < Nx; i++) {
                addPoint(i, Ny - 1, maxWidth + xCoordinatesMm[i]);
            }

            // Верхняя грань: справа налево.
            for (let j = Ny - 2; j >= 0; j--) {
                addPoint(
                    Nx - 1,
                    j,
                    maxWidth + maxThickness + maxWidth - yCoordinatesMm[j]
                );
            }

            // Левая грань: сверху вниз, без повторения углов.
            for (let i = Nx - 2; i > 0; i--) {
                addPoint(
                    i,
                    0,
                    2 * maxWidth + maxThickness + maxThickness - xCoordinatesMm[i]
                );
            }

            return points;
        })();

        const findTemperatureIsothermSegments = (targetTemp, T_flat, gridConfig) => {
            if (!Number.isFinite(targetTemp) || !T_flat?.length || !gridConfig) return [];

            const { Nx, Ny, xCoordinatesMm, yCoordinatesMm } = gridConfig;
            if (Nx < 1 || Ny < 2 || T_flat.length < Nx * Ny) return [];

            const maxSemiWidth = yCoordinatesMm[Ny - 1];
            const segmentsRight = [];

            const interpolateCoordinate = (t1, t2, c1, c2, target) => {
                const dt = t2 - t1;
                if (Math.abs(dt) < 0.001) return c1;
                return c1 + (target - t1) * (c2 - c1) / dt;
            };

            const crossesTarget = (t1, t2) =>
                Number.isFinite(t1) &&
                Number.isFinite(t2) &&
                ((t1 <= targetTemp && t2 >= targetTemp) ||
                    (t1 >= targetTemp && t2 <= targetTemp));

            const addPoint = (segment, point) => {
                if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;

                const last = segment[segment.length - 1];
                if (
                    !last ||
                    Math.abs(last[0] - point[0]) > 0.001 ||
                    Math.abs(last[1] - point[1]) > 0.001
                ) {
                    segment.push(point);
                }
            };

            // Ищем пересечение изотермы с границами по толщине.
            // Возвращаем [ширина, толщина] либо null.

            const getEdgePoint = (i1, i2) => {
                if (i1 < 0 || i2 >= Nx) return null;

                const interpolateBoundary = (j) => {
                    const t1 = T_flat[i1 * Ny + j];
                    const t2 = T_flat[i2 * Ny + j];

                    if (!crossesTarget(t1, t2)) return null;

                    const y1 = xCoordinatesMm[i1];
                    const y2 = xCoordinatesMm[i2];

                    return interpolateCoordinate(t1, t2, y1, y2, targetTemp);
                };

                // Сначала проверяем боковую границу.
                const sideY = interpolateBoundary(Ny - 1);
                if (sideY !== null && Number.isFinite(sideY)) {
                    return [maxSemiWidth, sideY];
                }

                // Затем проверяем центральную границу.
                const centerY = interpolateBoundary(0);
                if (centerY !== null && Number.isFinite(centerY)) {
                    return [0, centerY];
                }

                return null;
            };

            const findWidthAtRow = (i) => {
                const offset = i * Ny;

                for (let j = 0; j < Ny - 1; j++) {
                    const t1 = T_flat[offset + j];
                    const t2 = T_flat[offset + j + 1];

                    if (!crossesTarget(t1, t2)) continue;

                    const width = interpolateCoordinate(
                        t1,
                        t2,
                        yCoordinatesMm[j],
                        yCoordinatesMm[j + 1],
                        targetTemp
                    );

                    if (Number.isFinite(width) && width >= 0) return width;
                }

                return null;
            };

            let currentSegment = [];
            let lastValidI = -1;

            const finishSegment = () => {
                if (currentSegment.length > 0) {
                    segmentsRight.push(currentSegment);
                    currentSegment = [];
                }
            };

            for (let i = 0; i < Nx; i++) {
                const width = findWidthAtRow(i);

                // Нет пересечения в этом сечении — завершаем текущий сегмент.
                if (width === null) {
                    if (currentSegment.length > 0) {
                        if (lastValidI >= 0 && lastValidI < Nx - 1) {
                            addPoint(
                                currentSegment,
                                getEdgePoint(lastValidI, lastValidI + 1)
                            );
                        }
                        finishSegment();
                    }

                    lastValidI = -1;
                    continue;
                }

                // Разрыв между соседними сечениями: начинаем новый сегмент.
                if (lastValidI !== i - 1 && currentSegment.length > 0) {
                    finishSegment();
                }

                if (currentSegment.length === 0 && i > 0) {
                    addPoint(currentSegment, getEdgePoint(i - 1, i));
                }

                addPoint(currentSegment, [width, xCoordinatesMm[i]]);
                lastValidI = i;
            }

            // Завершаем последний сегмент.
            if (currentSegment.length > 0) {
                if (lastValidI >= 0 && lastValidI < Nx - 1) {
                    addPoint(
                        currentSegment,
                        getEdgePoint(lastValidI, lastValidI + 1)
                    );
                }

                finishSegment();
            }

            segmentsRight.targetTemp = targetTemp;
            return segmentsRight;
        };

        const buildSymmetricIsothermGraph = (
            segmentsRight,
            nameLabel,
            lineStyle = {},
            gridConfig
        ) => {
            if (!segmentsRight?.length || !gridConfig) return [];

            const { Nx, Ny, xCoordinatesMm, yCoordinatesMm } = gridConfig;
            const maxSemiWidth = yCoordinatesMm[Ny - 1] || 0;
            const baseProps = { showMarker: false, showPoints: false, ...lineStyle };
            const combinedIsothermPoints = [];
            const totalThickness = xCoordinatesMm[Nx - 1] || 0;
            const isolatedRightChain = [];

            const getLeftSideDirect = seg => {
                const EPS = 0.001;
                const bothEndsAtCenter =
                    Math.abs(seg[0][0]) < EPS &&
                    Math.abs(seg[seg.length - 1][0]) < EPS;

                return seg
                    .filter(([x]) => bothEndsAtCenter || Math.abs(x) >= EPS)
                    .map(([x, y]) => [-x, y]);
            };


            segmentsRight.forEach(segRight => {
                const n = segRight.length;
                if (n === 0) return;

                if (n === 1) {
                    const [x, y] = segRight[0];

                    if (combinedIsothermPoints.length > 0) {
                        combinedIsothermPoints.push(null);
                    }

                    if (x > 0.001) {
                        combinedIsothermPoints.push([-x, y]);
                    }

                    combinedIsothermPoints.push([x, y]);
                    return;
                }

                const xStart = segRight[0][0];
                const yStart = segRight[0][1];
                const xEnd = segRight[n - 1][0];
                const yEnd = segRight[n - 1][1];

                const EDGE_EPS = 0.05;
                const isStartOnSurface =
                    Math.abs(yStart) < EDGE_EPS ||
                    Math.abs(yStart - totalThickness) < EDGE_EPS;
                const isEndOnSurface =
                    Math.abs(yEnd - totalThickness) < EDGE_EPS ||
                    Math.abs(yEnd) < EDGE_EPS;
                const isStartOnSideBorder = Math.abs(xStart - maxSemiWidth) < EDGE_EPS;
                const isEndOnSideBorder = Math.abs(xEnd - maxSemiWidth) < EDGE_EPS;

                const isStartOnAnyEdge = (isStartOnSurface || isStartOnSideBorder) && xStart > 0.01;
                const isEndOnAnyEdge = (isEndOnSurface || isEndOnSideBorder) && xEnd > 0.01;

                const centerYStart = segRight.exactCenterYStart;
                const centerYEnd = segRight.exactCenterYEnd;
                const hasCenterStart = centerYStart !== undefined;
                const hasCenterEnd = centerYEnd !== undefined;

                const isIsolatedPocket =
                    (isStartOnAnyEdge && isEndOnAnyEdge) ||
                    (isStartOnAnyEdge && !hasCenterStart && !hasCenterEnd);

                if (isIsolatedPocket) {
                    if (isolatedRightChain.length > 0) isolatedRightChain.push(null);
                    isolatedRightChain.push(...segRight);
                    return;
                }

                const leftSideDirect = getLeftSideDirect(segRight);
                const leftSideReversed = [...leftSideDirect].reverse();
                const rightSideReversed = [...segRight].reverse();

                let branchPoints;

                if (isEndOnAnyEdge && !isStartOnAnyEdge) {
                    branchPoints = [...rightSideReversed, ...leftSideDirect];
                } else if (isStartOnAnyEdge && !isEndOnAnyEdge) {
                    branchPoints = [...leftSideDirect, ...rightSideReversed];
                } else if (!isStartOnAnyEdge && !isEndOnAnyEdge) {
                    branchPoints = [
                        ...segRight,
                        ...leftSideReversed
                    ];
                } else {
                    branchPoints = [...leftSideReversed, ...segRight];
                }

                if (combinedIsothermPoints.length > 0) combinedIsothermPoints.push(null);
                combinedIsothermPoints.push(...branchPoints);
            });


            if (isolatedRightChain.length > 0) {
                const splitSegments = chain => {
                    const segments = [];
                    let segment = [];

                    chain.forEach(point => {
                        if (point === null) {
                            if (segment.length) segments.push(segment);
                            segment = [];
                        } else {
                            segment.push(point);
                        }
                    });

                    if (segment.length) segments.push(segment);
                    return segments;
                };

                const rightSegments = splitSegments(isolatedRightChain);

                rightSegments.forEach(segRight => {
                    const segLeft = segRight
                        .map(([x, y]) => [-x, y])
                        .reverse();

                    const EPS = 0.001;
                    const isCenter = point => Math.abs(point[0]) < EPS;

                    const startsAtCenter = isCenter(segRight[0]);
                    const endsAtCenter = isCenter(segRight[segRight.length - 1]);

                    let branchPoints;

                    if (startsAtCenter) {
                        // Левая сторона приходит к общей точке,
                        // затем продолжаем по правой, не дублируя её.
                        branchPoints = [...segLeft, ...segRight.slice(1)];
                    } else if (endsAtCenter) {
                        // Правая сторона приходит к общей точке,
                        // затем продолжаем по левой, не дублируя её.
                        branchPoints = [...segRight, ...segLeft.slice(1)];
                    } else {
                        // Нет общей точки на оси — стороны не соединяем.
                        branchPoints = [...segLeft, null, ...segRight];
                    }

                    if (combinedIsothermPoints.length > 0) {
                        combinedIsothermPoints.push(null);
                    }

                    combinedIsothermPoints.push(...branchPoints);
                });
            }

            if (combinedIsothermPoints.length === 0) return [];

            return [{
                name: nameLabel,
                points: combinedIsothermPoints,
                ...baseProps
            }];

        };



        const buildIsothermFillPolygons = (fills, boundaryPoints = []) => {
            const EPS = 0.001;

            const splitSegments = segments => {
                if (!Array.isArray(segments)) return [];

                if (
                    segments.length &&
                    Array.isArray(segments[0]) &&
                    Number.isFinite(segments[0][0]) &&
                    Number.isFinite(segments[0][1])
                ) {
                    segments = [segments];
                }

                const result = [];

                segments.forEach(item => {
                    if (!Array.isArray(item)) return;

                    let segment = [];

                    item.forEach(point => {
                        if (
                            !Array.isArray(point) ||
                            !Number.isFinite(point[0]) ||
                            !Number.isFinite(point[1])
                        ) {
                            if (segment.length >= 2) result.push(segment);
                            segment = [];
                        } else {
                            segment.push(point);
                        }
                    });

                    if (segment.length >= 2) result.push(segment);
                });

                return result;
            };

            const samePoint = (a, b) =>
                !!a && !!b &&
                Math.abs(a[0] - b[0]) < EPS &&
                Math.abs(a[1] - b[1]) < EPS;

            const closePolygon = points => {
                const result = [];

                points.forEach(point => {
                    if (
                        point &&
                        Number.isFinite(point[0]) &&
                        Number.isFinite(point[1]) &&
                        (!result.length || !samePoint(result[result.length - 1], point))
                    ) {
                        result.push([...point]);
                    }
                });

                if (result.length < 3) return null;

                if (!samePoint(result[0], result[result.length - 1])) {
                    result.push([...result[0]]);
                }

                return result.length >= 4 ? result : null;
            };

            if (!Array.isArray(boundaryPoints) || boundaryPoints.length < 4) {
                return [];
            }

            const xMin = Math.min(...boundaryPoints.map(p => p.x));
            const xMax = Math.max(...boundaryPoints.map(p => p.x));
            const yMin = Math.min(...boundaryPoints.map(p => p.y));
            const yMax = Math.max(...boundaryPoints.map(p => p.y));

            const width = xMax - xMin;
            const height = yMax - yMin;
            const perimeter = 2 * (width + height);

            if (!(perimeter > 0)) return [];

            // Позиция точки на периметре: верх -> право -> низ -> лево.
            const toPerimeterPosition = point => {
                if (!Array.isArray(point)) return null;

                const [x, y] = point;

                if (Math.abs(y - yMin) < EPS) return x - xMin;

                if (Math.abs(x - xMax) < EPS) {
                    return width + y - yMin;
                }

                if (Math.abs(y - yMax) < EPS) {
                    return width + height + xMax - x;
                }

                if (Math.abs(x - xMin) < EPS) {
                    return 2 * width + height + yMax - y;
                }

                return null;
            };

            const getDirectedDistance = (start, end, direction) => {
                const startPos = toPerimeterPosition(start);
                const endPos = toPerimeterPosition(end);

                if (startPos == null || endPos == null) return null;

                return direction > 0
                    ? (endPos - startPos + perimeter) % perimeter
                    : (startPos - endPos + perimeter) % perimeter;
            };

            const corners = [
                { x: xMin, y: yMin, position: 0 },
                { x: xMax, y: yMin, position: width },
                { x: xMax, y: yMax, position: width + height },
                { x: xMin, y: yMax, position: 2 * width + height },
            ];

            // Универсальный обход периметра до точки или ближайшего кандидата.
            const walkPerimeter = ({
                                       start,
                                       direction,
                                       target = null,
                                       candidates = null,
                                       isExcluded = () => false,
                                   }) => {
                const startPos = toPerimeterPosition(start);
                if (startPos == null) return null;

                let end = target;
                let selected = null;

                if (target == null) {
                    if (!Array.isArray(candidates)) return null;

                    candidates.forEach(candidate => {
                        if (
                            !candidate ||
                            !Array.isArray(candidate.point) ||
                            isExcluded(candidate)
                        ) {
                            return;
                        }

                        const offset = getDirectedDistance(
                            start,
                            candidate.point,
                            direction
                        );

                        if (offset == null || offset < EPS) return;

                        if (!selected || offset < selected.offset) {
                            selected = { ...candidate, offset };
                        }
                    });

                    if (!selected) return null;
                    end = selected.point;
                }

                const endPos = toPerimeterPosition(end);
                if (endPos == null) return null;

                const endOffset = getDirectedDistance(start, end, direction);
                if (endOffset == null) return null;

                const intermediate = corners
                    .map(corner => {
                        const offset = direction > 0
                            ? (corner.position - startPos + perimeter) % perimeter
                            : (startPos - corner.position + perimeter) % perimeter;

                        return { corner, offset };
                    })
                    .filter(({ offset }) =>
                        offset > EPS && offset < endOffset - EPS
                    )
                    .sort((a, b) => a.offset - b.offset)
                    .map(({ corner }) => [corner.x, corner.y]);

                return {
                    ...selected,
                    point: end,
                    path: [start, ...intermediate, end],
                    offset: endOffset,
                };
            };


            // Выбираем направление по температуре на участке периметра,
            // а не по принадлежности сегмента к from или to.
            const getBoundaryDirection = (point, minTemp, maxTemp) => {
                const startPos = toPerimeterPosition(point);

                if (
                    startPos == null ||
                    minTemp > maxTemp
                ) {
                    return null;
                }

                const samples = boundaryPoints
                    .map(p => ({
                        position: toPerimeterPosition([p.x, p.y]),
                        temperature: p.temperature,
                    }))
                    .filter(p =>
                        p.position != null &&
                        Number.isFinite(p.temperature)
                    );

                const inside = temperature =>
                    temperature >= minTemp - EPS &&
                    temperature <= maxTemp + EPS;

                const scoreDirection = direction => {
                    const ordered = samples
                        .map(sample => ({
                            ...sample,
                            distance: direction > 0
                                ? (sample.position - startPos + perimeter) % perimeter
                                : (startPos - sample.position + perimeter) % perimeter,
                        }))
                        .filter(sample => sample.distance > EPS)
                        .sort((a, b) => a.distance - b.distance);

                    if (!ordered.length) return null;

                    // Проверяем температуру на первом участке в выбранном направлении.
                    const first = ordered[0];

                    if (!inside(first.temperature)) return null;

                    // Ищем, сколько последовательных точек остаются в диапазоне.
                    let validDistance = 0;

                    for (const sample of ordered) {
                        if (!inside(sample.temperature)) break;
                        validDistance = sample.distance;
                    }

                    return validDistance;
                };

                const forward = scoreDirection(1);
                const backward = scoreDirection(-1);

                if (forward == null && backward == null) return null;
                if (forward != null && backward == null) return 1;
                if (backward != null && forward == null) return -1;

                return forward >= backward ? 1 : -1;
            };

            const result = [];

            fills.forEach(fill => {
                const fromSegments = splitSegments(fill.fromSegments);
                const toSegments = splitSegments(fill.toSegments);

                if (!fromSegments.length && !toSegments.length) return;

                const minTemp = fill.minTemp ?? -Infinity;
                const maxTemp = fill.maxTemp ?? Infinity;

                const allSegments = [
                    ...fromSegments.map((segment, segmentIndex) => ({
                        graphName: "from",
                        segmentIndex,
                        segment,
                        used: false,
                    })),
                    ...toSegments.map((segment, segmentIndex) => ({
                        graphName: "to",
                        segmentIndex,
                        segment,
                        used: false,
                    })),
                ];

                const addPolygon = points => {
                    const polygon = closePolygon(points);
                    if (!polygon) return;

                    result.push({
                        name: fill.name,
                        points: polygon,
                        color: fill.color,
                        opacity: fill.opacity ?? 0.15,
                    });
                };

                const getEndpoints = () =>
                    allSegments
                        .filter(item => !item.used)
                        .flatMap(item => [
                            {
                                item,
                                endpointIndex: 0,
                                point: item.segment[0],
                            },
                            {
                                item,
                                endpointIndex: item.segment.length - 1,
                                point: item.segment[item.segment.length - 1],
                            },
                        ]);

                // Находим сегмент, чей конец непосредственно соединяется с точкой.
                // Проверяются все сегменты, независимо от from/to.
                const findConnectedEndpoint = (point, excludedItems) =>
                    getEndpoints().find(candidate =>
                        !excludedItems.has(candidate.item) &&
                        samePoint(candidate.point, point)
                    ) ?? null;

                // Основной обход контура.
                allSegments.forEach(initialSegment => {
                    if (initialSegment.used) return;

                    const startPoint = [...initialSegment.segment[0]];
                    const chain = [...initialSegment.segment];
                    const chainSegments = new Set([initialSegment]);

                    let currentItem = initialSegment;
                    let currentEndpoint = [...initialSegment.segment.at(-1)];
                    let closed = false;

                    while (chainSegments.size <= allSegments.length) {
                        // 1. Сначала пробуем продолжить непосредственно от конца сегмента.
                        const connected = findConnectedEndpoint(
                            currentEndpoint,
                            chainSegments
                        );

                        if (connected) {
                            const nextItem = connected.item;
                            const nextSegment = connected.endpointIndex === 0
                                ? nextItem.segment
                                : [...nextItem.segment].reverse();

                            chain.push(...nextSegment.slice(1));
                            chainSegments.add(nextItem);

                            currentItem = nextItem;
                            currentEndpoint = [...nextSegment.at(-1)];

                            // Контур замкнулся через соединение графиков.
                            if (samePoint(currentEndpoint, startPoint)) {
                                closed = true;
                                break;
                            }

                            continue;
                        }

                        // 2. Если конец не на периметре, продолжить нечем.
                        if (toPerimeterPosition(currentEndpoint) == null) {
                            break;
                        }

                        // 3. Выбираем направление по температурному диапазону.
                        const direction = getBoundaryDirection(
                            currentEndpoint,
                            minTemp,
                            maxTemp
                        );

                        if (direction == null) break;

                        const endpoints = getEndpoints()
                            .filter(candidate =>
                                !chainSegments.has(candidate.item) &&
                                toPerimeterPosition(candidate.point) != null
                            )
                            .map(candidate => ({
                                ...candidate,
                                segment: candidate.item.segment,
                            }));

                        // Стартовая точка тоже является кандидатом для замыкания.
                        const closureCandidate = {
                            item: initialSegment,
                            endpointIndex: 0,
                            point: startPoint,
                            segment: initialSegment.segment,
                            isClosure: true,
                        };

                        const next = walkPerimeter({
                            start: currentEndpoint,
                            direction,
                            candidates: [...endpoints, closureCandidate],
                            isExcluded: candidate =>
                                candidate.point &&
                                samePoint(candidate.point, currentEndpoint),
                        });

                        if (!next) break;

                        chain.push(...next.path.slice(1));

                        // 4. Если дошли до начальной точки, контур замкнут.
                        if (
                            next.isClosure ||
                            samePoint(next.point, startPoint)
                        ) {
                            closed = true;
                            break;
                        }

                        // 5. Переходим на найденный сегмент и продолжаем от его конца.
                        const nextItem = next.item;

                        if (!nextItem || chainSegments.has(nextItem)) break;

                        const nextSegment = next.endpointIndex === 0
                            ? nextItem.segment
                            : [...nextItem.segment].reverse();

                        // Точка на периметре уже добавлена через next.path.
                        // Пропускаем повтор первого узла сегмента.
                        chain.push(...nextSegment.slice(1));
                        chainSegments.add(nextItem);

                        currentItem = nextItem;
                        currentEndpoint = [...nextSegment.at(-1)];

                        if (samePoint(currentEndpoint, startPoint)) {
                            closed = true;
                            break;
                        }
                    }

                    if (closed) {
                        addPolygon(chain);
                        chainSegments.forEach(item => {
                            item.used = true;
                        });
                    } else {
                        // Не оставляем сегменты бесконечно доступными для повторного обхода.
                        initialSegment.used = true;
                    }
                });
            });

            return result;
        };
        // 1. Находим сегменты изотерм правой половины
        const tgHeatingSegments = findTemperatureIsothermSegments(Tg, heating, gridConfig);
        const tminHeatingSegments = findTemperatureIsothermSegments(Tmin, heating, gridConfig);
        const tmaxHeatingSegments = findTemperatureIsothermSegments(Tmax, heating, gridConfig);
        const tdecompHeatingSegments = findTemperatureIsothermSegments(Tdecomp, heating, gridConfig);

        const tgPauseSegments = findTemperatureIsothermSegments(Tg, pause, gridConfig);
        const tminPauseSegments = findTemperatureIsothermSegments(Tmin, pause, gridConfig);
        const tmaxPauseSegments = findTemperatureIsothermSegments(Tmax, pause, gridConfig);
        const tdecompPauseSegments = findTemperatureIsothermSegments(Tdecomp, pause, gridConfig);


// 2. Строим симметричные графики из найденных сегментов
        const graphs = [
            ...buildSymmetricIsothermGraph(tgHeatingSegments, "Tg Heating", {
                color: theme.palette.warning.main, lineWidth: 0.7, opacity: 0.7
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tminHeatingSegments, "T min Heating", {
                color: theme.palette.success.main, lineWidth: 0.7, opacity: 0.7
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tmaxHeatingSegments, "T max Heating", {
                color: theme.palette.success.main, lineWidth: 0.7, opacity: 0.7
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tdecompHeatingSegments, "Decomposition Heating", {
                color: theme.palette.error.main, lineWidth: 0.7, opacity: 1
            }, gridConfig),

            ...buildSymmetricIsothermGraph(tgPauseSegments, "Tg Pause", {
                color: theme.palette.warning.dark, lineWidth: 1.6, opacity: 0.7
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tminPauseSegments, "T min Pause", {
                color: theme.palette.success.dark, lineWidth: 1.6
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tmaxPauseSegments, "T max Pause", {
                color: theme.palette.success.main, lineWidth: 1.6
            }, gridConfig),
            ...buildSymmetricIsothermGraph(tdecompPauseSegments, "Decomposition Pause", {
                color: theme.palette.error.dark, lineWidth: 1.6
            }, gridConfig)
        ];

        const fillPolygons = buildIsothermFillPolygons(
            [
                {
                    name: "Solid Plastic — Pause",
                    fromSegments: null,
                    toSegments: tgPauseSegments,
                    minTemp: -Infinity,
                    maxTemp: Tg,
                    color: theme.palette.info.main,
                    opacity: 0.08,
                },
                {
                    name: "High Elastic — Pause",
                    fromSegments: tgPauseSegments,
                    toSegments: tminPauseSegments,
                    minTemp: Tg,
                    maxTemp: Tmin,
                    color: theme.palette.success.main,
                    opacity: 0.05,
                },
                {
                    name: "Optimal Bending — Pause",
                    fromSegments: tminPauseSegments,
                    toSegments: tmaxPauseSegments,
                    minTemp: Tmin,
                    maxTemp: Tmax,
                    color: theme.palette.success.main,
                    opacity: 0.15,
                },
                {
                    name: "High Temperature — Pause",
                    fromSegments: tmaxPauseSegments,
                    toSegments: tdecompPauseSegments,
                    minTemp: Tmax,
                    maxTemp: Tdecomp,
                    color: theme.palette.warning.main,
                    opacity: 0.1,
                },
                {
                    name: "Decomposition Risk — Pause",
                    fromSegments: tdecompPauseSegments,
                    toSegments: null,
                    minTemp: Tdecomp,
                    maxTemp: Infinity,
                    color: theme.palette.error.main,
                    opacity: 0.3,
                },
            ],
            boundaryPoints
        );

        console.log("fillPolygons", fillPolygons)

        const xLines = [{ value: 0, color: theme.palette.text.secondary, label: "Центр" }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(theme.palette.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(theme.palette.divider, 0.25) });
            }
        }

// Находим максимальную длину по оси X из существующих графиков (например, толщину профиля)

        return {
            graphs: graphs,
            axes: {
                x: { unit: "mm", lines: xLines, ranges: [] },
                y: {
                    unit: "mm", min: thickness, max: 0,
                    lines: [
                        { value: 0, color: theme.palette.text.primary, label: "Верх" },
                        { value: thickness / 2, color: alpha(theme.palette.divider, 0.3) },
                        { value: thickness, color: theme.palette.text.primary, label: "Низ" },
                        {
                            value: thickness * (profile?.material?.kFactor || 0),
                            color: theme.palette.info.main, // синий цвет из темы
                        }
                    ],
                    ranges: []
                }
            },

            fillPolygons: fillPolygons
        };

    }, [result2D, theme, profile?.thickness, profile?.width, profile?.material, showContours2D]);

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

                <Box sx={{ display: "flex", flexWrap: "wrap", mx: "auto", gap: 1 }}>
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
            </Box>
        </Box>
    );
};

export default BendingPreview;
