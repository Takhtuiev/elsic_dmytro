import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import {OPTIMIZER_BASE_CONFIG, OPTIMIZER_SETTINGS} from "./optimizer.config";


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

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString("uk-UA", { hour12: false });
}

function formatNumberWithNBSP(num) {
    if (num === null || num === undefined || !Number.isFinite(Number(num))) return "—";
    return Number(num).toLocaleString("en-US").replace(/\s/g, " ");
}

function formatParamValue(name, value) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);

    // Берем настройки из конфига, если они там есть
    const config = OPTIMIZER_BASE_CONFIG[name];

    if (config) {
        const digits = config.digits ?? 5; // Считаем 5 по умолчанию, если не задано
        const formattedValue = value.toFixed(digits);
        const unit = config.unit ? ` ${config.unit}` : ""; // Добавляем пробел перед единицей измерения

        return `${formattedValue}${unit}`;
    }

    // Фолбэк для параметров, которых нет в OPTIMIZER_BASE_CONFIG
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
                // Берем кастомный лейбл из OPTIMIZER_BASE_CONFIG, иначе фолбэк на PARAM_LABELS или имя ключа
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

function parseLogLine(line, candidateParams = null) {
    if (!line) return { type: "info", text: "", candidateParams: null };

    let type = "info";
    let text = String(line);

    if (/Load:/i.test(text)) {
        text = text.replace(/(Load:\s*)(\d+)/i, (_, prefix, num) =>
            `${prefix}${formatNumberWithNBSP(Number(num))}`
        );
    }

    if (/❌|🚨|error/i.test(text) && !/error\s*score/i.test(text)) {
        type = "error";
        text = text.replace(/[❌🚨]/g, "").trim();
    } else if (/⚠️|warn/i.test(text)) {
        type = "warning";
        text = text.replace(/⚠️/g, "").trim();
    } else if (/✅|🏆|success/i.test(text)) {
        type = "success";
        text = text.replace(/[✅🏆]/g, "").trim();
    } else if (/🧠|step/i.test(text)) {
        type = "step";
        text = text.replace(/🧠/g, "").trim();
    } else if (/🎲|init/i.test(text)) {
        type = "init";
        text = text.replace(/🎲/g, "").trim();
    } else if (/⏳|progress/i.test(text)) {
        type = "progress";
        text = text.replace(/⏳/g, "").trim();
    }

    return { type, text, candidateParams };
}

export function BayeusianLogDialog({ open, onClose, parentState, setParentState }) {
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

    const [bestScoreState, setBestScoreState] = useState({
        errorScore: "—",
        load: "—",
        params: null
    });

    const workerRef = useRef(null);
    const contentRef = useRef(null);
    const timeCacheRef = useRef(new Map());
    const startTimeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const isOptimizingRef = useRef(false);
    const autoScrollRef = useRef(true);

    const bestValidLoadRef = useRef(Infinity);
    const minErrorOverallRef = useRef(Infinity);
    const bestCandidateRef = useRef(null);
    const fallbackCandidateRef = useRef(null);

    const stopTimer = useCallback(() => {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        if (startTimeRef.current !== null) {
            setElapsedTime((performance.now() - startTimeRef.current) / 1000);
        }
        startTimeRef.current = null;
    }, []);

    const appendLog = useCallback((entry) => {
        setLogs(prev => [...prev, entry]);
    }, []);

    const updateBestMetricsOnFly = useCallback((text, candidateParams) => {
        const errorMatch = text.match(/Error score:\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i);
        const loadMatch = text.match(/(?:Нагрузка|Load):\s*([\d,.\s ]+)/i);

        if (!errorMatch || !loadMatch) return;

        const errorValue = Number(errorMatch[1]);
        const loadValue = Number(loadMatch[1].trim().replace(/[\s ,]/g, ""));

        if (!Number.isFinite(errorValue) || !Number.isFinite(loadValue)) return;

        const candidate = {
            error: errorValue,
            load: loadValue,
            params: candidateParams
        };

        let updated = false;
        if (errorValue <= OPTIMIZER_SETTINGS.maxErrorScore && loadValue < bestValidLoadRef.current) {
            bestValidLoadRef.current = loadValue;
            bestCandidateRef.current = candidate;
            updated = true;
        }

        if (errorValue < minErrorOverallRef.current) {
            minErrorOverallRef.current = errorValue;
            fallbackCandidateRef.current = candidate;
            updated = true;
        }

        if (updated) {
            const winner = bestCandidateRef.current || fallbackCandidateRef.current;
            setBestScoreState({
                errorScore: winner.error.toFixed(3),
                load: formatNumberWithNBSP(winner.load),
                params: winner.params || null
            });
        }
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

                const { status, data, percent, error, logMessage } = e.data || {};

                if (status === "progress_tick") {
                    const progress = Number(percent);
                    const validProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

                    const currentStep = e.data.currentExecutionCount !== undefined ? e.data.currentExecutionCount : 0;
                    const totalStepsBudget = e.data.totalIterations !== undefined ? e.data.totalIterations : OPTIMIZER_SETTINGS.totalBudgetIterations;

                    const currentStepVisual = currentStep;
                    const maxStepsVisual = totalStepsBudget;
                    const safeStepVisual = Math.min(maxStepsVisual, Math.max(0, currentStepVisual));

                    setCompletedSteps(safeStepVisual);
                    setProgressPercent(validProgress);

                    setLogs(prev => {
                        const isInitPhase = currentStep <= OPTIMIZER_SETTINGS.randomInitPoints;
                        const phaseLabel = isInitPhase ? "INIT" : "STEP";
                        const text = `⏳ [SOLVER]: ${phaseLabel} ${safeStepVisual}/${maxStepsVisual} | Progress: ${validProgress}%`;

                        const newEntry = { text, timestamp: getTimestamp() };

                        if (prev.length === 0) return [newEntry];

                        const last = prev[prev.length - 1];
                        if (last && String(last.text).includes("[SOLVER]")) {
                            return [...prev.slice(0, -1), newEntry];
                        }
                        return [...prev, newEntry];
                    });
                    return;
                }

                if (status === "log_step" && logMessage) {
                    setLogs(prev => {
                        if (prev.length === 0) return prev;
                        const last = prev[prev.length - 1];
                        if (last && String(last.text).includes("[SOLVER]")) {
                            return prev.slice(0, -1);
                        }
                        return prev;
                    });

                    const currentParams = e.data.candidateParams || e.data.params || null;
                    appendLog({
                        text: logMessage,
                        timestamp: getTimestamp(),
                        candidateParams: currentParams
                    });

                    updateBestMetricsOnFly(logMessage, currentParams);
                    return;
                }

                if (status === "success") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();
                    setProgressPercent(100);
                    setFinalResultReceived(true);

                    setCompletedSteps(OPTIMIZER_SETTINGS.totalBudgetIterations);

                    const limits = data?.optimalLimits || null;
                    const metrics = data?.metrics || {};

                    setParentState(prev => ({
                        ...prev,
                        simulation: {
                            ...prev.simulation,
                            accuracyMode: limits || prev.simulation.accuracyMode
                        }
                    }));

                    const cfg = OPTIMIZER_BASE_CONFIG;
                    const settings = OPTIMIZER_SETTINGS;
                    const achievedLoad = formatNumberWithNBSP(metrics.achievedLoad);
                    const maxLoad = formatNumberWithNBSP(settings.maxAllowedLoad);

                    const objectiveText = settings.optimizationObjective === "minimize_load"
                        ? "MAX SPEED (Minimize grid computational load)"
                        : "MAX ACCURACY (Minimize estimated error target)";

                    setBestScoreState({
                        errorScore: Number.isFinite(Number(metrics.resultingErrorScore)) ? Number(metrics.resultingErrorScore).toFixed(3) : "—",
                        load: achievedLoad,
                        params: limits
                    });

                    const summary = [
                        { text: "\n=======================================================", timestamp: getTimestamp() },
                        { text: "🏆 [OPTIMIZER]: FINAL TECHNICAL REPORT", timestamp: getTimestamp() },
                        { text: "=======================================================", timestamp: getTimestamp() },
                        {
                            text: metrics.isFallbackActivated
                                ? "⚠️ COMPROMISE: constraints not met. Balanced fallback used."
                                : "✅ SUCCESS: parameters matched to model criteria.",
                            timestamp: getTimestamp()
                        },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "🎯 INITIAL CRITERIA AND CONSTRAINTS:", timestamp: getTimestamp() },
                        { text: `   🔹 Task: ${objectiveText}`, timestamp: getTimestamp() },
                        { text: `   🔹 Max allowed error score: <= ${settings.maxErrorScore}`, timestamp: getTimestamp() },
                        { text: `   🔹 Max allowed load: <= ${maxLoad} computed nodes`, timestamp: getTimestamp() },
                        { text: `   🔹 Iterations budget: ${settings.totalBudgetIterations} (init: ${settings.randomInitPoints})`, timestamp: getTimestamp() },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "📊 ACHIEVED METRICS:", timestamp: getTimestamp() },
                        { text: `   📈 Resulting error score: ${Number.isFinite(Number(metrics.resultingErrorScore)) ? Number(metrics.resultingErrorScore).toFixed(3) : "—"}`, timestamp: getTimestamp() },
                        { text: `   ⚡ Computational grid load: ${achievedLoad} computed nodes`, timestamp: getTimestamp() },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "🛠️ OPTIMAL SOLVER CONFIGURATION:", timestamp: getTimestamp() },
                        ...Object.entries(cfg).map(([name, range]) => {
                            const value = limits?.[name];
                            const formatted = value === undefined || value === null
                                ? "—"
                                : typeof value === "number"
                                    ? value.toFixed(name === "tolerance" || ["gridX", "gridY", "minGrid"].includes(name) ? 5 : 2)
                                    : String(value);

                            const unit = ["gridX", "gridY", "minGrid"].includes(name)
                                ? " mm"
                                : name === "tolerance"
                                    ? " K"
                                    : ["maxDt", "targetDt"].includes(name)
                                        ? " s"
                                        : "";

                            return {
                                text: `   🔹 ${name}: ${formatted}${unit} [bounds: ${range.min} .. ${range.max}]`,
                                timestamp: getTimestamp()
                            };
                        }),
                        { text: "=======================================================", timestamp: getTimestamp() },
                        { text: "🏆 [Bayesian UI]: Optimization process completed.", timestamp: getTimestamp() }
                    ];

                    setLogs(prev => [...prev, ...summary]);
                    return;
                }

                if (status === "error") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();

                    appendLog({
                        text: `❌ [Bayesian UI]: Optimization error: ${error || "Unknown internal error"}`,
                        timestamp: getTimestamp()
                    });
                }
            };

            worker.onerror = (event) => {
                if (workerRef.current !== worker) return;
                isOptimizingRef.current = false;
                setIsOptimizing(false);
                stopTimer();
                appendLog({
                    text: `❌ Worker Error: ${event.message || "Failed to execute background task"}`,
                    timestamp: getTimestamp()
                });
            };
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                text: `❌ Failed to spawn background worker: ${err.message || err}`,
                timestamp: getTimestamp()
            });
        }
    }, [appendLog, stopTimer, setParentState, updateBestMetricsOnFly]); // FIXED dependency array: removed completedSteps

    useEffect(() => {
        initWorker();
        return () => {
            isOptimizingRef.current = false;
            workerRef.current?.terminate();
            clearInterval(timerIntervalRef.current);
        };
    }, [initWorker]);

    const runOptimization = useCallback(() => {
        if (!workerRef.current || isOptimizingRef.current) return;

        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;

        bestValidLoadRef.current = Infinity;
        minErrorOverallRef.current = Infinity;
        bestCandidateRef.current = null;
        fallbackCandidateRef.current = null;

        setCompletedSteps(0);
        setProgressPercent(0);
        setElapsedTime(0);
        setExpandedLogs({});
        setBestPanelExpanded(false);
        setFinalResultReceived(false);
        setWasAborted(false);
        setBestScoreState({ errorScore: "—", load: "—", params: null });
        timeCacheRef.current.clear();

        startTimeRef.current = performance.now();
        isOptimizingRef.current = true;
        setIsOptimizing(true);

        timerIntervalRef.current = setInterval(() => {
            if (startTimeRef.current !== null) {
                setElapsedTime((performance.now() - startTimeRef.current) / 1000);
            }
        }, 100);

        const startLog = {
            text: "🟢 [Bayesian Setup]: Started solver grid space optimization task...",
            timestamp: getTimestamp()
        };

        setLogs([startLog]);

        const thickness = Number(parentState.geometry?.thickness) || 0;
        const width = Number(parentState.geometry?.width) || 0;

        try {
            workerRef.current.postMessage({
                baseParams: {
                    thicknessMm: thickness,
                    material: { ...parentState.material },
                    machine: { ...parentState.machine },
                    simulation: {
                        ...parentState.simulation,
                        widthHalfMm: parentState.simulation.widthHalfMm !== undefined
                            ? parentState.simulation.widthHalfMm
                            : (width / 2 || 20)
                    }
                },
                options: {
                    ...OPTIMIZER_SETTINGS,
                    config: OPTIMIZER_BASE_CONFIG
                }
            });
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                text: `❌ Error spawning optimization: ${err.message || err}`,
                timestamp: getTimestamp()
            });
        }
    }, [parentState, appendLog, stopTimer]);

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
            text: "🚨 [SYSTEM_CRIT]: Optimization forcibly terminated by client instruction.",
            timestamp: getTimestamp()
        });

        initWorker();
    }, [initWorker, appendLog, stopTimer]);

    const processedLogs = useMemo(() => {
        return logs.map((item, idx) => {
            if (!item) return null;
            const rawText = typeof item === "object" ? item.text : item;
            if (!rawText) return null;

            let timestamp = typeof item === "object" ? item.timestamp : null;
            if (!timestamp) {
                const cacheKey = `${idx}_${rawText}`;
                if (!timeCacheRef.current.has(cacheKey)) {
                    timeCacheRef.current.set(cacheKey, getTimestamp());
                }
                timestamp = timeCacheRef.current.get(cacheKey);
            }

            return {
                ...parseLogLine(String(rawText), item.candidateParams || null),
                time: timestamp,
                raw: String(rawText),
                candidateParams: item.candidateParams || null
            };
        }).filter(Boolean);
    }, [logs]);

    useEffect(() => {
        const container = contentRef.current;
        if (container && autoScrollRef.current) {
            container.scrollTop = container.scrollHeight;
        }
    }, [logs]);

    const handleLogScroll = useCallback(() => {
        const container = contentRef.current;
        if (!container) return;
        autoScrollRef.current =
            container.scrollHeight - container.scrollTop - container.clientHeight <= 50;
    }, []);

    const stepProgressPercent = Math.min(
        100,
        Math.round((completedSteps / OPTIMIZER_SETTINGS.totalBudgetIterations) * 100)
    );

    const logTypeStyles = {
        info: { color: "#9cdcfe", label: "[INFO]" },
        success: { color: "#4ec9b0", label: "[SUCCESS]" },
        warning: { color: "#ce9178", label: "[WARN]" },
        error: { color: "#f44336", label: "[CRIT]" },
        step: { color: "#b5cea8", label: "[BAYES_CORE]" },
        init: { color: "#c586c0", label: "[INIT_GEN]" },
        progress: { color: "#6a9955", label: "[SOLVER_2D]" }
    };

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === "backdropClick") return;
                if (!isOptimizing) onClose?.();
            }}
            fullWidth
            maxWidth="md"
            disableEnforceFocus
            fullScreen={isMobile}
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: "#121417",
                        backgroundImage: "none",
                        borderRadius: isMobile ? 0 : 3,
                        border: isMobile ? "none" : "1px solid #2d3139",
                        boxShadow: "0px 20px 40px rgba(0,0,0,0.6)",
                        display: "flex",
                        flexDirection: "column",
                        height: isMobile ? "100%" : "max-content",
                        maxHeight: isMobile ? "100%" : "calc(100% - 64px)"
                    }
                }
            }}
        >
            <DialogTitle
                sx={{
                    m: 0,
                    px: pxSize,
                    py: 1.5,
                    bgcolor: "#1a1d24",
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                    flexShrink: 0,
                    minHeight: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5
                }}
            >
                <Box
                    sx={{
                        flexGrow: 1,
                        pr: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: 1
                    }}
                >
                    <TerminalIcon sx={{ color: "#2563eb", fontSize: "1.2rem", flexShrink: 0 }} />
                    <Typography
                        variant="subtitle1"
                        component="span"
                        sx={{
                            color: "#e2e8f0",
                            fontWeight: 600,
                            fontSize: isMobile ? "1.05rem" : "1.2rem",
                            letterSpacing: "0.3px"
                        }}
                    >
                        Bayesian Grid Optimization Monitor
                    </Typography>
                </Box>

                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    disabled={isOptimizing}
                    sx={{
                        p: 0.5,
                        color: "text.secondary",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            backgroundColor: "action.hover",
                            color: "text.primary"
                        }
                    }}
                >
                    <CloseIcon fontSize="medium" />
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    px: pxSize,
                    py: 2.5,
                    borderColor: "divider",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    flexGrow: isMobile ? 1 : 0,
                    overflowY: "auto"
                }}
            >
                <Box
                    sx={{
                        width: "100%",
                        bgcolor: "#181b22",
                        p: 1,
                        px: 1.5,
                        borderRadius: "6px",
                        border: "1px solid #282c34",
                        display: "flex",
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 1.5,
                        flexShrink: 0
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                        <Typography
                            variant="caption"
                            sx={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                        >
                            Total Optimization Progress
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                color: isOptimizing ? "#3b82f6" : "#f8fafc",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5
                            }}
                        >
                            <TimerIcon sx={{ fontSize: "0.9rem", opacity: 0.8 }} />
                            {formatTime(elapsedTime)}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1, width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end" }}>
                        <Typography
                            variant="caption"
                            sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}
                        >
                            {completedSteps}/{OPTIMIZER_SETTINGS.totalBudgetIterations}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={stepProgressPercent}
                            sx={{
                                height: 4,
                                width: "100%",
                                maxWidth: { sm: "300px", md: "400px" },
                                borderRadius: 2,
                                bgcolor: "#22252e",
                                "& .MuiLinearProgress-bar": {
                                    bgcolor: "#2563eb",
                                    borderRadius: 2
                                }
                            }}
                        />
                        <Typography
                            variant="caption"
                            sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}
                        >
                            {stepProgressPercent}%
                        </Typography>

                    </Box>
                </Box>

                {isOptimizing && (
                    <Box
                        sx={{
                            width: "100%",
                            bgcolor: "#14171c",
                            p: 1,
                            px: 1.5,
                            borderRadius: "6px",
                            border: "1px dashed rgba(37, 99, 235, 0.3)",
                            display: "flex",
                            alignItems: { xs: "stretch", sm: "center" },
                            justifyContent: "space-between",
                            flexDirection: { xs: "column", sm: "row" },
                            gap: 1,
                            flexShrink: 0
                        }}
                    >
                        <Typography
                            variant="caption"
                            sx={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.75rem" }}
                        >
                            ⏳ Current solver simulation progress...
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: "30%" } }}>
                            <LinearProgress
                                variant="determinate"
                                value={progressPercent}
                                sx={{
                                    height: 4,
                                    width: "100%",
                                    borderRadius: 2,
                                    bgcolor: "#22252e",
                                    "& .MuiLinearProgress-bar": { bgcolor: "#10b981" }
                                }}
                            />
                            <Typography
                                variant="caption"
                                sx={{ color: "#10b981", fontWeight: "bold", fontFamily: "monospace" }}
                            >
                                {progressPercent}%
                            </Typography>
                        </Box>
                    </Box>
                )}

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: "6px",
                        overflow: "hidden",
                        border: "1px solid #2d3139",
                        flexGrow: 1,
                        minHeight: 180
                    }}
                >
                    <Box
                        sx={{
                            bgcolor: "#181b22",
                            px: 2,
                            py: 0.8,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            borderBottom: "1px solid #2d3139",
                            flexShrink: 0
                        }}
                    >
                        <TerminalIcon sx={{ fontSize: "0.95rem", color: "#64748b" }} />
                        <Typography
                            variant="caption"
                            sx={{ color: "#94a3b8", fontFamily: "monospace", fontWeight: 600 }}
                        >
                            STDOUT / LOGS_STREAM
                        </Typography>
                    </Box>

                    <Box
                        ref={contentRef}
                        onScroll={handleLogScroll}
                        sx={{
                            bgcolor: "#0b0c10",
                            p: { xs: 1, sm: 2 },
                            fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                            fontSize: "0.8rem",
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            height: isMobile ? "100%" : "30vh",
                            overflowY: "auto",
                            lineHeight: 1.6,
                            flexGrow: 1
                        }}
                    >
                        {processedLogs.length === 0 ? (
                            <Typography
                                sx={{
                                    color: "#475569",
                                    fontFamily: "inherit",
                                    fontSize: "inherit",
                                    fontStyle: "italic",
                                    textAlign: "center",
                                    mt: 4
                                }}
                            >
                                Queue empty. Press "Start Optimization" to begin tracing execution thread.
                            </Typography>
                        ) : (
                            processedLogs.map((log, idx) => {
                                if (!log?.text) return null;

                                const style = logTypeStyles[log.type] || logTypeStyles.info;

                                if (log.text.includes("=====")) {
                                    return (
                                        <Divider
                                            key={idx}
                                            sx={{ borderColor: "rgba(255,255,255,0.05)", my: 1 }}
                                        />
                                    );
                                }

                                const hasParams = !!log.candidateParams;
                                const isExpanded = !!expandedLogs[idx];

                                return (
                                    <Box
                                        key={idx}
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            borderBottom: isExpanded ? "1px dashed rgba(255,255,255,0.1)" : "none",
                                            pb: isExpanded ? 1 : 0
                                        }}
                                    >
                                        <Box
                                            onClick={hasParams ? () => {
                                                setExpandedLogs(prev => ({
                                                    ...prev,
                                                    [idx]: !prev[idx]
                                                }));
                                            } : undefined}
                                            sx={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 1,
                                                py: 0.35,
                                                cursor: hasParams ? "pointer" : "default",
                                                borderRadius: "4px",
                                                px: 1,
                                                mx: -0.5,
                                                bgcolor: isExpanded ? "rgba(37, 99, 235, 0.03)" : "transparent",
                                                "&:hover": {
                                                    bgcolor: hasParams ? "rgba(255, 255, 255, 0.04)" : "transparent"
                                                }
                                            }}
                                        >
                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: "#475569",
                                                    fontSize: "inherit",
                                                    fontFamily: "inherit",
                                                    userSelect: "none",
                                                    flexShrink: 0
                                                }}
                                            >
                                                {log.time}
                                            </Typography>

                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: style.color,
                                                    fontWeight: "bold",
                                                    fontSize: "inherit",
                                                    fontFamily: "inherit",
                                                    minWidth: { xs: 0, sm: "100px" },
                                                    flexShrink: 0,
                                                    userSelect: "none",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5
                                                }}
                                            >
                                                {style.label}
                                                {hasParams && (
                                                    <Box
                                                        component="span"
                                                        sx={{ fontSize: "0.65rem", color: "#64748b" }}
                                                    >
                                                        {isExpanded ? "▲" : "▼"}
                                                    </Box>
                                                )}
                                            </Typography>

                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: log.type === "error"
                                                        ? "#ef4444"
                                                        : log.type === "warning"
                                                            ? "#f59e0b"
                                                            : "#cbd5e1",
                                                    fontSize: "inherit",
                                                    fontFamily: "inherit",
                                                    minWidth: 0
                                                }}
                                            >
                                                {log.text}
                                            </Typography>
                                        </Box>

                                        {hasParams && isExpanded && (
                                            <Box
                                                sx={{
                                                    ml: { xs: 1, sm: 3 },
                                                    pl: { xs: 1, sm: 2 },
                                                    pr: 1,
                                                    py: 1.5,
                                                    bgcolor: "#14171c",
                                                    borderRadius: "4px",
                                                    mt: 0.5,
                                                    mb: 0.5,
                                                    borderLeft: "3px solid #2563eb",
                                                    minWidth: 0
                                                }}
                                            >
                                                <ParameterGrid params={log.candidateParams} color="#10b981" />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        )}
                    </Box>
                </Box>

                {logs.length > 0 && (
                    <Card
                        sx={{
                            bgcolor: "#14171c",
                            border: "1px solid #2563eb",
                            borderRadius: "6px",
                            overflow: "hidden",
                            flexShrink: 0
                        }}
                    >
                        <Box
                            onClick={() => bestScoreState.params && setBestPanelExpanded(prev => !prev)}
                            sx={{
                                p: 1.5,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 1,
                                cursor: bestScoreState.params ? "pointer" : "default",
                                bgcolor: "rgba(37, 99, 235, 0.05)",
                                "&:hover": {
                                    bgcolor: bestScoreState.params
                                        ? "rgba(37, 99, 235, 0.08)"
                                        : "rgba(37, 99, 235, 0.05)"
                                }
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <LeaderboardIcon sx={{ color: "#10b981", fontSize: "1.1rem" }} />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "#cbd5e1",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px"
                                    }}
                                >
                                    {finalResultReceived
                                        ? "Final optimal layout configuration"
                                        : "Best snapshot configuration evaluated"}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: { xs: 1, sm: 3 },
                                    flexWrap: "wrap"
                                }}
                            >
                                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: "#94a3b8", fontFamily: "monospace" }}
                                    >
                                        Error Score:{" "}
                                        <Box component="span" sx={{ color: "#2563eb", fontWeight: "bold" }}>
                                            {bestScoreState.errorScore}
                                        </Box>
                                    </Typography>

                                    <Typography
                                        variant="caption"
                                        sx={{ color: "#94a3b8", fontFamily: "monospace" }}
                                    >
                                        Load:{" "}
                                        <Box component="span" sx={{ color: "#10b981", fontWeight: "bold" }}>
                                            {bestScoreState.load}
                                        </Box>
                                    </Typography>
                                </Box>

                                {bestScoreState.params && (
                                    <IconButton size="small" sx={{ color: "#64748b", p: 0 }}>
                                        {bestPanelExpanded
                                            ? <KeyboardArrowUpIcon fontSize="small" />
                                            : <KeyboardArrowDownIcon fontSize="small" />}
                                    </IconButton>
                                )}
                            </Box>
                        </Box>

                        <Collapse in={bestPanelExpanded && !!bestScoreState.params}>
                            <Box
                                sx={{
                                    p: { xs: 1.5, sm: 2 },
                                    pt: 1,
                                    borderTop: "1px dashed rgba(37, 99, 235, 0.2)",
                                    bgcolor: "#0d0f13"
                                }}
                            >
                                <ParameterGrid params={bestScoreState.params} />
                            </Box>
                        </Collapse>
                    </Card>
                )}
            </DialogContent>

            <DialogActions
                sx={{
                    px: pxSize,
                    py: 1.5,
                    m: 0,
                    gap: 1,
                    borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                    backgroundColor: "#1a1d24",
                    flexShrink: 0,
                    minHeight: "auto",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: "stretch"
                }}
            >
                <Box
                    sx={{
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: isOptimizing ? "#3b82f6" : wasAborted ? "#ef4444" : "#64748b",
                        fontSize: "0.7rem",
                        textAlign: isMobile ? "center" : "left",
                        mb: isMobile ? 1 : 0,
                        alignSelf: "center"
                    }}
                >
                    SYS_STATUS: {isOptimizing ? "RUNNING_OPTIMIZER_THREAD" : wasAborted ? "THREAD_TERMINATED_BY_USER" : finalResultReceived ? "OPTIMIZATION_COMPLETED" : "WORKER_THREAD_IDLE"}
                </Box>

                <Box
                    sx={{
                        display: "flex",
                        gap: 1,
                        width: isMobile ? "100%" : "auto",
                        flexDirection: isMobile ? "column-reverse" : "row",
                        justifyContent: "flex-end"
                    }}
                >
                    {isOptimizing && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={abortOptimization}
                            startIcon={<StopIcon />}
                            fullWidth={isMobile}
                            sx={{
                                color: "#f44336",
                                borderColor: "rgba(244, 67, 54, 0.4)",
                                textTransform: "none",
                                fontWeight: 500,
                                fontSize: "0.85rem",
                                px: 2,
                                borderRadius: isMobile ? 1.5 : 2,
                                "&:hover": {
                                    borderColor: "#f44336",
                                    bgcolor: "rgba(244, 67, 54, 0.06)"
                                }
                            }}
                        >
                            Abort Calculation
                        </Button>
                    )}

                    {!isOptimizing ? (
                        <>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onClose}
                                fullWidth={isMobile}
                                sx={{
                                    color: "#cbd5e1",
                                    borderColor: "#334155",
                                    textTransform: "none",
                                    fontWeight: 500,
                                    fontSize: "0.85rem",
                                    px: 3,
                                    borderRadius: isMobile ? 1.5 : 2,
                                    "&:hover": {
                                        borderColor: "#475569",
                                        bgcolor: "rgba(255,255,255,0.02)"
                                    }
                                }}
                            >
                                Close Window
                            </Button>

                            <Button
                                variant="contained"
                                size="small"
                                onClick={runOptimization}
                                startIcon={<PlayArrowIcon />}
                                fullWidth={isMobile}
                                sx={{
                                    bgcolor: "#10b981",
                                    color: "#ffffff",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    px: 3,
                                    borderRadius: isMobile ? 1.5 : 2,
                                    boxShadow: "none",
                                    "&:hover": { bgcolor: "#059669" }
                                }}
                            >
                                Start Optimization
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            size="small"
                            disabled
                            fullWidth={isMobile}
                            sx={{
                                textTransform: "none",
                                fontWeight: 500,
                                fontSize: "0.85rem",
                                px: 3,
                                borderRadius: isMobile ? 1.5 : 2,
                                "&.Mui-disabled": { bgcolor: "#1e293b", color: "#64748b" }
                            }}
                        >
                            Calculating...
                        </Button>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}