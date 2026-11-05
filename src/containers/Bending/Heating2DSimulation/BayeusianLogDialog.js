import React, { useState, useRef, useCallback, useMemo } from "react";
import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, IconButton, LinearProgress, Divider, Card, Collapse,
    useMediaQuery, useTheme
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import TimerIcon from "@mui/icons-material/Timer";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { OPTIMIZER_BASE_CONFIG, OPTIMIZER_SETTINGS } from "./optimizer.config";
import {LIMITS} from "./heating2DModel";

export const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return "0s";

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    return [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        hours > 0 || minutes > 0 ? `${String(secs).padStart(2, "0")}s` : `${secs}s`
    ].filter(Boolean).join(" ");
};

function formatNumberWithNBSP(num) {
    if (num === null || num === undefined || !Number.isFinite(Number(num))) return "—";
    return new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, " ");
}

function formatParamValue(name, value) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);

    const config = OPTIMIZER_BASE_CONFIG[name];

    if (config) {
        const digits = config.digits ?? 5;
        const formattedValue = value.toFixed(digits);
        const unit = config.unit ? ` ${config.unit}` : "";
        return `${formattedValue}${unit}`;
    }

    return value.toFixed(5);
}

function ParameterGrid({ params, color = "#e2e8f0" }) {
    if (!params || typeof params !== "object") return null;

    return (
        <Box
            sx={{
                columnCount: { xs: 1, md: 2 },
                columnGap: "40px",
                width: "100%",
                minWidth: 0
            }}
        >
            {Object.entries(params).map(([name, value]) => {
                const displayLabel = OPTIMIZER_BASE_CONFIG[name]?.label || name;

                return (
                    <Box
                        key={name}
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 1,
                            minWidth: 0,
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            borderBottom: "1px dashed rgba(255,255,255,0.05)",
                            pb: 0.5,
                            mb: 0.5,
                            breakInside: "avoid"
                        }}
                    >
                        <Box component="span" sx={{ color: "#64748b", overflowWrap: "anywhere" }}>
                            {displayLabel}:
                        </Box>
                        <Box
                            component="span"
                            sx={{
                                color,
                                fontWeight: 600,
                                textAlign: "right",
                                overflowWrap: "anywhere",
                                flexShrink: 0
                            }}
                        >
                            {formatParamValue(name, value)}
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

export function BayeusianLogDialog({ open, onClose, parentState, setParentState, accuracyModes }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const pxSize = isMobile ? 2 : 2.5;

    const [isOptimizing, setIsOptimizing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [bestPanelExpanded, setBestPanelExpanded] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(0);
    const [finalResultReceived, setFinalResultReceived] = useState(false);
    const [wasAborted, setWasAborted] = useState(false);
    const [bestLogIndex, setBestLogIndex] = useState(null);

    const workerRef = useRef(null);
    const contentRef = useRef(null);
    const startTimeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const isOptimizingRef = useRef(false);
    const autoScrollRef = useRef(true);
    const lastProgressUpdateRef = useRef(0);
    const completedStepsRef = useRef(0);
    const bestLogIndexRef = useRef(null);

    const stopTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (startTimeRef.current !== null) {
            setElapsedTime((performance.now() - startTimeRef.current) / 1000);
        }
        startTimeRef.current = null;
    }, []);

    const appendLog = useCallback((entry) => {
        setLogs(prev => {
            let nextLogs = [...prev];

            if (prev.length === 0) {
                nextLogs = [entry];
            } else {
                const lastIdx = prev.length - 1;
                const lastLog = prev[lastIdx];

                // Если заменяем строку прогресса текущего шага постоянным логом
                if (lastLog && lastLog.type === "progress" && lastLog.currentStepVisual === entry.currentStepVisual) {
                    nextLogs[lastIdx] = entry;
                } else {
                    nextLogs.push(entry);
                }
            }

            // Если оптимизатор прислал номер шага текущего лидера,
            // находим этот шаг в массиве и запоминаем его физический индекс
            if (entry.bestStepNumber !== undefined && entry.bestStepNumber !== null) {
                const leaderLogIndex = nextLogs.findIndex(
                    log => log && log.candidateParams && log.currentStepVisual === entry.bestStepNumber
                );

                if (leaderLogIndex !== -1) {
                    bestLogIndexRef.current = leaderLogIndex;
                }
            }

            return nextLogs;
        });

        // Синхронизируем стейт отображения плашки
        setTimeout(() => {
            if (bestLogIndexRef.current !== null) {
                setBestLogIndex(bestLogIndexRef.current);
            }
        }, 0);
    }, []);

    const initWorker = useCallback(() => {
        workerRef.current?.terminate();
        workerRef.current = null;

        try {
            const worker = new Worker(
                new URL("./optimization.worker.js", import.meta.url),
                { type: "module" }
            );

            workerRef.current = worker;

            worker.onmessage = (e) => {
                if (workerRef.current !== worker) return;

                const { status, data, percent, error, logEntry } = e.data || {};

                if (status === "progress_tick") {
                    const progress = Number(percent);
                    const validProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

                    const currentStep = e.data.currentExecutionCount !== undefined ? e.data.currentExecutionCount : 0;
                    const totalStepsBudget = e.data.totalIterations !== undefined ? e.data.totalIterations : OPTIMIZER_SETTINGS.totalBudgetIterations;

                    const safeStepVisual = Math.min(totalStepsBudget, Math.max(0, currentStep));
                    const formattedLoad = formatNumberWithNBSP(e.data.currentLoad || 0);

                    completedStepsRef.current = safeStepVisual;
                    setCompletedSteps(safeStepVisual);
                    setProgressPercent(validProgress);

                    const now = performance.now();
                    // Частота обновления UI
                    if (now - lastProgressUpdateRef.current > 120 || validProgress === 100 || validProgress === 0) {
                        lastProgressUpdateRef.current = now;

                        setLogs(prev => {
                            const isInitPhase = currentStep <= OPTIMIZER_SETTINGS.randomInitPoints;
                            const phaseLabel = isInitPhase ? "INIT" : "STEP";

                            // Пытаемся взять параметры из события воркера, либо сохраняем старые, если они уже были в логе этого шага
                            const currentParams = e.data.currentParams || (prev[prev.length - 1]?.currentStepVisual === safeStepVisual ? prev[prev.length - 1]?.candidateParams : null);

                            const newEntry = {
                                type: "progress",
                                text: `⏳ [SOLVER]: ${phaseLabel} ${safeStepVisual}/${totalStepsBudget} | Progress: ${validProgress}% (Load: ${formattedLoad} nodes)`,
                                timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false }),
                                candidateParams: currentParams,
                                technicalMetrics: null,
                                currentStepVisual: safeStepVisual
                            };

                            if (prev.length === 0) return [newEntry];

                            const lastIdx = prev.length - 1;
                            const lastLog = prev[lastIdx];

                            // ИСПРАВЛЕНИЕ: Перезаписываем старую строку прогресса ТОЛЬКО если она принадлежит ЭТОМУ ЖЕ шагу.
                            // Если предыдущий шаг завершился и зафиксировался, у него будет другой тип или другой currentStepVisual.
                            if (lastLog && lastLog.type === "progress" && lastLog.currentStepVisual === safeStepVisual) {
                                const updated = [...prev];
                                updated[lastIdx] = newEntry;
                                return updated;
                            }

                            // Если это новый шаг, просто добавляем его в конец, не трогая старые записи
                            return [...prev, newEntry];
                        });
                    }
                    return;
                }

                if (status === "log_step" && logEntry) {
                    completedStepsRef.current = logEntry.currentStepVisual;
                    setProgressPercent(0);
                    setCompletedSteps(logEntry.currentStepVisual);
                    appendLog(logEntry);
                    return;
                }

                if (status === "success") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();
                    setProgressPercent(100);
                    setFinalResultReceived(true);
                    completedStepsRef.current = OPTIMIZER_SETTINGS.totalBudgetIterations;
                    setCompletedSteps(OPTIMIZER_SETTINGS.totalBudgetIterations);

                    const limits = data?.optimalLimits || null;
                    const metrics = data?.metrics || {};
                    const achievedLoad = formatNumberWithNBSP(metrics.achievedLoad);
                    const maxLoad = formatNumberWithNBSP(OPTIMIZER_SETTINGS.maxAllowedLoad);

                    const objectiveText = OPTIMIZER_SETTINGS.optimizationObjective === "minimize_load"
                        ? "MAX SPEED (Minimize grid computational load)"
                        : "MAX ACCURACY (Minimize estimated error target)";

                    const t = () => new Date().toLocaleTimeString("uk-UA", { hour12: false });
                    const summary = [
                        { type: "info", text: "=======================================================", timestamp: t() },
                        { type: "success", text: "🏆 [OPTIMIZER]: FINAL TECHNICAL REPORT", timestamp: t() },
                        { type: "info", text: "=======================================================", timestamp: t() },
                        {
                            type: metrics.isFallbackActivated ? "warning" : "success",
                            text: metrics.isFallbackActivated
                                ? "⚠️ COMPROMISE: constraints not met. Balanced fallback used."
                                : "✅ SUCCESS: parameters matched to model criteria.",
                            timestamp: t()
                        },
                        { type: "info", text: "-------------------------------------------------------", timestamp: t() },
                        { type: "info", text: "🎯 INITIAL CRITERIA AND CONSTRAINTS:", timestamp: t() },
                        { type: "info", text: `   🔹 Task: ${objectiveText}`, timestamp: t() },
                        { type: "info", text: `   🔹 Max allowed error score: <= ${OPTIMIZER_SETTINGS.maxErrorScore}`, timestamp: t() },
                        { type: "info", text: `   🔹 Max allowed load: <= ${maxLoad} computed nodes`, timestamp: t() },
                        { type: "info", text: `   🔹 Iterations budget: ${OPTIMIZER_SETTINGS.totalBudgetIterations} (init: ${OPTIMIZER_SETTINGS.randomInitPoints})`, timestamp: t() },
                        { type: "info", text: "-------------------------------------------------------", timestamp: t() },
                        { type: "info", text: "📊 ACHIEVED METRICS:", timestamp: t() },
                        { type: "info", text: `   📈 Resulting error score: ${Number.isFinite(Number(metrics.resultingErrorScore)) ? Number(metrics.resultingErrorScore).toFixed(3) : "—"}`, timestamp: t() },
                        { type: "info", text: `   ⚡ Computational grid load: ${achievedLoad} computed nodes`, timestamp: t() },
                        { type: "info", text: "-------------------------------------------------------", timestamp: t() },
                        { type: "info", text: "🛠️ OPTIMAL SOLVER CONFIGURATION:", timestamp: t() },
                        ...Object.entries(OPTIMIZER_BASE_CONFIG).map(([name, range]) => {
                            const value = limits?.[name];
                            const formatted = value === undefined || value === null
                                ? "—"
                                : typeof value === "number"
                                    ? value.toFixed(name === "tolerance" || ["gridX", "gridY", "minGrid"].includes(name) ? 5 : 2)
                                    : String(value);

                            const unit = ["gridX", "gridY", "minGrid"].includes(name) ? " mm" : name === "tolerance" ? " K" : ["maxDt", "targetDt"].includes(name) ? " s" : "";

                            return {
                                type: "info",
                                text: `   🔹 ${name}: ${formatted}${unit} [bounds: ${range.min} .. ${range.max}]`,
                                timestamp: t()
                            };
                        }),
                        { type: "info", text: "=======================================================", timestamp: t() },
                        { type: "success", text: "🏆 [Bayesian UI]: Optimization process completed.", timestamp: t() }
                    ];

                    setLogs(prev => {
                        const hasProgressRow = prev.length > 0 && prev[prev.length - 1].type === "progress";
                        const baseLogs = hasProgressRow ? prev.slice(0, -1) : prev;

                        const finalLogs = [...baseLogs, ...summary];
                        const finalWinnerIdx = finalLogs.length - 1;

                        finalLogs[finalWinnerIdx].candidateParams = limits;
                        finalLogs[finalWinnerIdx].isFinalReportMarker = true;
                        finalLogs[finalWinnerIdx].finalMetricsCache = metrics;

                        // ИСПРАВЛЕНИЕ: Вместо принудительного переключения на финальный текстовый отчет,
                        // оставляем старый сохраненный индекс лучшего шага (bestLogIndexRef.current)
                        if (bestLogIndexRef.current !== null) {
                            setBestLogIndex(bestLogIndexRef.current);
                        } else {
                            setBestLogIndex(finalWinnerIdx);
                        }

                        return finalLogs;
                    });
                    return;
                }

                if (status === "error") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();
                    appendLog({
                        type: "error",
                        text: `❌ [Bayesian UI]: Optimization error: ${error || "Unknown internal error"}`,
                        timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
                    });
                }
            };

            worker.onerror = (event) => {
                if (workerRef.current !== worker) return;
                isOptimizingRef.current = false;
                setIsOptimizing(false);
                stopTimer();
                appendLog({
                    type: "error",
                    text: `❌ Worker Error: ${event.message || "Failed to execute background task"}`,
                    timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
                });
            };
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                type: "error",
                text: `❌ Failed to spawn background worker: ${err.message || err}`,
                timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
            });
        }
    }, [appendLog, stopTimer]);

    React.useEffect(() => {
        initWorker();
        return () => {
            isOptimizingRef.current = false;
            workerRef.current?.terminate();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [initWorker]);

    const runOptimization = useCallback(() => {
        if (!workerRef.current || isOptimizingRef.current) return;

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        bestLogIndexRef.current = null;
        completedStepsRef.current = 0;
        setCompletedSteps(0);
        setProgressPercent(0);
        setElapsedTime(0);
        setExpandedLogs({});
        setBestPanelExpanded(false);
        setFinalResultReceived(false);
        setWasAborted(false);
        setBestLogIndex(null);

        startTimeRef.current = performance.now();
        isOptimizingRef.current = true;
        setIsOptimizing(true);

        timerIntervalRef.current = setInterval(() => {
            if (startTimeRef.current !== null) {
                setElapsedTime((performance.now() - startTimeRef.current) / 1000);
            }
        }, 100);

        setLogs([{
            type: "info",
            text: "🟢 [Bayesian Setup]: Started solver grid space optimization task...",
            timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
        }]);

        try {
            // 1. Динамически собираем пресеты на стороне UI, проходя по всем индексам accuracyModes из LIMITS
            const uiModelPresets = {};
            // Если LIMITS импортирован в файл компонента, используем его ключи:
            const keysToProcess = typeof LIMITS !== "undefined" ? Object.keys(LIMITS) : ["gridX", "gridY", "minGrid", "maxIter", "tolerance", "maxDt", "targetDt", "growthFactor", "shrinkFactor"];

            const currentModes = accuracyModes || ["fast", "optimal", "accurate", "accurate2"];

            currentModes.forEach((modeName, modeIdx) => {
                uiModelPresets[modeName] = {};
                keysToProcess.forEach(paramKey => {
                    if (typeof LIMITS !== "undefined" && Array.isArray(LIMITS[paramKey]) && LIMITS[paramKey][modeIdx] !== undefined) {
                        uiModelPresets[modeName][paramKey] = LIMITS[paramKey][modeIdx];
                    }
                });
            });

            // 2. Отправляем в воркер параметры, дописывая собранный uiModelPresets в options
            workerRef.current.postMessage({
                baseParams: {
                    thicknessMm: Number(parentState.geometry?.thickness) || 0,
                    material: { ...parentState.material },
                    machine: { ...parentState.machine },
                    simulation: {
                        ...parentState.simulation,
                        widthHalfMm: parentState.simulation.widthHalfMm !== undefined
                            ? parentState.simulation.widthHalfMm
                            : ((Number(parentState.geometry?.width) || 0) / 2 || 20)
                    }
                },
                options: {
                    ...OPTIMIZER_SETTINGS,
                    accuracyModes: currentModes,
                    config: OPTIMIZER_BASE_CONFIG,
                    modelPresets: uiModelPresets // <-- Передаем пресеты параметром
                }
            });
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                type: "error",
                text: `❌ Error spawning optimization: ${err.message || err}`,
                timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
            });
        }

    }, [parentState, appendLog, stopTimer, accuracyModes]);

    const abortOptimization = useCallback(() => {
        if (!isOptimizingRef.current) return;

        isOptimizingRef.current = false;
        setIsOptimizing(false);
        stopTimer();
        setProgressPercent(0);
        setWasAborted(true);

        workerRef.current?.terminate();
        workerRef.current = null;

        appendLog({
            type: "error",
            text: "🚨 [SYSTEM_CRIT]: Optimization forcibly terminated by client instruction.",
            timestamp: new Date().toLocaleTimeString("uk-UA", { hour12: false })
        });

        initWorker();
    }, [initWorker, appendLog, stopTimer]);

    const bestSnapshotState = useMemo(() => {
        if (bestLogIndex === null || !logs[bestLogIndex]) {
            return {
                errorScore: "—", load: "—", step: "—", solverRejected: "0", optimizerStep: "—", calcTime: "—",
                timeError: "—", gridError: "—", solverError: "—",
                picardIters: "—", params: null
            };
        }

        const targetLog = logs[bestLogIndex];

        if (targetLog.isFinalReportMarker && targetLog.finalMetricsCache) {
            const m = targetLog.finalMetricsCache;
            return {
                errorScore: Number.isFinite(Number(m.resultingErrorScore)) ? Number(m.resultingErrorScore).toFixed(3) : "—",
                load: formatNumberWithNBSP(m.achievedLoad),
                step: m?.iterations?.totalTimeSteps !== undefined ? String(m.iterations.totalTimeSteps) : "—",
                solverRejected: m?.iterations?.rejectedTimeSteps !== undefined ? String(m.iterations.rejectedTimeSteps) : "0",
                optimizerStep: "FINAL",
                calcTime: elapsedTime ? `${elapsedTime.toFixed(1)} s` : "—",
                timeError: "—",
                gridError: "—",
                solverError: "—",
                picardIters: "—",
                params: targetLog.candidateParams
            };
        }

        const tm = targetLog.technicalMetrics;
        return {
            errorScore: tm?.accuracy?.totalErrorScore !== undefined ? tm.accuracy.totalErrorScore.toFixed(3) : "—",
            load: tm?.iterations?.totalGridPointsProcessed !== undefined ? formatNumberWithNBSP(tm.iterations.totalGridPointsProcessed) : "—",
            step: tm?.iterations?.totalTimeSteps !== undefined ? String(tm.iterations.totalTimeSteps) : "—",
            solverRejected: tm?.iterations?.rejectedTimeSteps !== undefined ? String(tm.iterations.rejectedTimeSteps) : "0", // Забираем 4 реджекта из метрик
            optimizerStep: targetLog.currentStepVisual !== undefined ? `#${targetLog.currentStepVisual}` : "—",
            calcTime: tm?.calculationTimeMs !== undefined ? `${tm.calculationTimeMs.toFixed(1)} ms` : "—",
            timeError: tm?.accuracy?.timeIntegrationErrorC !== undefined ? `${tm.accuracy.timeIntegrationErrorC.toFixed(3)}°C` : "—",
            gridError: tm?.accuracy?.spatialGridErrorC !== undefined ? `${tm.accuracy.spatialGridErrorC.toFixed(3)}°C` : "—",
            solverError: tm?.accuracy?.solverErrorC !== undefined ? `${Math.abs(tm.accuracy.solverErrorC).toFixed(3)}°C` : "—",
            picardIters: tm?.iterations?.totalPicardIterations !== undefined ? String(tm.iterations.totalPicardIterations) : "—",
            params: targetLog.candidateParams
        };
    }, [bestLogIndex, logs, elapsedTime]);


    const handleApplyParameters = useCallback(() => {
        if (!bestSnapshotState || !bestSnapshotState.params) return;

        setParentState(prev => ({
            ...prev,
            simulation: {
                ...prev.simulation,
                accuracyMode: bestSnapshotState.params
            }
        }));

        onClose?.();
    }, [bestSnapshotState, setParentState, onClose]);

    React.useEffect(() => {
        const container = contentRef.current;
        if (container && autoScrollRef.current) {
            container.scrollTop = container.scrollHeight;
        }
    }, [logs]);

    const handleLogScroll = useCallback(() => {
        const container = contentRef.current;
        if (!container) return;
        autoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 50;
    }, []);

    const stepProgressPercent = Math.min(100, Math.round((completedSteps / OPTIMIZER_SETTINGS.totalBudgetIterations) * 100));

    const logTypeStyles = {
        info: { color: "#9cdcfe", label: "[INFO]" },
        success: { color: "#4ec9b0", label: "[SUCCESS]" },
        warning: { color: "#ce9178", label: "[WARN]" },
        error: { color: "#f44336", label: "[CRIT]" },
        step_bayes: { color: "#34d399", label: "[BAYES]" },
        step_rand: { color: "#c586c0", label: "[RANDOM]" },
        init: { color: "#c586c0", label: "[INIT_GEN]" },
        progress: { color: "#6a9955", label: "[SOLVER_2D]" }
    };

    const SYS_BOX_SX = { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 24px", pb: 1.25, borderBottom: "1px solid rgba(255,255,255,0.05)", width: "100%", fontFamily: "monospace", fontSize: "0.8rem" };

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === "backdropClick") return;
                if (!isOptimizing) onClose?.();
            }}
            // Делаем окно ВСЕГДА на весь экран
            fullScreen
            disableEnforceFocus
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: "#121417",
                        backgroundImage: "none",
                        borderRadius: 0, // Убираем скругления углов для полноэкранного режима
                        border: "none",  // Убираем внешнюю рамку
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        maxHeight: "100%"
                    }
                }
            }}
        >
            <DialogTitle
                sx={{
                    m: 0, px: pxSize, py: 1.5, bgcolor: "#1a1d24",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    flexShrink: 0, minHeight: "auto", display: "flex",
                    alignItems: "center", justifyContent: "space-between", gap: 1.5
                }}
            >
                <Box sx={{ flexGrow: 1, pr: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 1 }}>
                    <TerminalIcon sx={{ color: "#2563eb", fontSize: "1.2rem", flexShrink: 0 }} />
                    <Typography variant="subtitle1" component="span" sx={{ color: "#e2e8f0", fontWeight: 600, fontSize: isMobile ? "1.05rem" : "1.2rem", letterSpacing: "0.3px" }}>
                        Bayesian Grid Optimization Monitor
                    </Typography>
                </Box>
                <IconButton aria-label="close" onClick={onClose} disabled={isOptimizing} sx={{ p: 0.5, color: "text.secondary", transition: "all 0.2s ease-in-out", "&:hover": { backgroundColor: "action.hover", color: "text.primary" } }}>
                    <CloseIcon fontSize="medium" />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ px: pxSize, py: 2.5, borderColor: "divider", display: "flex", flexDirection: "column", gap: 2, flexGrow: isMobile ? 1 : 0, overflowY: "auto" }}>
                <Box sx={{ width: "100%", bgcolor: "#181b22", p: 1, px: 1.5, borderRadius: "6px", border: "1px solid #282c34", display: "flex", alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, flexShrink: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            Total Optimization Progress
                        </Typography>
                        <Typography variant="caption" sx={{ color: isOptimizing ? "#3b82f6" : "#f8fafc", fontFamily: "monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                            <TimerIcon sx={{ fontSize: "0.9rem", opacity: 0.8 }} />
                            {formatTime(elapsedTime)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1, width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end" }}>
                        <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {completedSteps}/{OPTIMIZER_SETTINGS.totalBudgetIterations}
                        </Typography>
                        <LinearProgress variant="determinate" value={stepProgressPercent} sx={{ height: 4, width: "100%", maxWidth: { sm: "300px", md: "400px" }, borderRadius: 2, bgcolor: "#22252e", "& .MuiLinearProgress-bar": { bgcolor: "#2563eb", borderRadius: 2, transition: "transform 0.3s ease-out" } }} />
                        <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {stepProgressPercent}%
                        </Typography>
                    </Box>
                </Box>

                {isOptimizing && (
                    <Box sx={{ width: "100%", bgcolor: "#14171c", p: 1, px: 1.5, borderRadius: "6px", border: "1px dashed rgba(37, 99, 235, 0.3)", display: "flex", alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 1, flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.75rem" }}>
                            ⏳ Current solver simulation progress...
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: "30%" } }}>
                            <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 4, width: "100%", borderRadius: 2, bgcolor: "#22252e", "& .MuiLinearProgress-bar": { bgcolor: "#10b981", transition: "transform 0.25s cubic-bezier(0.1, 0.8, 0.25, 1)" } }} />
                            <Typography variant="caption" sx={{ color: "#10b981", fontWeight: "bold", fontFamily: "monospace" }}>
                                {progressPercent}%
                            </Typography>
                        </Box>
                    </Box>
                )}

                <Box sx={{ display: "flex", flexDirection: "column", borderRadius: "6px", overflow: "hidden", border: "1px solid #2d3139", flexGrow: 1, minHeight: 180 }}>
                    <Box sx={{ bgcolor: "#181b22", px: 2, py: 0.8, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid #2d3139", flexShrink: 0 }}>
                        <TerminalIcon sx={{ fontSize: "0.95rem", color: "#64748b" }} />
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace", fontWeight: 600 }}>
                            STDOUT / LOGS_STREAM
                        </Typography>
                        <Typography variant="body2" color="#64748b" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                            Objective: <strong style={{ color: "#94a3b8" }}>
                            {OPTIMIZER_SETTINGS.optimizationObjective}
                        </strong>
                            <span style={{ color: "#64748b", marginLeft: "12px" }}>
                                Constraints: [Max Error: <strong style={{ color: "#94a3b8"}}>{OPTIMIZER_SETTINGS.maxErrorScore}</strong> | Max Load: <strong style={{ color: "#94a3b8"}}>{formatNumberWithNBSP(OPTIMIZER_SETTINGS.maxAllowedLoad)} nodes</strong>]
                            </span>
                        </Typography>
                    </Box>

                    <Box ref={contentRef} onScroll={handleLogScroll} sx={{ bgcolor: "#0b0c10", p: { xs: 1, sm: 2 }, fontFamily: "Consolas, Monaco, 'Courier New', monospace", fontSize: "0.8rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere", height: isMobile ? "100%" : "50vh", overflowY: "auto", lineHeight: 1.6, flexGrow: 1 }}>
                        {logs.length === 0 ? (
                            <Typography sx={{ color: "#475569", fontFamily: "inherit", fontSize: "inherit", fontStyle: "italic", textAlign: "center", mt: 4 }}>
                                Queue empty. Press "Start Optimization" to begin tracing execution thread.
                            </Typography>
                        ) : (
                            logs.map((log, idx) => {
                                if (!log || !log.text) return null;

                                const style = logTypeStyles[log.type] || logTypeStyles.info;

                                if (log.text.includes("=====")) {
                                    return <Divider key={idx} sx={{ borderColor: "rgba(255,255,255,0.05)", my: 1 }} />;
                                }

                                const hasParams = !!log.candidateParams;
                                const isExpanded = !!expandedLogs[idx];

                                return (
                                    <Box key={idx} sx={{ display: "flex", flexDirection: "column", borderBottom: isExpanded ? "1px dashed rgba(255,255,255,0.1)" : "none", pb: isExpanded ? 1 : 0 }}>
                                        <Box
                                            onClick={hasParams ? () => {
                                                setExpandedLogs(prev => ({ ...prev, [idx]: !prev[idx] }));
                                            } : undefined}
                                            sx={{
                                                display: "flex", alignItems: "flex-start", gap: 1, py: 0.35, cursor: hasParams ? "pointer" : "default", borderRadius: "4px", px: 1, mx: -0.5,
                                                bgcolor: isExpanded ? "rgba(37, 99, 235, 0.03)" : "transparent",
                                                "&:hover": { bgcolor: hasParams ? "rgba(255, 255, 255, 0.04)" : "transparent" }
                                            }}
                                        >
                                            {/* ИСПРАВЛЕНО: Порядковый номер лога [#idx] полностью удален */}

                                            <Typography component="span" sx={{ color: "#475569", fontSize: "inherit", fontFamily: "inherit", userSelect: "none", flexShrink: 0, mr: 1 }}>
                                                {log.timestamp}
                                            </Typography>

                                            {/* ИСПРАВЛЕНО: Метка переведена на английский и сокращена */}
                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: style.color, // Использует родной цвет из logTypeStyles (#b5cea8 или #c586c0)
                                                    fontWeight: "bold",
                                                    fontSize: "inherit",
                                                    fontFamily: "inherit",
                                                    minWidth: { xs: 0, sm: "90px" },
                                                    flexShrink: 0,
                                                    userSelect: "none",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5
                                                }}
                                            >
                                                {style.label}
                                                {hasParams && <Box component="span" sx={{ fontSize: "0.65rem", color: "#64748b" }}>{isExpanded ? "▲" : "▼"}</Box>}
                                            </Typography>

                                            {/* ИСПРАВЛЕНО: Текст лога переведен на короткий английский */}
                                            <Typography component="span" sx={{ color: log.type === "error" ? "#ef4444" : log.type === "warning" ? "#f59e0b" : "#cbd5e1", fontSize: "inherit", fontFamily: "inherit", minWidth: 0 }}>
                                                {(() => {
                                                    if (log.candidateParams && log.technicalMetrics && !log.isFinalReportMarker) {
                                                        const tm = log.technicalMetrics;
                                                        const errVal = tm?.accuracy?.totalErrorScore !== undefined ? tm.accuracy.totalErrorScore.toFixed(3) : "—";
                                                        const loadVal = tm?.iterations?.totalGridPointsProcessed !== undefined ? formatNumberWithNBSP(tm.iterations.totalGridPointsProcessed) : "—";
                                                        const stepNum = log.currentStepVisual !== undefined ? log.currentStepVisual : idx;

                                                        // Вытаскиваем имя пресета из текста, если оно там есть (например, PRESET_FAST)
                                                        const presetMatch = log.text ? log.text.match(/\[(PRESET_\w+)]/) : null;
                                                        const presetTag = presetMatch ? ` (${presetMatch[1]})` : "";

                                                        return `Step #${stepNum}${presetTag} | Error: ${errVal} | Load: ${loadVal} nodes`;
                                                    }
                                                    return log.text;
                                                })()}
                                            </Typography>
                                        </Box>

                                        {hasParams && isExpanded && (
                                            <Box sx={{ ml: { xs: 1, sm: 3 }, pl: { xs: 1, sm: 2 }, pr: 1, py: 1.5, bgcolor: "#14171c", borderRadius: "4px", mt: 0.5, mb: 0.5, borderLeft: "3px solid #2563eb", minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
                                                <Box sx={{ width: "100%", fontFamily: "monospace", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "4px", color: "#94a3b8", pb: 1, borderBottom: "1px dashed rgba(255,255,255,0.05)", mb: 1 }}>
                                                    {(() => {
                                                        const tm = log.technicalMetrics;

                                                        let errVal = "—";
                                                        let loadVal = "—";
                                                        let calcTime = "—";
                                                        let tErr = "—", gErr = "—", sErr = "—";
                                                        let stepsSolver = "—";
                                                        let rejectedSolverSteps = "0"; // Новая переменная для внутренних реджектов солвера
                                                        let picard = "—";

                                                        if (tm) {
                                                            errVal = tm?.accuracy?.totalErrorScore !== undefined ? tm.accuracy.totalErrorScore.toFixed(3) : "—";
                                                            loadVal = tm?.iterations?.totalGridPointsProcessed !== undefined ? formatNumberWithNBSP(tm.iterations.totalGridPointsProcessed) : "—";
                                                            calcTime = tm?.calculationTimeMs !== undefined ? `${tm.calculationTimeMs.toFixed(1)} ms` : "—";
                                                            tErr = tm?.accuracy?.timeIntegrationErrorC !== undefined ? `${tm.accuracy.timeIntegrationErrorC.toFixed(3)}°C` : "—";
                                                            gErr = tm?.accuracy?.spatialGridErrorC !== undefined ? `${tm.accuracy.spatialGridErrorC.toFixed(3)}°C` : "—";
                                                            sErr = tm?.accuracy?.solverErrorC !== undefined ? `${Math.abs(tm.accuracy.solverErrorC).toFixed(3)}°C` : "—";
                                                            stepsSolver = tm?.iterations?.totalTimeSteps || "—";
                                                            rejectedSolverSteps = tm?.iterations?.rejectedTimeSteps !== undefined ? String(tm.iterations.rejectedTimeSteps) : "0";
                                                            picard = tm?.iterations?.totalPicardIterations || "—";
                                                        }

                                                        const modeText = OPTIMIZER_SETTINGS.optimizationObjective === "minimize_load" ? "Optimal Speed" : "Optimal Accuracy";

                                                        return (
                                                            <>
                                                                {log.type === "warning" && (
                                                                    <Box sx={{ color: "#ef4444", fontWeight: "bold", mb: 0.5 }}>
                                                                        🚨 CRITICAL CEILING VIOLATION: Simulation budget exceeded. Candidate rejected.
                                                                    </Box>
                                                                )}
                                                                <Box>Simulation calculation time: <strong style={{ color: "#ffffff" }}>{calcTime}</strong> | Mode: <strong style={{ color: "#4ec9b0" }}>{modeText}</strong></Box>
                                                                <Box>Error score: <strong style={{ color: log.type === "warning" ? "#ef4444" : "#2563eb" }}>{errVal}</strong> <span style={{ color: "#64748b" }}>(Time: {tErr}, Grid: {gErr}, Solver: {sErr})</span></Box>
                                                                <Box>
                                                                    Solver steps: <strong style={{ color: "#ffffff" }}>{stepsSolver}</strong>
                                                                    <span style={{ color: Number(rejectedSolverSteps) > 0 ? "#ce9178" : "#64748b", marginLeft: 4 }}>({rejectedSolverSteps} rejected)</span>
                                                                    {" "}| Picard iterations: <strong style={{ color: "#ffffff" }}>{picard}</strong> | Computational load: <strong style={{ color: "#4ec9b0" }}>{loadVal} pts</strong>
                                                                </Box>
                                                            </>
                                                        );
                                                    })()}
                                                </Box>
                                                <Box sx={{ width: "100%" }}>
                                                    <ParameterGrid params={log.candidateParams} color="#10b981" />
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        )}
                    </Box>
                </Box>

                {logs.length > 0 && (
                    <Card sx={{ bgcolor: "transparent", border: "none", boxShadow: "none", width: "100%", flexShrink: 0, overflow: "visible" }}>
                        <Box
                            onClick={bestSnapshotState.params ? () => setBestPanelExpanded(prev => !prev) : undefined}
                            sx={{
                                p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1,
                                cursor: bestSnapshotState.params ? "pointer" : "default",
                                bgcolor: "#14171c", border: "1px solid #2563eb",
                                borderRadius: bestPanelExpanded ? "6px 6px 0 0" : "6px",
                                transition: "background-color 0.2s, border-radius 0.2s",
                                "&:hover": { bgcolor: bestSnapshotState.params ? "rgba(37, 99, 235, 0.04)" : "transparent" }
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <LeaderboardIcon sx={{ color: "#10b981", fontSize: "1.1rem" }} />
                                <Typography variant="caption" sx={{ color: "#cbd5e1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    {finalResultReceived ? "Final optimal layout configuration" : "Best step evaluation"} <span style={{ color: "#38bdf8", fontWeight: 700 }}>{bestSnapshotState.optimizerStep}</span>
                                </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 3 }, flexWrap: "wrap" }}>
                                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                    <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                                        Error Score: <Box component="span" sx={{ color: "#2563eb", fontWeight: "bold" }}>{bestSnapshotState.errorScore}</Box>
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                                        Load: <Box component="span" sx={{ color: "#10b981", fontWeight: "bold" }}>{bestSnapshotState.load}</Box>
                                    </Typography>
                                </Box>
                                <Typography variant="caption" color="#64748b" sx={{ fontFamily: "inherit" }}>
                                    Calculation time: <strong style={{ color: "#94a3b8" }}>{bestSnapshotState.calcTime}</strong>
                                </Typography>

                                {bestSnapshotState.params && (
                                    <IconButton size="small" sx={{ color: "#64748b", p: 0 }}>
                                        {bestPanelExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                                    </IconButton>
                                )}
                            </Box>
                        </Box>
                        <Collapse in={bestPanelExpanded} timeout="auto" unmountOnExit>
                            {bestSnapshotState.params && (
                                <Box sx={{ display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box" }}>
                                    <Box sx={{ width: "100%", bgcolor: "#14171c", borderRadius: "0 0 6px 6px", border: "1px solid #2563eb", borderTop: "none", p: 2, display: "flex", flexDirection: "column", gap: 1.5, boxSizing: "border-box" }}>

                                        <Box sx={SYS_BOX_SX}>
                                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                                Error score: <strong style={{ color: "#f8fafc", fontSize: "0.9rem", fontWeight: 700 }}>{bestSnapshotState.errorScore}</strong>
                                                {bestSnapshotState.optimizerStep !== "FINAL" && bestSnapshotState.timeError !== "—" && (
                                                    <span style={{ marginLeft: 8, color: "#475569" }}>
                                                        (Time: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.timeError}</strong>, Grid: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.gridError}</strong>, Solver: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.solverError}</strong>)
                                                    </span>
                                                )}
                                            </Typography>
                                        </Box>

                                        <Box sx={{ ...SYS_BOX_SX, borderBottom: "none", pb: 0 }}>
                                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                                Solver steps: <strong style={{ color: "#f8fafc" }}>{bestSnapshotState.step}</strong>
                                                <span style={{ color: Number(bestSnapshotState.solverRejected) > 0 ? "#ce9178" : "#64748b", marginLeft: 6, fontWeight: 600 }}>({bestSnapshotState.solverRejected} rejected)</span>
                                            </Typography>
                                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                                Picard iterations: <strong style={{ color: (Number(bestSnapshotState.picardIters) / (Number(bestSnapshotState.step) || 1)) > 5 ? "#f59e0b" : "#e2e8f0" }}>{bestSnapshotState.picardIters}</strong>
                                            </Typography>
                                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                                Computational load: <strong style={{ color: "#10b981", fontWeight: 700 }}>{String(bestSnapshotState.load).includes("nodes") ? bestSnapshotState.load : `${bestSnapshotState.load} nodes`}</strong>
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ width: "100%", p: 2, bgcolor: "#14171c", borderRadius: "6px", border: "1px dashed #2d3139", mt: 1.5, boxSizing: "border-box" }}>
                                        <Typography variant="caption" sx={{ color: "#475569", fontWeight: 600, textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: "0.5px", display: "block", mb: 1.5, fontFamily: "monospace" }}>
                                            Hyperparameter Matrix Diagnostics (Solver Space)
                                        </Typography>
                                        <Box sx={{ width: "100%" }}>
                                            <ParameterGrid params={bestSnapshotState.params} color="#38bdf8" />
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Collapse>
                    </Card>
                )}
            </DialogContent>

            <DialogActions sx={{ px: pxSize, py: 1.5, m: 0, gap: 1, borderTop: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#1a1d24", flexShrink: 0, minHeight: "auto", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: "stretch" }}>
                <Box sx={{ fontFamily: "monospace", fontWeight: 600, color: isOptimizing ? "#3b82f6" : wasAborted ? "#ef4444" : "#64748b", fontSize: "0.7rem", textAlign: isMobile ? "center" : "left", mb: isMobile ? 1 : 0, alignSelf: "center" }}>
                    SYS_STATUS: {isOptimizing ? "RUNNING_OPTIMIZER_THREAD" : wasAborted ? "THREAD_TERMINATED_BY_USER" : finalResultReceived ? "OPTIMIZATION_COMPLETED" : "WORKER_THREAD_IDLE"}
                </Box>

                <Box sx={{ display: "flex", gap: 1, width: isMobile ? "100%" : "auto", flexDirection: isMobile ? "column-reverse" : "row", justifyContent: "flex-end" }}>
                    {isOptimizing && (
                        <Button variant="outlined" size="small" onClick={abortOptimization} startIcon={<StopIcon />} fullWidth={isMobile} sx={{ color: "#f44336", borderColor: "rgba(244, 67, 54, 0.4)", textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 2, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#f44336", bgcolor: "rgba(244, 67, 54, 0.06)" } }}>
                            Abort Calculation
                        </Button>
                    )}

                    {!isOptimizing ? (
                        <>
                            <Button variant="outlined" size="small" onClick={onClose} fullWidth={isMobile} sx={{ color: "#cbd5e1", borderColor: "#334155", textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#475569", bgcolor: "rgba(255,255,255,0.02)" } }}>
                                {finalResultReceived ? "Discard & Close" : "Close Window"}
                            </Button>

                            {finalResultReceived ? (
                                <Button variant="contained" size="small" onClick={handleApplyParameters} disabled={!bestSnapshotState || !bestSnapshotState.params} fullWidth={isMobile} sx={{ bgcolor: "#2563eb", color: "#ffffff", textTransform: "none", fontWeight: 600, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, boxShadow: "none", "&:hover": { bgcolor: "#1d4ed8" }, "&.Mui-disabled": { bgcolor: "#1e293b", color: "#64748b" } }}>
                                    Apply Parameters
                                </Button>
                            ) : (
                                <Button variant="contained" size="small" onClick={runOptimization} startIcon={<PlayArrowIcon />} fullWidth={isMobile} sx={{ bgcolor: "#10b981", color: "#ffffff", textTransform: "none", fontWeight: 600, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, boxShadow: "none", "&:hover": { bgcolor: "#059669" } }}>
                                    Start Optimization
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button variant="contained" size="small" disabled fullWidth={isMobile} sx={{ textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, "&.Mui-disabled": { bgcolor: "#1e293b", color: "#64748b" } }}>
                            Calculating...
                        </Button>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}
