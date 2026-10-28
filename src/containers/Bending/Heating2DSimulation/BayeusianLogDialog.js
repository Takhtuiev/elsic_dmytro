import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, IconButton, LinearProgress, Divider, Grid, Card, Collapse,
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

const OPTIMIZER_BASE_CONFIG = {
    gridX: { min: 0.05, max: 0.85 },
    gridY: { min: 0.15, max: 2.50 },
    minGrid: { min: 0.003, max: 0.15 },
    maxIter: { min: 4, max: 24 },
    tolerance: { min: 0.001, max: 0.40 },
    maxDt: { min: 0.05, max: 4.0 },
    targetDt: { min: 0.02, max: 3.0 },
    growthFactor: { min: 1.01, max: 1.40 },
    shrinkFactor: { min: 0.45, max: 0.85 }
};

const OPTIMIZER_SETTINGS = {
    optimizationObjective: "minimize_load",
    maxErrorScore: 0.5,
    maxAllowedLoad: 1500000,
    totalBudgetIterations: 50,
    randomInitPoints: 10
};

const PARAM_LABELS = {
    gridX: "Шаг по толщине (gridX)",
    gridY: "Шаг по ширине (gridY)",
    minGrid: "Мин. ячейка сетки (minGrid)",
    targetDt: "Целевой шаг времени (targetDt)",
    maxDt: "Макс. шаг времени (maxDt)",
    growthFactor: "Коэф. расширения времени (growthFactor)",
    shrinkFactor: "Коэф. сжатия времени (shrinkFactor)",
    maxIter: "Итераций Пикара (maxIter)",
    tolerance: "Допуск сходимости (tolerance)"
};

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
    return now.toLocaleTimeString("ru-RU", { hour12: false }) +
        `.${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function formatNumberWithNBSP(num) {
    if (num === null || num === undefined || !Number.isFinite(Number(num))) return "—";
    return Number(num).toLocaleString("ru-RU").replace(/\s/g, "\u00A0");
}

function formatParamValue(name, value) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);
    if (["gridX", "gridY", "minGrid"].includes(name)) return `${value.toFixed(5)} мм`;
    if (name === "tolerance") return `${value.toFixed(5)} K`;
    if (["maxDt", "targetDt"].includes(name)) return `${value.toFixed(2)} с`;
    if (name === "maxIter") return `${parseInt(value, 10)} шагов`;
    if (["growthFactor", "shrinkFactor"].includes(name)) return value.toFixed(2);
    return value.toFixed(5);
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

    if (/❌|🚨|ошибка/i.test(text) || (/\berror\b/i.test(text) && !/error\s*score/i.test(text))) {
        type = "error";
        text = text.replace(/[❌🚨]/g, "").trim();
    } else if (/⚠️|внимание|warn/i.test(text)) {
        type = "warning";
        text = text.replace(/⚠️/g, "").trim();
    } else if (/✅|🏆|успех/i.test(text)) {
        type = "success";
        text = text.replace(/[✅🏆]/g, "").trim();
    } else if (/🧠|шаг/i.test(text)) {
        type = "step";
        text = text.replace(/🧠/g, "").trim();
    } else if (/🎲|старт/i.test(text)) {
        type = "init";
        text = text.replace(/🎲/g, "").trim();
    } else if (/⏳|прогресс/i.test(text)) {
        type = "progress";
        text = text.replace(/⏳/g, "").trim();
    }

    return { type, text, candidateParams };
}

function ParameterGrid({ params, color = "#e2e8f0" }) {
    if (!params || typeof params !== "object") return null;

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))"
                },
                gridAutoFlow: "row",
                gap: "4px 24px",
                minWidth: 0
            }}
        >
            {Object.entries(params).map(([name, value]) => (
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
                        pb: 0.5
                    }}
                >
                    <Box component="span" sx={{ color: "#64748b", overflowWrap: "anywhere" }}>
                        {PARAM_LABELS[name] || name}:
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
            ))}
        </Box>
    );
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
    const completedStepsRef = useRef(0);
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
        const loadMatch = text.match(/(?:Нагрузка|Load):\s*([\d,.\s\u00A0]+)/i);

        if (!errorMatch || !loadMatch) return;

        const errorValue = Number(errorMatch[1]);
        const loadValue = Number(loadMatch[1].trim().replace(/[\s\u00A0,]/g, ""));

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

                    // Извлекаем точные счетчики, которые прислал нам воркер
                    // Если по какой-то причине их нет в событии, аккуратно откатываемся на локальный реф
                    const currentStep = e.data.currentExecutionCount !== undefined ? e.data.currentExecutionCount : completedStepsRef.current;
                    const totalStepsBudget = e.data.totalIterations !== undefined ? e.data.totalIterations : OPTIMIZER_SETTINGS.totalBudgetIterations;

                    setProgressPercent(validProgress);

                    setLogs(prev => {
                        // Логика фаз остается прежней, но теперь опирается на железные данные от оптимизатора
                        const isInitPhase = currentStep < OPTIMIZER_SETTINGS.randomInitPoints;

                        // ВАЖНО: Так как оптимизатор передает currentExecutionCount начиная с 0 для первой итерации,
                        // мы делаем +1 только для отображения текущего выполняющегося шага. И жестко ограничиваем сверху через Math.min.
                        const currentStepVisual = isInitPhase
                            ? Math.min(OPTIMIZER_SETTINGS.randomInitPoints, currentStep + 1)
                            : Math.min(
                                totalStepsBudget - OPTIMIZER_SETTINGS.randomInitPoints,
                                currentStep - OPTIMIZER_SETTINGS.randomInitPoints + 1
                            );

                        const maxStepsVisual = isInitPhase
                            ? OPTIMIZER_SETTINGS.randomInitPoints
                            : totalStepsBudget - OPTIMIZER_SETTINGS.randomInitPoints;

                        const phaseLabel = isInitPhase ? "Старт" : "Шаг";

                        const text = `⏳ [Физический движок]: Симуляция [${phaseLabel} ${currentStepVisual}/${maxStepsVisual}]... Прогресс: ${validProgress}%`;
                        const newEntry = { text, timestamp: getTimestamp() };

                        if (prev.length === 0) return [newEntry];

                        const last = prev[prev.length - 1];
                        if (last && String(last.text).includes("[Физический движок]: Симуляция")) {
                            return [...prev.slice(0, -1), newEntry];
                        }
                        return [...prev, newEntry];
                    });
                    return;
                }

                if (status === "log_step" && logMessage) {
                    // Заменяем (удаляем) строку прогресса, если она была последней, прямо перед выводом результата
                    setLogs(prev => {
                        if (prev.length === 0) return prev;
                        const last = prev[prev.length - 1];
                        if (last && String(last.text).includes("[Физический движок]: Симуляция")) {
                            return prev.slice(0, -1);
                        }
                        return prev;
                    });

                    // И только после удаления строки прогресса инкрементируем шаг и пишем чистый результат
                    completedStepsRef.current += 1;
                    setCompletedSteps(completedStepsRef.current);

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
                        ? "МАКСИМАЛЬНАЯ СКОРОСТЬ (Минимизация вычислительной нагрузки сетки)"
                        : "МАКСИМАЛЬНАЯ ТОЧНОСТЬ (Минимизация оценочного критерия ошибки)";

                    setBestScoreState({
                        errorScore: Number.isFinite(Number(metrics.resultingErrorScore)) ? Number(metrics.resultingErrorScore).toFixed(3) : "—",
                        load: achievedLoad,
                        params: limits
                    });

                    const summary = [
                        { text: "\n=======================================================", timestamp: getTimestamp() },
                        { text: "🏆 [ОПТИМИЗАТОР]: ФИНАЛЬНЫЙ ТЕХНИЧЕСКИЙ ОТЧЁТ", timestamp: getTimestamp() },
                        { text: "=======================================================", timestamp: getTimestamp() },
                        {
                            text: metrics.isFallbackActivated
                                ? "⚠️ КОМПРОМИСС: ограничения не выполнены. Использован сбалансированный fallback."
                                : "✅ УСПЕХ: параметры подобраны под критерии модели.",
                            timestamp: getTimestamp()
                        },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "🎯 ИСХОДНЫЕ КРИТЕРИИ И ОГРАНИЧЕНИЯ:", timestamp: getTimestamp() },
                        { text: `   🔹 Задача: ${objectiveText}`, timestamp: getTimestamp() },
                        { text: `   🔹 Максимальный error score: <= ${settings.maxErrorScore}`, timestamp: getTimestamp() },
                        { text: `   🔹 Максимальная нагрузка: <= ${maxLoad} расчётных точек`, timestamp: getTimestamp() },
                        { text: `   🔹 Бюджет итераций: ${settings.totalBudgetIterations} (инициализация: ${settings.randomInitPoints})`, timestamp: getTimestamp() },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "📊 ДОСТИГНУТЫЕ ПОКАЗАТЕЛИ:", timestamp: getTimestamp() },
                        { text: `   📈 Итоговый error score: ${Number.isFinite(Number(metrics.resultingErrorScore)) ? Number(metrics.resultingErrorScore).toFixed(3) : "—"}`, timestamp: getTimestamp() },
                        { text: `   ⚡ Вычислительная нагрузка: ${achievedLoad} расчётных точек`, timestamp: getTimestamp() },
                        { text: "-------------------------------------------------------", timestamp: getTimestamp() },
                        { text: "🛠️ ОПТИМАЛЬНАЯ КОНФИГУРАЦИЯ SOLVER:", timestamp: getTimestamp() },
                        ...Object.entries(cfg).map(([name, range]) => {
                            const value = limits?.[name];
                            const formatted = value === undefined || value === null
                                ? "—"
                                : typeof value === "number"
                                    ? value.toFixed(name === "tolerance" || ["gridX", "gridY", "minGrid"].includes(name) ? 5 : 2)
                                    : String(value);

                            const unit = ["gridX", "gridY", "minGrid"].includes(name)
                                ? " мм"
                                : name === "tolerance"
                                    ? " K"
                                    : ["maxDt", "targetDt"].includes(name)
                                        ? " с"
                                        : "";

                            return {
                                text: `   🔹 ${name}: ${formatted}${unit} [границы: ${range.min} .. ${range.max}]`,
                                timestamp: getTimestamp()
                            };
                        }),
                        { text: "=======================================================", timestamp: getTimestamp() },
                        { text: "🏆 [Байесовский UI]: Оптимизация завершена.", timestamp: getTimestamp() }
                    ];

                    setLogs(prev => [...prev, ...summary]);
                    return;
                }

                if (status === "error") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();

                    appendLog({
                        text: `❌ [Байесовский UI]: Ошибка оптимизации: ${error || "Неизвестная ошибка"}`,
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
                    text: `❌ Ошибка Worker: ${event.message || "Не удалось выполнить Worker"}`,
                    timestamp: getTimestamp()
                });
            };
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                text: `❌ Не удалось создать Worker: ${err.message || err}`,
                timestamp: getTimestamp()
            });
        }
    }, [appendLog, stopTimer, setParentState, updateBestMetricsOnFly]);

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

        completedStepsRef.current = 0;
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
            text: "🟢 [Байесовский подбор]: Запущена задача оптимизации пространства сеток...",
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
                text: `❌ Ошибка запуска оптимизации: ${err.message || err}`,
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
            text: "🚨 [SYSTEM_CRIT]: Оптимизация принудительно прервана пользователем.",
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
                        Монитор Байесовской Оптимизации Расчётной Сетки
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
                <Grid container spacing={1.5} sx={{ flexShrink: 0 }}>
                    <Grid item xs={12} sm={8}>
                        <Card
                            sx={{
                                bgcolor: "#181b22",
                                border: "1px solid #282c34",
                                p: 1.5,
                                borderRadius: "6px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center"
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                    flexWrap: "wrap"
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{ color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}
                                >
                                    Общий прогресс оптимизации
                                </Typography>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 700 }}
                                >
                                    {completedSteps} / {OPTIMIZER_SETTINGS.totalBudgetIterations} шагов ({stepProgressPercent}%)
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={stepProgressPercent}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: "#22252e",
                                    "& .MuiLinearProgress-bar": {
                                        bgcolor: "#2563eb",
                                        borderRadius: 3
                                    }
                                }}
                            />
                        </Card>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                        <Card
                            sx={{
                                bgcolor: "#181b22",
                                border: "1px solid #282c34",
                                p: 1.5,
                                borderRadius: "6px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center"
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{
                                    color: "#64748b",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    mb: 0.5
                                }}
                            >
                                <TimerIcon sx={{ fontSize: "0.9rem" }} />
                                Время выполнения
                            </Typography>
                            <Typography
                                variant="h5"
                                sx={{
                                    color: isOptimizing ? "#3b82f6" : "#f8fafc",
                                    fontWeight: 700,
                                    fontFamily: "monospace",
                                    fontSize: "1.35rem"
                                }}
                            >
                                {formatTime(elapsedTime)}
                            </Typography>
                        </Card>
                    </Grid>
                </Grid>

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
                            ⏳ Прогресс текущей симуляции...
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
                                Поток пуст. Нажмите «Запустить оптимизацию» для старта процесса.
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
                                        ? "Итоговая оптимальная конфигурация"
                                        : "Лучшая конфигурация на текущий момент"}
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
                                        Нагрузка:{" "}
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
                            Прервать расчёт
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
                                Закрыть окно
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
                                Запустить оптимизацию
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
                            Идёт расчёт...
                        </Button>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}
