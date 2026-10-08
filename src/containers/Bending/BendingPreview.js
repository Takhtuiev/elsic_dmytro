import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";
import SvgLineChart from "./SvgLineChart";
import {getHorizontalSlicePoints, getVerticalSlicePoints, simulate2DHeating} from "./heating2DModel";

// ============================================================================
// !!! БЛОК 1D СИМУЛЯЦИИ (ДЛЯ УДАЛЕНИЯ) !!!
// Когда 1D больше не понадобится, полностью удалите этот блок до следующей метки.
// ============================================================================
import { simulate1DHeating } from "./pvc-1d-transient-heating";

const isDev = process.env.REACT_APP_DEVELOPMENT === 'true';

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

    // Наполнение CHART 1 данными 1D
    if (dataSimulate.temperatureProfile) {
        const dxMm1D = dataSimulate.temperatureProfile.dxMm || 0;
        graphsChart1.push(
            {
                name: "Heating (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.temperaturesC, dxMm1D),
                color: theme.palette.dividers, opacity: 0.4, lineWidth: 1,
            },
            {
                name: "Cooling (1D)",
                points: getChartPoints(dataSimulate.temperatureProfile?.cooldownProfileC, dxMm1D),
                color: theme.palette.dividers, opacity: 0.4, lineWidth: 1,
            }
        );
    }

    // Наполнение CHART 2 данными 1D
    if (dataSimulate.history) {
        const { history: hist1D, heatingTimeSeconds: heatTime1D } = dataSimulate;
        const heatHist = hist1D?.heating;
        const coolHist = hist1D?.cooling;
        const heatStep = heatHist?.stepSeconds || 0;
        const coolStep = coolHist?.stepSeconds || heatStep || 0;

        graphsChart2.push(
            {
                name: "Front Surface (1D)",
                points: getChartPoints(heatHist?.frontSurfaceC, heatStep)
                    .concat(getChartPoints(coolHist?.frontSurfaceC, coolStep, Number(heatTime1D))),
                color: theme.palette.dividers, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Center (1D)",
                points: getChartPoints(heatHist?.centerC, heatStep)
                    .concat(getChartPoints(coolHist?.centerC, coolStep, Number(heatTime1D))),
                color: theme.palette.dividers, opacity: 0.4, lineWidth: 1, showMarker: false,
            },
            {
                name: "Back Surface (1D)",
                points: getChartPoints(heatHist?.backSurfaceC, heatStep)
                    .concat(getChartPoints(coolHist?.backSurfaceC, coolStep, Number(heatTime1D))),
                color: theme.palette.dividers, opacity: 0.4, lineWidth: 1, showMarker: false,
            }
        );
    }
};
// ============================================================================
// !!! КОНЕЦ БЛОКА 1D СИМУЛЯЦИИ !!!
// ============================================================================


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

// Мемоизированные параметры.
const Parameters = React.memo(({ profile, part, machineParams, data, plasticZoneWidth, maxRadius }) => {
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

    // Новая логика: передаем профиль температур и фазу, извлекаем срез y=0
    const getDeltaTForVerticalSlice = useCallback((temperatureProfile, phase) => {
        if (!temperatureProfile) return null;

        const points = getVerticalSlicePoints(temperatureProfile, 0, phase);
        if (!points || !points.length) return null;

        const temperatures = points
            .map(p => Number(p?.[1]))
            .filter(Number.isFinite);

        if (!temperatures.length) return null;

        return Math.max(...temperatures) - Math.min(...temperatures);
    }, []);

    // Считаем дельту строго в срезе y=0 для обеих фаз
    const heatingDeltaT = useMemo(() =>
            getDeltaTForVerticalSlice(data?.temperatureProfile, "heating"),
        [data?.temperatureProfile, getDeltaTForVerticalSlice]
    );

    const pauseDeltaT = useMemo(() =>
            getDeltaTForVerticalSlice(data?.temperatureProfile, "pause"),
        [data?.temperatureProfile, getDeltaTForVerticalSlice]
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
                Heating: <strong>{formatTime(data?.heatingTimeSeconds)}</strong> (ΔT = {heatingDeltaT !== null ? heatingDeltaT.toFixed(1) : "—"}°C)
                {Number.isFinite(Number(data?.coolingTimeSeconds)) && (
                    <>
                        , Pause: <strong>{formatTime(data.coolingTimeSeconds)}</strong> (ΔT = {pauseDeltaT !== null ? pauseDeltaT.toFixed(1) : "—"}°C)
                    </>
                )}
            </Typography>

            {maxRadius !== null &&  plasticZoneWidth !== null && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                    Plastic zone width (pause): <strong>{`${plasticZoneWidth.toFixed(1)} mm`}</strong>
                </Typography>
                    <Typography variant="body2" color={PARAMETER_TEXT_COLOR} fontSize={PARAMETER_TEXT_SIZE}>
                        Max internal radius: <strong>{maxRadius > 0 ? `${maxRadius.toFixed(1)} mm` : "0.0 mm"}</strong>
                    </Typography>
            </Box>
            )}

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


    if (isDev) {
        console.log(result2D);
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

    // Общие настройки осей Y
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


// =================================================================
// 1. ХУК ДЛЯ ГРАФИКОВ ПО МОДЕЛЯМ (Толщина и Динамика Времени)
// =================================================================
    const chart1And2 = useMemo(() => {
        if (!result2D) return { chart1: null, chart2: null };

        const thickness = Number(profile?.thickness || 0);
        const heatingTimeSeconds = Number(result2D.heatingTimeSeconds || 0);

        const graphsChart1 = [];
        const graphsChart2 = [];

        // ---------------------------------------------------------
        // Вызов 1D симуляции для графиков (КОГДА БУДЕТЕ УДАЛЯТЬ 1D — СТЕРЕТЬ ЭТУ СТРОКУ)
        // ---------------------------------------------------------
        get1DChartsData(profile, theme, graphsChart1, graphsChart2, heatingTimeSeconds);

        // ---------------------------------------------------------
        // Наполнение CHART 1 и CHART 2 данными актуальной 2D модели
        // ---------------------------------------------------------
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

            graphsChart2.push(
                {
                    name: "Front Surface (2D)",
                    points: times.map((t, idx) => [t, Number(hist2D.frontSurfaceC[idx])]),
                    color: theme.palette.error.main, opacity: 1, lineWidth: 1, showMarker: true,
                },
                {
                    name: "Center (2D)",
                    points: times.map((t, idx) => [t, Number(hist2D.centerC[idx])]),
                    color: theme.palette.success.main, opacity: 1, lineWidth: 1, showMarker: true,
                },
                {
                    name: "Back Surface (2D)",
                    points: times.map((t, idx) => [t, Number(hist2D.backSurfaceC[idx])]),
                    color: theme.palette.primary.main, opacity: 1, lineWidth: 1, showMarker: true,
                }
            );
        }

        // --- Сборка CHART 1 (Профиль по толщине) ---
        const chart1 = {
            graphs: graphsChart1,
            axes: {
                x: { unit: "mm", lines: [{ value: thickness / 2, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        };

        // --- Сборка CHART 2 (Динамика истории во времени) ---
        const chart2 = graphsChart2.length > 0 ? {
            graphs: graphsChart2,
            axes: {
                x: { unit: "s", lines: [{ value: heatingTimeSeconds, color: theme.palette.text.secondary }], ranges: [] },
                y: commonYAxis
            }
        } : null;

        return { chart1, chart2 };
    }, [result2D, commonYAxis, theme, profile]);


// =================================================================
// ВЫДЕЛЕННЫЙ МЕМОИЗИРОВАННЫЙ РАСЧЕТ КООРДИНАТЫ X ДЛЯ ТЕМПЕРАТУРЫ Tg ПОСЛЕ ОСТЫВАНИЯ
// =================================================================
    const xTgPauseValue = useMemo(() => {
        if (!result2D || !result2D.temperatureProfile) return null;

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

        if (xTgPause !== null && xTgPause <= width / 2) {
            return xTgPause;
        }

        return null;
    }, [result2D, profile?.thickness, profile?.width, profile?.material?.glassTransitionTemp]);


    const plasticZoneWidthCalculated = useMemo(() => {
        return xTgPauseValue !== null ? xTgPauseValue * 2 : null;
    }, [xTgPauseValue]);


// =================================================================
// РАСЧЕТ МАКСИМАЛЬНОГО ВНУТРЕННЕГО РАДИУСА ГИБКИ С УЧЕТОМ K-FACTOR
// =================================================================
    const maxRadiusCalculated = useMemo(() => {

        if (plasticZoneWidthCalculated == null) {
            return null;
        }
        const bendAngle = Number(machineParams?.bendAngle);
        const thickness = Number(profile?.thickness || 0);

        const kFactor = profile?.material?.kFactor;

        const turnAngleRad = (bendAngle * Math.PI) / 180;
        if (turnAngleRad <= 0) return 0;

        const rInnerMax = (plasticZoneWidthCalculated / turnAngleRad) - (kFactor * thickness);

        return rInnerMax > 0 ? rInnerMax : 0;
    }, [plasticZoneWidthCalculated, machineParams?.bendAngle, profile?.thickness, profile?.material?.kFactor]);


// =================================================================
// 2. ХУК ДЛЯ ГРАФИКОВ ПО 2D МОДЕЛИ (Ширина и 3 Среза)
// =================================================================
    const chart3Data = useMemo(() => {
        if (!result2D || !result2D.temperatureProfile) return null;

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

        // 1. Базовые сетка-линии каждые 5 мм от центра
        const xLines = [{ value: 0, color: theme.palette.text.secondary }];
        if (width > 0) {
            const maxVal = width / 2;
            for (let val = 5; val <= maxVal; val += 5) {
                xLines.push({ value: val, color: alpha(theme.palette.divider, 0.25) });
                xLines.push({ value: -val, color: alpha(theme.palette.divider, 0.25) });
            }
        }

        // 2. Использование пересчитанной X-координаты пересечения Tg для акцентных линий
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


    return (
        <Box className="bend-preview" sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <PartHeader profile={profile} />

            <Box
                ref={containerRef}
                className="bend-preview-drawing"
                sx={{
                    flex: 1,
                    minWidth:360,
                    maxHeight:480,
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
                        part={{ blankLength }}
                        machineParams={machineParams}
                        data={result2D}
                        plasticZoneWidth={plasticZoneWidthCalculated}
                        maxRadius={maxRadiusCalculated}
                    />
                </Box>

                {(chart1And2?.chart1 || chart3Data || chart1And2?.chart2) && (
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            mx: "auto",
                            gap: 1,
                        }}
                    >
                        {/* --- ГРАФИК 1: Профиль по толщине (2D и 1D) --- */}
                        {chart1And2?.chart1 && (
                            <Box mx={"auto"}>
                                <SvgLineChart chart={chart1And2.chart1} />
                            </Box>
                        )}

                        {/* --- ГРАФИК 3: Профиль по ширине (2D) --- */}
                        {chart3Data && (
                            <Box mx={"auto"}>
                                <SvgLineChart chart={chart3Data} />
                            </Box>
                        )}

                        {/* --- ГРАФИК 2: История динамики во времени (2D всегда, 1D подмешивается в dev) --- */}
                        {chart1And2?.chart2 && (
                            <Box mx={"auto"}>
                                <SvgLineChart chart={chart1And2.chart2} />
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

        </Box>
    );
};

export default BendingPreview;
