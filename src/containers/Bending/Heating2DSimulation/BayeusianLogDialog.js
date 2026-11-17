import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    IconButton,
    LinearProgress,
    Divider,
    Card,
    Collapse,
    useMediaQuery,
    useTheme
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TerminalIcon from "@mui/icons-material/Terminal";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import TimerIcon from "@mui/icons-material/Timer";
import LeaderboardIcon from "@mui/icons-material/Leaderboard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";

import {
    getAdaptiveOptimizerBudget,
    OPTIMIZER_TASKS,
    DEFAULT_TASK_ID,
    resolveOptimizerTask
} from "./optimizer.config";

import { downloadDiagnosticLog } from "./optimizerDiagnostics";

// ============================================================================
// 1. КОНСТАНТЫ И СТИЛИ UI
// ============================================================================

const LOG_TYPE_STYLES = {
    info: { color: "#cbd5e1", label: "" },
    success: { color: "#4ec9b0", label: "" },
    warning: { color: "#cbd5e1", label: "" },
    abort: { color: "#f97316", label: "[ABORT]" },
    error: { color: "#ef4444", label: "[CRIT]" },
    progress: { color: "#6a9955", label: "" },

    // Цвета режимов выполнения задачи (TASK MODE)
    final_report: { color: "#eab308" },
    bayes: { color: "#34d399" },
    random: { color: "#c586c0" },
    rand: { color: "#c586c0" },
    preset: { color: "#4ec9b0" },
    system: { color: "#38bdf8" }
};

const SYS_BOX_SX = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "8px 24px",
    pb: 1.25,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    width: "100%",
    fontFamily: "monospace",
    fontSize: "0.8rem"
};

const EMPTY_SNAPSHOT_STATE = {
    step: "—",
    solverRejected: "0",
    optimizerStep: "—",
    calcTime: "—",
    timeError: "—",
    gridError: "—",
    picardError: "—",
    linearResidual: null,
    picardIters: "—",
    params: null
};

// ============================================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ФОРМАТИРОВАНИЯ И ДАННЫХ
// ============================================================================

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
    return new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, "\u00A0");
}

function formatParamValue(name, value, taskParameters = {}) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);

    const config = taskParameters[name];
    if (config) {
        const digits = config.digits ?? 5;
        const formattedValue = value.toFixed(digits);
        const unit = config.unit ? ` ${config.unit}` : "";
        return `${formattedValue}${unit}`;
    }

    return value.toFixed(5);
}

function formatResidual(val) {
    if (!Number.isFinite(val)) return null;
    if (val === 0 || val < 1e-16) return "<1e-16";
    return val.toExponential(1);
}

function getCurrentTimestamp() {
    return new Date().toLocaleTimeString("uk-UA", { hour12: false });
}

function getStepModeColor(stepMode) {
    if (!stepMode) return LOG_TYPE_STYLES.system.color;
    const fullMode = String(stepMode).toLowerCase();
    const rootMode = fullMode.includes("_") ? fullMode.split("_")[0] : fullMode;
    return LOG_TYPE_STYLES[rootMode]?.color || LOG_TYPE_STYLES.system.color;
}

function formatMetricNumber(val, unit = "") {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return "—";
    const num = Number(val);
    const formatted = Math.abs(num) >= 10000
        ? formatNumberWithNBSP(Math.round(num))
        : (Number.isInteger(num) ? String(num) : num.toFixed(3));
    return unit ? `${formatted} ${unit}` : formatted;
}

function formatConstraintBound(c) {
    if (!c) return "";
    const fmt = (v) => (Math.abs(v) >= 10000 ? formatNumberWithNBSP(Math.round(v)) : String(v));
    const hasMin = Number.isFinite(c.min);
    const hasMax = Number.isFinite(c.max);
    if (hasMin && hasMax) return `[${fmt(c.min)}..${fmt(c.max)}]`;
    if (hasMax) return `≤ ${fmt(c.max)}`;
    if (hasMin) return `≥ ${fmt(c.min)}`;
    return "";
}

function extractTechnicalDetails(technicalMetrics) {
    if (!technicalMetrics) {
        return {
            loadVal: "—",
            calcTime: "—",
            hasAccuracy: false,
            tErr: "—",
            gErr: "—",
            pErr: "—",
            resVal: null,
            stepsSolver: "—",
            rejectedSolverSteps: "0",
            picard: "—"
        };
    }

    const { accuracy, iterations, calculationTimeMs } = technicalMetrics;

    return {
        loadVal: iterations?.totalGridPointsProcessed !== undefined
            ? formatNumberWithNBSP(iterations.totalGridPointsProcessed)
            : "—",
        calcTime: calculationTimeMs !== undefined ? `${calculationTimeMs.toFixed(1)} ms` : "—",
        hasAccuracy: accuracy?.totalErrorScore !== undefined,
        tErr: accuracy?.timeIntegrationErrorC !== undefined ? `${accuracy.timeIntegrationErrorC.toFixed(3)}°C` : "—",
        gErr: accuracy?.spatialGridErrorC !== undefined ? `${accuracy.spatialGridErrorC.toFixed(3)}°C` : "—",
        pErr: accuracy?.picardConvergenceErrorC !== undefined
            ? `${Math.abs(accuracy.picardConvergenceErrorC).toFixed(3)}°C`
            : "—",
        resVal: formatResidual(accuracy?.linearResidual),
        stepsSolver: iterations?.totalTimeSteps || "—",
        rejectedSolverSteps: iterations?.rejectedTimeSteps !== undefined ? String(iterations.rejectedTimeSteps) : "0",
        picard: iterations?.totalPicardIterations || "—"
    };
}

// ============================================================================
// 3. ВНУТРЕННИЕ UI-ПОДКОМПОНЕНТЫ (ДЛЯ ЧИТАЕМОСТИ RENDER-ДЕРЕВА)
// ============================================================================

function LogItemRow({ log, idx, isExpanded, onToggleExpand, taskParameters = {} }) {
    if (!log || !log.text) return null;

    if (typeof log.text === "string" && log.text.includes("=====")) {
        return <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", my: 1 }} />;
    }

    const hasParams = Boolean(log.candidateParams);
    const statusColor = LOG_TYPE_STYLES[log.type]?.color || LOG_TYPE_STYLES.success.color;
    const modeColor = getStepModeColor(log.stepMode);
    const details = extractTechnicalDetails(log.technicalMetrics);

    const summary = log.evaluationSummary || (log.finalMetricsCache ? {
        objective: {
            value: log.finalMetricsCache.achievedValue,
            goal: log.finalMetricsCache.appliedObjective,
            unit: ""
        },
        constraints: log.finalMetricsCache.constraints || []
    } : null);

    const renderLogMessage = () => {
        if (!log.candidateParams || !summary?.objective) return log.text;

        const objText = formatMetricNumber(summary.objective.value, summary.objective.unit);
        const constraintsList = Array.isArray(summary.constraints) ? summary.constraints : [];

        return (
            <>
                {log.text}{" "}
                <Box component="span" sx={{ fontWeight: 500 }}>
                    <Box component="span" sx={{ color: "#64748b", fontWeight: 400 }}>(obj=</Box>
                    {objText}
                    {constraintsList.map((c, i) => (
                        <React.Fragment key={i}>
                            <Box component="span" sx={{ color: "#64748b", fontWeight: 400 }}>, {c.name}=</Box>
                            <Box component="span" sx={{ color: c.feasible ? "inherit" : "#f97316" }}>
                                {formatMetricNumber(c.value)}
                            </Box>
                        </React.Fragment>
                    ))}
                    <Box component="span" sx={{ color: "#64748b", fontWeight: 400 }}>)</Box>
                </Box>
            </>
        );
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                borderBottom: isExpanded ? "1px dashed rgba(255,255,255,0.1)" : "none",
                pb: isExpanded ? 1 : 0,
                willChange: "transform, opacity",
                "@keyframes logFadeSlide": {
                    "0%": { opacity: 0, transform: "translateY(4px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" }
                },
                animation: "logFadeSlide 0.2s ease-out forwards"
            }}
        >
            {/* Основная строка лога */}
            <Box
                onClick={hasParams ? () => onToggleExpand(idx) : undefined}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 0.25,
                    cursor: hasParams ? "pointer" : "default",
                    borderRadius: "4px",
                    px: 1,
                    mx: -0.5,
                    fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                    bgcolor: isExpanded ? "rgba(37, 99, 235, 0.04)" : "transparent",
                    "&:hover": { bgcolor: hasParams ? "rgba(255, 255, 255, 0.04)" : "transparent" }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {hasParams && (
                        isExpanded
                            ? <KeyboardArrowDownIcon sx={{ fontSize: "1rem", color: "#64748b" }} />
                            : <KeyboardArrowRightIcon sx={{ fontSize: "1rem", color: "#64748b" }} />
                    )}
                </Box>

                {/* Номер шага */}
                <Typography
                    component="span"
                    sx={{
                        color: statusColor,
                        fontSize: "inherit",
                        fontFamily: "inherit",
                        userSelect: "none",
                        flexShrink: 0,
                        fontWeight: 500,
                        display: "inline-block"
                    }}
                >
                    {hasParams && !log.isFinalReportMarker
                        ? `step:${String(log.currentStepVisual !== undefined ? log.currentStepVisual : idx).padStart(2, "0")}`
                        : null}
                </Typography>

                {/* Режим задачи и текст сообщения */}
                <Typography
                    component="span"
                    sx={{
                        color: statusColor,
                        fontSize: "inherit",
                        fontFamily: "inherit",
                        minWidth: 0,
                        flexGrow: 1
                    }}
                >
                    <Box
                        component="span"
                        sx={{ color: modeColor, fontWeight: 600, userSelect: "none", mr: 1.5 }}
                    >
                        {log.stepMode ? `[${String(log.stepMode).toUpperCase()}]` : "[SYSTEM]"}
                    </Box>

                    <Box component="span" sx={{ color: statusColor }}>
                        {renderLogMessage()}
                    </Box>
                </Typography>
            </Box>

            {/* Раскрывающаяся панель деталей кандидата */}
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
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5
                    }}
                >
                    <Box
                        sx={{
                            width: "100%",
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            color: "#94a3b8",
                            pb: 1,
                            borderBottom: "1px dashed rgba(255,255,255,0.05)",
                            mb: 1
                        }}
                    >
                        {(log.type === "abort" || log.type === "error") && (
                            <Box sx={{ color: "#ef4444", fontWeight: "bold", mb: 0.5 }}>
                                🚨 CRITICAL EXCEPTION / VIOLATION: {log.message || "Simulation problem encountered. Candidate discarded."}
                            </Box>
                        )}

                        <Box>
                            Simulation calculation time: <strong style={{ color: "#ffffff" }}>{details.calcTime}</strong>
                        </Box>

                        {summary?.objective && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                                <span>
                                    Objective ({summary.objective.goal || "opt"}):{" "}
                                    <strong style={{ color: (log.type === "abort" || log.type === "error") ? "#ef4444" : "#38bdf8" }}>
                                        {formatMetricNumber(summary.objective.value, summary.objective.unit)}
                                    </strong>
                                </span>
                                {Array.isArray(summary.constraints) && summary.constraints.map((c, i) => (
                                    <span key={i}>
                                        {c.name}:{" "}
                                        <strong style={{ color: c.feasible ? "#10b981" : "#ef4444" }}>
                                            {formatMetricNumber(c.value)}
                                        </strong>
                                    </span>
                                ))}
                            </Box>
                        )}

                        {details.hasAccuracy && (
                            <Box sx={{ color: "#64748b" }}>
                                Solver accuracy: Time: {details.tErr}, Grid: {details.gErr}, Picard: {details.pErr}
                                {details.resVal !== null ? `, Residual: ${details.resVal}` : ""}
                            </Box>
                        )}

                        <Box>
                            Solver steps: <strong style={{ color: "#ffffff" }}>{details.stepsSolver}</strong>
                            <span style={{ color: Number(details.rejectedSolverSteps) > 0 ? "#ce9178" : "#64748b", marginLeft: 4 }}>
                                ({details.rejectedSolverSteps} rejected)
                            </span>
                            {" "}| Picard iterations: <strong style={{ color: "#ffffff" }}>{details.picard}</strong> | Computational load: <strong style={{ color: "#4ec9b0" }}>{details.loadVal} pts</strong>
                        </Box>
                    </Box>

                    <Box sx={{ width: "100%" }}>
                        <Box sx={{ ...SYS_BOX_SX, borderBottom: "none", pb: 0 }}>
                            {Object.entries(log.candidateParams).map(([name, value]) => {
                                const displayLabel = taskParameters[name]?.label || name;
                                return (
                                    <Typography key={name} variant="body2" color="#94a3b8" fontSize="0.75rem" sx={{ fontFamily: "inherit" }}>
                                        {displayLabel}: <strong style={{ color: "#10b981", fontWeight: 600 }}>{formatParamValue(name, value, taskParameters)}</strong>
                                    </Typography>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

function BestSnapshotCard({ bestSnapshotState, finalResultReceived, expanded, onToggleExpand, taskParameters = {} }) {
    const hasParams = Boolean(bestSnapshotState.params);

    return (
        <Card sx={{ bgcolor: "transparent", border: "none", boxShadow: "none", width: "100%", flexShrink: 0, overflow: "visible" }}>
            <Box
                onClick={hasParams ? onToggleExpand : undefined}
                sx={{
                    p: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                    cursor: hasParams ? "pointer" : "default",
                    bgcolor: "#14171c",
                    border: "1px solid #2563eb",
                    borderRadius: expanded ? "6px 6px 0 0" : "6px",
                    transition: "background-color 0.2s, border-radius 0.2s",
                    "&:hover": { bgcolor: hasParams ? "rgba(37, 99, 235, 0.04)" : "transparent" }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LeaderboardIcon sx={{ color: "#10b981", fontSize: "1.1rem" }} />
                    <Typography variant="caption" sx={{ color: "#cbd5e1", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {finalResultReceived ? "Final optimal configuration" : "Best step evaluation"}{" "}
                        <span style={{ color: "#38bdf8", fontWeight: 700 }}>{bestSnapshotState.optimizerStep}</span>
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 3 }, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                            Objective ({bestSnapshotState.goalLabel || "MIN"}):{" "}
                            <Box component="span" sx={{ color: "#38bdf8", fontWeight: "bold" }}>{bestSnapshotState.objectiveText || "—"}</Box>
                        </Typography>
                        {Array.isArray(bestSnapshotState.constraints) && bestSnapshotState.constraints.map((c, idx) => (
                            <Typography key={idx} variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                                {c.name}:{" "}
                                <Box component="span" sx={{ color: c.feasible ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                                    {formatMetricNumber(c.value)}
                                </Box>
                            </Typography>
                        ))}
                    </Box>

                    <Typography variant="caption" color="#64748b" sx={{ fontFamily: "inherit" }}>
                        Calculation time: <strong style={{ color: "#94a3b8" }}>{bestSnapshotState.calcTime}</strong>
                    </Typography>

                    {hasParams && (
                        <IconButton size="small" sx={{ color: "#64748b", p: 0 }}>
                            {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                        </IconButton>
                    )}
                </Box>
            </Box>

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                {hasParams && (
                    <Box
                        sx={{
                            width: "100%",
                            bgcolor: "#14171c",
                            borderRadius: "0 0 6px 6px",
                            border: "1px solid #2563eb",
                            borderTop: "none",
                            p: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                            boxSizing: "border-box"
                        }}
                    >
                        {bestSnapshotState.hasAccuracy && (
                            <Box sx={SYS_BOX_SX}>
                                <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                    Solver accuracy: Time: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.timeError}</strong>,
                                    Grid: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.gridError}</strong>,
                                    Picard: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.picardError}</strong>
                                    {bestSnapshotState.linearResidual !== null && (
                                        <>, Residual: <strong style={{ color: "#cbd5e1", fontWeight: 500 }}>{bestSnapshotState.linearResidual}</strong></>
                                    )}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={SYS_BOX_SX}>
                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                Solver steps: <strong style={{ color: "#f8fafc" }}>{bestSnapshotState.step}</strong>
                                <span style={{ color: Number(bestSnapshotState.solverRejected) > 0 ? "#ce9178" : "#64748b", marginLeft: 6, fontWeight: 600 }}>
                                    ({bestSnapshotState.solverRejected} rejected)
                                </span>
                            </Typography>

                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                Picard iterations:{" "}
                                <strong style={{ color: (Number(bestSnapshotState.picardIters) / (Number(bestSnapshotState.step) || 1)) > 5 ? "#f59e0b" : "#e2e8f0" }}>
                                    {bestSnapshotState.picardIters}
                                </strong>
                            </Typography>

                            <Typography variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                Computational load:{" "}
                                <strong style={{ color: "#10b981", fontWeight: 700 }}>
                                    {String(bestSnapshotState.load).includes("nodes") ? bestSnapshotState.load : `${bestSnapshotState.load} nodes`}
                                </strong>
                            </Typography>
                        </Box>

                        <Box sx={{ ...SYS_BOX_SX, borderBottom: "none", pb: 0 }}>
                            {Object.entries(bestSnapshotState.params).map(([name, value]) => {
                                const displayLabel = taskParameters[name]?.label || name;
                                return (
                                    <Typography key={name} variant="body2" color="#94a3b8" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                                        {displayLabel}: <strong style={{ color: "#38bdf8", fontWeight: 600 }}>{formatParamValue(name, value, taskParameters)}</strong>
                                    </Typography>
                                );
                            })}
                        </Box>
                    </Box>
                )}
            </Collapse>
        </Card>
    );
}

// ============================================================================
// 4. ОСНОВНОЙ КОМПОНЕНТ ДИАЛОГА ОПТИМИЗАЦИИ
// ============================================================================

export function BayeusianLogDialog({ open, onClose, parentState, setParentState }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const pxSize = isMobile ? 2 : 2.5;

    const [selectedTaskId, setSelectedTaskId] = useState(DEFAULT_TASK_ID);

    const activeTask = useMemo(() => {
        const thicknessMm = Number(parentState.geometry?.thickness) || 0;
        const widthHalfMm = parentState.simulation?.widthHalfMm !== undefined
            ? parentState.simulation.widthHalfMm
            : ((Number(parentState.geometry?.width) || 0) / 2 || 20);

        return resolveOptimizerTask(selectedTaskId, {
            thicknessMm,
            material: parentState.material,
            machine: parentState.machine,
            simulation: { ...parentState.simulation, widthHalfMm }
        });
    }, [selectedTaskId, parentState]);

    const defaultBudget = useMemo(
        () => getAdaptiveOptimizerBudget(activeTask),
        [activeTask]
    );

    // --- Состояние UI и процесса оптимизации ---
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isStoppingGracefully, setIsStoppingGracefully] = useState(false);
    const [finalResultReceived, setFinalResultReceived] = useState(false);
    const [wasAborted, setWasAborted] = useState(false);

    const [logs, setLogs] = useState([]);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [bestPanelExpanded, setBestPanelExpanded] = useState(false);
    const [bestLogIndex, setBestLogIndex] = useState(null);

    const [elapsedTime, setElapsedTime] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);
    const [completedSteps, setCompletedSteps] = useState(0);
    const [totalBudgetTarget, setTotalBudgetTarget] = useState(defaultBudget.totalIterations);

    // --- Ссылки (Refs) для работы с Web Worker и таймерами без лишних ререндеров ---
    const workerRef = useRef(null);
    const contentRef = useRef(null);
    const startTimeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const thinkingTimerRef = useRef(null);
    const isOptimizingRef = useRef(false);
    const autoScrollRef = useRef(true);
    const lastProgressUpdateRef = useRef(0);
    const completedStepsRef = useRef(0);
    const bestLogIndexRef = useRef(null);
    const logsRef = useRef([]);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    // --- Управление таймерами ---
    const startTimer = useCallback((initialOffsetSeconds = 0) => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        startTimeRef.current = performance.now() - initialOffsetSeconds * 1000;
        timerIntervalRef.current = setInterval(() => {
            if (startTimeRef.current !== null) {
                setElapsedTime((performance.now() - startTimeRef.current) / 1000);
            }
        }, 100);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (thinkingTimerRef.current) {
            clearTimeout(thinkingTimerRef.current);
            thinkingTimerRef.current = null;
        }
        if (startTimeRef.current !== null) {
            setElapsedTime((performance.now() - startTimeRef.current) / 1000);
        }
        startTimeRef.current = null;
    }, []);

    // --- Синхронизация лидера и добавление логов ---
    const syncLeaderIndex = useCallback((logsArray, bestStepNumber) => {
        if (bestStepNumber === undefined || bestStepNumber === null) return;

        let leaderLogIndex = -1;

        for (let i = logsArray.length - 1; i >= 0; i--) {
            const log = logsArray[i];
            if (!log || !log.candidateParams) continue;

            if (log.isFinalReportMarker && !log.isArchivedReport) {
                leaderLogIndex = i;
                break;
            }

            if (!log.isFinalReportMarker && log.currentStepVisual === bestStepNumber) {
                leaderLogIndex = i;
                break;
            }
        }

        if (leaderLogIndex !== -1) {
            bestLogIndexRef.current = leaderLogIndex;
            setTimeout(() => setBestLogIndex(leaderLogIndex), 0);
        }
    }, []);

    const appendLog = useCallback((entry) => {
        setLogs((prev) => {
            const nextLogs = [...prev];

            if (prev.length === 0) {
                nextLogs.push({ ...entry, id: entry.id || `log-${Date.now()}-${Math.random()}` });
            } else {
                const lastIdx = prev.length - 1;
                const lastLog = prev[lastIdx];

                if (lastLog && lastLog.type === "progress" && lastLog.currentStepVisual === entry.currentStepVisual) {
                    nextLogs[lastIdx] = { ...entry, id: lastLog.id };
                } else {
                    nextLogs.push({ ...entry, id: entry.id || `log-${Date.now()}-${Math.random()}` });
                }
            }

            syncLeaderIndex(nextLogs, entry.bestStepNumber);
            return nextLogs;
        });
    }, [syncLeaderIndex]);

    const updateProgressLogEntry = useCallback((isThinking, safeStepVisual, totalStepsBudget, validProgress, currentParams, activeMetrics) => {
        setLogs((prev) => {
            const isInitPhase = safeStepVisual <= defaultBudget.initPoints;
            const phaseLabel = isInitPhase ? "INIT" : "STEP";

            const prevLast = prev[prev.length - 1];
            const resolvedParams = currentParams || (prevLast?.currentStepVisual === safeStepVisual ? prevLast?.candidateParams : null);
            const resolvedMetrics = activeMetrics || (prevLast?.currentStepVisual === safeStepVisual ? prevLast?.technicalMetrics : null);

            const statusText = isThinking
                ? `🧠 [BAYES]: STEP ${safeStepVisual}/${totalStepsBudget} | Thinking...`
                : `⏳ [SOLVER]: ${phaseLabel} ${safeStepVisual}/${totalStepsBudget} | Progress: ${validProgress}%`;

            const newEntry = {
                type: "progress",
                text: statusText,
                timestamp: getCurrentTimestamp(),
                candidateParams: resolvedParams,
                technicalMetrics: resolvedMetrics,
                currentStepVisual: safeStepVisual
            };

            if (prev.length === 0) {
                return [{ ...newEntry, id: `log-${Date.now()}-${Math.random()}` }];
            }

            const lastIdx = prev.length - 1;
            const lastLog = prev[lastIdx];

            if (lastLog && lastLog.type === "progress" && lastLog.currentStepVisual === safeStepVisual) {
                const updated = [...prev];
                updated[lastIdx] = { ...newEntry, id: lastLog.id };
                return updated;
            }

            return [...prev, { ...newEntry, id: `log-${Date.now()}-${Math.random()}` }];
        });
    }, [defaultBudget.initPoints]);

    // --- Инициализация и обработчики Web Worker ---
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

                const { status, percent, error, logEntry } = e.data || {};

                // 1. Успешное завершение всей оптимизации
                if (status === "success" && e.data?.data) {
                    downloadDiagnosticLog(e.data.data.diagnosticLogText);
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    setIsStoppingGracefully(false);
                    stopTimer();
                    setFinalResultReceived(true);
                    setBestPanelExpanded(true);
                    return;
                }

                // 2. Промежуточный тик прогресса внутри шага
                if (status === "progress_tick") {
                    const isThinking = e.data.snapshotStatus === "THINKING";
                    const progress = Number(percent);
                    const validProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

                    const currentStep = e.data.currentExecutionCount ?? 0;
                    const totalStepsBudget = e.data.totalIterations ?? defaultBudget.totalIterations;
                    const safeStepVisual = Math.min(totalStepsBudget, Math.max(0, currentStep));

                    if (e.data.totalIterations !== undefined && Number.isFinite(e.data.totalIterations)) {
                        setTotalBudgetTarget(e.data.totalIterations);
                    }

                    const finishedStepsCount = Math.max(0, safeStepVisual - 1);
                    completedStepsRef.current = finishedStepsCount;
                    setCompletedSteps(finishedStepsCount);
                    setProgressPercent(isThinking ? 0 : validProgress);

                    syncLeaderIndex(logsRef.current, e.data.bestStepNumber);

                    if (!isThinking && thinkingTimerRef.current) {
                        clearTimeout(thinkingTimerRef.current);
                        thinkingTimerRef.current = null;
                    }

                    if (isThinking) {
                        if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
                        thinkingTimerRef.current = setTimeout(() => {
                            thinkingTimerRef.current = null;
                            updateProgressLogEntry(true, safeStepVisual, totalStepsBudget, 0, null, null);
                        }, 300);
                        return;
                    }

                    const now = performance.now();
                    if (now - lastProgressUpdateRef.current > 120 || validProgress === 100 || validProgress === 0) {
                        lastProgressUpdateRef.current = now;
                        updateProgressLogEntry(
                            false,
                            safeStepVisual,
                            totalStepsBudget,
                            validProgress,
                            e.data.currentParams,
                            e.data.technicalMetrics
                        );
                    }
                    return;
                }

                // 3. Завершённый шаг с записью в лог
                if (status === "log_step" && logEntry) {
                    if (thinkingTimerRef.current) {
                        clearTimeout(thinkingTimerRef.current);
                        thinkingTimerRef.current = null;
                    }

                    const normalizedLogEntry = (logEntry.type === "warning" && logEntry.candidateParams)
                        ? { ...logEntry, type: "info", text: "Simulation completed", message: null }
                        : logEntry;

                    if (normalizedLogEntry.isFinalReportMarker) {
                        setFinalResultReceived(true);
                        setProgressPercent(100);
                        if (completedStepsRef.current > 0) {
                            setTotalBudgetTarget(completedStepsRef.current);
                        }
                    } else {
                        completedStepsRef.current = normalizedLogEntry.currentStepVisual;
                        setProgressPercent(0);
                        setCompletedSteps(normalizedLogEntry.currentStepVisual);
                    }

                    appendLog(normalizedLogEntry);
                    return;
                }

                // 4. Ошибка внутри воркера
                if (status === "error") {
                    isOptimizingRef.current = false;
                    setIsOptimizing(false);
                    stopTimer();
                    appendLog({
                        type: "error",
                        text: `❌ [Bayesian UI]: Optimization error: ${error || "Unknown internal error"}`,
                        timestamp: getCurrentTimestamp()
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
                    timestamp: getCurrentTimestamp()
                });
            };
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                type: "error",
                text: `❌ Failed to spawn background worker: ${err.message || err}`,
                timestamp: getCurrentTimestamp()
            });
        }
    }, [appendLog, stopTimer, syncLeaderIndex, updateProgressLogEntry, defaultBudget.totalIterations]);

    useEffect(() => {
        initWorker();
        return () => {
            isOptimizingRef.current = false;
            workerRef.current?.terminate();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
        };
    }, [initWorker]);

    // --- Формирование конфигурации и управление задачами ---
    const buildWorkerPayload = useCallback((command) => {
        const thicknessMm = Number(parentState.geometry?.thickness) || 0;
        const widthHalfMm = parentState.simulation.widthHalfMm !== undefined
            ? parentState.simulation.widthHalfMm
            : ((Number(parentState.geometry?.width) || 0) / 2 || 20);

        const paramOverrides = Object.fromEntries(
            Object.entries(activeTask.parameters)
                .filter(([key]) => !(widthHalfMm === 0 && key === "gridDensityY"))
                .map(([key, { snap, step, ...rest }]) => [key, rest])
        );

        return {
            command,
            baseParams: {
                thicknessMm,
                material: { ...parentState.material },
                machine: { ...parentState.machine },
                simulation: {
                    ...parentState.simulation,
                    widthHalfMm
                }
            },
            options: {
                taskId: selectedTaskId,
                paramOverrides
            }
        };
    }, [parentState, activeTask, selectedTaskId]);

    const runOptimization = useCallback(() => {
        if (!workerRef.current || isOptimizingRef.current) return;

        bestLogIndexRef.current = null;
        completedStepsRef.current = 0;
        setCompletedSteps(0);
        setTotalBudgetTarget(defaultBudget.totalIterations);
        setProgressPercent(0);
        setElapsedTime(0);
        setExpandedLogs({});
        setBestPanelExpanded(false);
        setFinalResultReceived(false);
        setWasAborted(false);
        setIsStoppingGracefully(false);
        setBestLogIndex(null);

        isOptimizingRef.current = true;
        setIsOptimizing(true);
        startTimer(0);

        setLogs([{
            id: `log-start-${Date.now()}`,
            type: "info",
            text: "🟢 [Bayesian Setup]: Started solver grid space optimization task...",
            timestamp: getCurrentTimestamp()
        }]);

        try {
            workerRef.current.postMessage(buildWorkerPayload("start"));
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                type: "error",
                text: `❌ Error spawning optimization: ${err.message || err}`,
                timestamp: getCurrentTimestamp()
            });
        }
    }, [defaultBudget.totalIterations, buildWorkerPayload, startTimer, stopTimer, appendLog]);

    const continueOptimization = useCallback(() => {
        if (!workerRef.current || isOptimizingRef.current) return;

        const extraSteps = defaultBudget.totalIterations;
        setTotalBudgetTarget(completedStepsRef.current + extraSteps);
        setFinalResultReceived(false);
        setBestPanelExpanded(false);
        setIsStoppingGracefully(false);

        isOptimizingRef.current = true;
        setIsOptimizing(true);
        startTimer(elapsedTime);

        setLogs((prev) => {
            const updated = prev.map((item) =>
                item?.isFinalReportMarker ? { ...item, isArchivedReport: true } : item
            );

            const lastReport = [...prev].reverse().find((item) => item?.isFinalReportMarker);
            if (lastReport?.bestStepNumber !== undefined && lastReport?.bestStepNumber !== null) {
                syncLeaderIndex(updated, lastReport.bestStepNumber);
            }

            return updated;
        });

        try {
            workerRef.current.postMessage(buildWorkerPayload("continue"));
        } catch (err) {
            isOptimizingRef.current = false;
            setIsOptimizing(false);
            stopTimer();
            appendLog({
                type: "error",
                text: `❌ Error resuming optimization: ${err.message || err}`,
                timestamp: getCurrentTimestamp()
            });
        }
    }, [defaultBudget.totalIterations, elapsedTime, syncLeaderIndex, buildWorkerPayload, startTimer, stopTimer, appendLog]);

    const finishOptimizationNow = useCallback(() => {
        if (!workerRef.current || !isOptimizingRef.current || isStoppingGracefully) return;

        setIsStoppingGracefully(true);
        workerRef.current.postMessage({ command: "finish_now" });

        appendLog({
            type: "warning",
            text: "⏹️ [USER_STOP]: Finishing current step and finalizing best found configuration...",
            timestamp: getCurrentTimestamp()
        });
    }, [isStoppingGracefully, appendLog]);

    const abortOptimization = useCallback(() => {
        if (!isOptimizingRef.current) return;

        isOptimizingRef.current = false;
        setIsOptimizing(false);
        stopTimer();
        setProgressPercent(0);
        setWasAborted(true);
        setIsStoppingGracefully(false);

        workerRef.current?.terminate();
        workerRef.current = null;

        appendLog({
            type: "error",
            text: "🚨 [SYSTEM_CRIT]: Optimization forcibly terminated by client instruction.",
            timestamp: getCurrentTimestamp()
        });

        initWorker();
    }, [initWorker, appendLog, stopTimer]);

    // --- Расчёт показателей лучшего найденного решения ---
    const bestSnapshotState = useMemo(() => {
        const unit = activeTask.unit || "";
        const goalLabel = activeTask.goal === "max" ? "MAX" : "MIN";

        if (bestLogIndex === null || !logs[bestLogIndex]) {
            return {
                ...EMPTY_SNAPSHOT_STATE,
                objectiveText: "—",
                goalLabel,
                constraints: [],
                hasAccuracy: false
            };
        }

        const targetLog = logs[bestLogIndex];

        if (targetLog.isFinalReportMarker && targetLog.finalMetricsCache) {
            const m = targetLog.finalMetricsCache;
            const bestStepLog = targetLog.bestStepNumber !== undefined && targetLog.bestStepNumber !== null
                ? [...logs].reverse().find(
                    (l) => l && !l.isFinalReportMarker && l.currentStepVisual === targetLog.bestStepNumber && l.technicalMetrics
                )
                : null;

            const backupTm = bestStepLog?.technicalMetrics || [...logs]
                .reverse()
                .find((l) => l && l.technicalMetrics)?.technicalMetrics;

            const rawAchieved = m.achievedValue !== undefined
                ? Number(m.achievedValue)
                : (m.achievedLoad !== undefined ? Number(m.achievedLoad) : NaN);

            const stepLabel = targetLog.bestStepNumber !== undefined && targetLog.bestStepNumber !== null
                ? `#${targetLog.bestStepNumber}`
                : "FINAL";
            const stepCalcTimeMs = m?.calculationTimeMs ?? backupTm?.calculationTimeMs;

            return {
                objectiveText: formatMetricNumber(rawAchieved, unit),
                goalLabel,
                constraints: Array.isArray(m.constraints) ? m.constraints : (bestStepLog?.evaluationSummary?.constraints || []),
                hasAccuracy: backupTm?.accuracy?.totalErrorScore !== undefined,
                picardError: backupTm?.accuracy?.picardConvergenceErrorC !== undefined
                    ? `${Math.abs(backupTm.accuracy.picardConvergenceErrorC).toFixed(3)}°C`
                    : "—",
                linearResidual: formatResidual(backupTm?.accuracy?.linearResidual),
                load: backupTm?.iterations?.totalGridPointsProcessed !== undefined
                    ? formatNumberWithNBSP(backupTm.iterations.totalGridPointsProcessed)
                    : "—",
                step: m?.iterations?.totalTimeSteps !== undefined ? String(m.iterations.totalTimeSteps) : "—",
                solverRejected: m?.iterations?.rejectedTimeSteps !== undefined
                    ? String(m.iterations.rejectedTimeSteps)
                    : (backupTm?.iterations?.rejectedTimeSteps !== undefined ? String(backupTm.iterations.rejectedTimeSteps) : "0"),
                optimizerStep: stepLabel,
                calcTime: Number.isFinite(Number(stepCalcTimeMs)) ? `${Number(stepCalcTimeMs).toFixed(1)} ms` : "—",
                timeError: backupTm?.accuracy?.timeIntegrationErrorC !== undefined ? `${backupTm.accuracy.timeIntegrationErrorC.toFixed(3)}°C` : "—",
                gridError: backupTm?.accuracy?.spatialGridErrorC !== undefined ? `${backupTm.accuracy.spatialGridErrorC.toFixed(3)}°C` : "—",
                picardIters: m?.iterations?.totalPicardIterations !== undefined
                    ? String(m.iterations.totalPicardIterations)
                    : (backupTm?.iterations?.totalPicardIterations !== undefined ? String(backupTm.iterations.totalPicardIterations) : "—"),
                params: targetLog.candidateParams
            };
        }

        const tm = targetLog.technicalMetrics;
        const summary = targetLog.evaluationSummary;

        return {
            objectiveText: formatMetricNumber(summary?.objective?.value, summary?.objective?.unit || unit),
            goalLabel,
            constraints: Array.isArray(summary?.constraints) ? summary.constraints : [],
            hasAccuracy: tm?.accuracy?.totalErrorScore !== undefined,
            picardError: tm?.accuracy?.picardConvergenceErrorC !== undefined
                ? `${Math.abs(tm.accuracy.picardConvergenceErrorC).toFixed(3)}°C`
                : "—",
            linearResidual: formatResidual(tm?.accuracy?.linearResidual),
            load: tm?.iterations?.totalGridPointsProcessed !== undefined
                ? formatNumberWithNBSP(tm.iterations.totalGridPointsProcessed)
                : "—",
            step: tm?.iterations?.totalTimeSteps !== undefined ? String(tm.iterations.totalTimeSteps) : "—",
            solverRejected: tm?.iterations?.rejectedTimeSteps !== undefined ? String(tm.iterations.rejectedTimeSteps) : "0",
            optimizerStep: targetLog.currentStepVisual !== undefined ? `#${targetLog.currentStepVisual}` : "—",
            calcTime: tm?.calculationTimeMs !== undefined ? `${tm.calculationTimeMs.toFixed(1)} ms` : "—",
            timeError: tm?.accuracy?.timeIntegrationErrorC !== undefined ? `${tm.accuracy.timeIntegrationErrorC.toFixed(3)}°C` : "—",
            gridError: tm?.accuracy?.spatialGridErrorC !== undefined ? `${tm.accuracy.spatialGridErrorC.toFixed(3)}°C` : "—",
            picardIters: tm?.iterations?.totalPicardIterations !== undefined ? String(tm.iterations.totalPicardIterations) : "—",
            params: targetLog.candidateParams
        };
    }, [bestLogIndex, logs, activeTask]);

    const handleApplyParameters = useCallback(() => {
        if (!bestSnapshotState || !bestSnapshotState.params) return;

        setParentState((prev) => {
            let nextState = { ...prev };
            let isGridTask = false;

            for (const [key, val] of Object.entries(bestSnapshotState.params)) {
                const path = activeTask.parameters[key]?.path;
                if (!path) continue;

                if (path.startsWith("simulation.accuracyMode")) {
                    isGridTask = true;
                }

                const parts = path.split(".");
                let curr = nextState;
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    curr[part] = Array.isArray(curr[part]) ? [...curr[part]] : { ...(curr[part] || {}) };
                    curr = curr[part];
                }
                curr[parts[parts.length - 1]] = val;
            }

            if (isGridTask) {
                nextState.simulation = {
                    ...nextState.simulation,
                    accuracyMode: bestSnapshotState.params,
                    customAccuracyParams: bestSnapshotState.params
                };
            }

            return nextState;
        });

        onClose?.();
    }, [bestSnapshotState, activeTask, setParentState, onClose]);

    // --- Автопрокрутка консоли логов ---
    useEffect(() => {
        const container = contentRef.current;
        if (container && autoScrollRef.current) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth"
            });
        }
    }, [logs.length]);

    const handleLogScroll = useCallback(() => {
        const container = contentRef.current;
        if (!container) return;
        autoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 90;
    }, []);

    const handleToggleLogExpand = useCallback((idx) => {
        setExpandedLogs((prev) => ({ ...prev, [idx]: !prev[idx] }));
    }, []);

    // --- Расчёт общего прогресса ---
    const stepFraction = isOptimizing && !finalResultReceived ? (progressPercent / 100) : 0;
    const effectiveSteps = finalResultReceived
        ? totalBudgetTarget
        : Math.min(totalBudgetTarget, completedSteps + stepFraction);

    const rawTotalProgress = totalBudgetTarget > 0
        ? Math.min(100, (effectiveSteps / totalBudgetTarget) * 100)
        : 0;
    const stepProgressPercent = Math.round(rawTotalProgress);

    const sysStatusText = isOptimizing
        ? "RUNNING_OPTIMIZER_THREAD"
        : wasAborted
            ? "THREAD_TERMINATED_BY_USER"
            : finalResultReceived
                ? "OPTIMIZATION_COMPLETED"
                : "WORKER_THREAD_IDLE";

    const taskSpecConstraints = useMemo(() => {
        if (Array.isArray(bestSnapshotState.constraints) && bestSnapshotState.constraints.length > 0) {
            return bestSnapshotState.constraints;
        }
        try {
            const preview = activeTask.evaluateResult({}, parentState, null);
            return Array.isArray(preview?.constraints) ? preview.constraints : [];
        } catch {
            return [];
        }
    }, [bestSnapshotState.constraints, activeTask, parentState]);


    // --- Рендер ---
    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === "backdropClick") return;
                if (!isOptimizing) onClose?.();
            }}
            fullScreen
            disableEnforceFocus
            slotProps={{
                paper: {
                    sx: {
                        bgcolor: "#121417",
                        backgroundImage: "none",
                        borderRadius: 0,
                        border: "none",
                        boxShadow: "none",
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        maxHeight: "100%"
                    }
                }
            }}
        >
            {/* Заголовок окна */}
            <DialogTitle
                sx={{
                    m: 0,
                    px: pxSize,
                    py: 1.5,
                    bgcolor: "#1a1d24",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                    minHeight: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5
                }}
            >
                <Box sx={{ flexGrow: 1, pr: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 1 }}>
                    <TerminalIcon sx={{ color: "#2563eb", fontSize: "1.2rem", flexShrink: 0 }} />
                    <Typography variant="subtitle1" component="span" sx={{ color: "#e2e8f0", fontWeight: 600, fontSize: isMobile ? "1.05rem" : "1.2rem", letterSpacing: "0.3px" }}>
                        Bayesian Grid Optimization Monitor
                    </Typography>
                    <select
                        value={selectedTaskId}
                        disabled={isOptimizing}
                        onChange={(e) => {
                            setSelectedTaskId(e.target.value);
                            setLogs([]);
                            setBestLogIndex(null);
                            setFinalResultReceived(false);
                        }}
                        style={{
                            marginLeft: 12,
                            backgroundColor: "#0f172a",
                            color: "#e2e8f0",
                            border: "1px solid #334155",
                            borderRadius: "4px",
                            padding: "4px 8px",
                            fontSize: "0.85rem",
                            cursor: isOptimizing ? "not-allowed" : "pointer"
                        }}
                    >
                        {Object.values(OPTIMIZER_TASKS).map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.label}
                            </option>
                        ))}
                    </select>

                </Box>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    disabled={isOptimizing}
                    sx={{ p: 0.5, color: "text.secondary", transition: "all 0.2s ease-in-out", "&:hover": { backgroundColor: "action.hover", color: "text.primary" } }}
                >
                    <CloseIcon fontSize="medium" />
                </IconButton>
            </DialogTitle>

            {/* Основное содержимое */}
            <DialogContent sx={{ px: pxSize, py: 2.5, borderColor: "divider", display: "flex", flexDirection: "column", gap: 2, flexGrow: isMobile ? 1 : 0, overflowY: "auto" }}>
                {/* Общий прогресс оптимизации */}
                <Box sx={{ width: "100%", bgcolor: "#181b22", p: 1, px: 1.5, borderRadius: "6px", border: "1px solid #282c34", display: "flex", alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, flexShrink: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            Total Optimization Progress
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem" }}>
                            Goal:{" "}
                            <Box component="span" sx={{ color: "#38bdf8", fontWeight: 600 }}>
                                {(activeTask.goal || "min").toUpperCase()}{activeTask.unit ? ` (${activeTask.unit})` : ""}
                            </Box>
                            {taskSpecConstraints.length > 0 && (
                                <>
                                    {" | "}
                                    {taskSpecConstraints.map((c, idx) => (
                                        <React.Fragment key={c.name || idx}>
                                            {idx > 0 ? ", " : ""}
                                            <Box component="span" sx={{ color: "#94a3b8" }}>
                                                {c.name} {formatConstraintBound(c)}
                                            </Box>
                                        </React.Fragment>
                                    ))}
                                </>
                            )}
                        </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1, width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end" }}>
                        <Typography variant="caption" sx={{ color: isOptimizing ? "#3b82f6" : "#f8fafc", fontFamily: "monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}>
                            <TimerIcon sx={{ fontSize: "0.9rem", opacity: 0.8 }} />
                            {formatTime(elapsedTime)}
                        </Typography>

                        <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {completedSteps}/{totalBudgetTarget}
                        </Typography>

                        <LinearProgress
                            variant="determinate"
                            value={rawTotalProgress}
                            sx={{ height: 4, width: "100%", maxWidth: { sm: "300px", md: "400px" }, borderRadius: 2, bgcolor: "#22252e", "& .MuiLinearProgress-bar": { bgcolor: "#2563eb", borderRadius: 2, transition: "transform 0.3s ease-out" } }}
                        />

                        <Typography variant="caption" sx={{ color: "#2563eb", fontWeight: "bold", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                            {stepProgressPercent}%
                        </Typography>
                    </Box>
                </Box>

                {/* Прогресс текущей симуляции */}
                {isOptimizing && (
                    <Box sx={{ width: "100%", bgcolor: "#14171c", p: 1, px: 1.5, borderRadius: "6px", border: "1px dashed rgba(37, 99, 235, 0.3)", display: "flex", alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, gap: 1, flexShrink: 0 }}>
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.75rem" }}>
                            ⏳ Current solver simulation progress...
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: "30%" } }}>
                            <LinearProgress
                                variant="determinate"
                                value={progressPercent}
                                sx={{ height: 4, width: "100%", borderRadius: 2, bgcolor: "#22252e", "& .MuiLinearProgress-bar": { bgcolor: "#10b981", transition: "transform 0.25s cubic-bezier(0.1, 0.8, 0.25, 1)" } }}
                            />
                            <Typography variant="caption" sx={{ color: "#10b981", fontWeight: "bold", fontFamily: "monospace" }}>
                                {progressPercent}%
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Консоль вывода логов */}
                <Box sx={{ display: "flex", flexDirection: "column", borderRadius: "6px", overflow: "hidden", border: "1px solid #2d3139", flexGrow: 1, minHeight: 180 }}>
                    <Box sx={{ bgcolor: "#181b22", px: 2, py: 0.8, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid #2d3139", flexShrink: 0 }}>
                        <TerminalIcon sx={{ fontSize: "0.95rem", color: "#64748b" }} />
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace", fontWeight: 600 }}>
                            STDOUT / LOGS_STREAM
                        </Typography>
                        <Typography variant="body2" color="#64748b" fontSize="0.8rem" sx={{ fontFamily: "inherit" }}>
                            Task: <strong style={{ color: "#94a3b8" }}>{activeTask.label}</strong>
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
                            height: isMobile ? "100%" : "50vh",
                            overflowY: "auto",
                            lineHeight: 1.6,
                            flexGrow: 1
                        }}
                    >
                        {logs.length === 0 ? (
                            <Typography sx={{ color: "#475569", fontFamily: "inherit", fontSize: "inherit", fontStyle: "italic", textAlign: "center", mt: 4 }}>
                                Queue empty. Press "Start Optimization" to begin tracing execution thread.
                            </Typography>
                        ) : (
                            logs.map((log, idx) => (
                                <LogItemRow
                                    key={log?.id || idx}
                                    log={log}
                                    idx={idx}
                                    isExpanded={Boolean(expandedLogs[idx])}
                                    onToggleExpand={handleToggleLogExpand}
                                    taskParameters={activeTask.parameters}
                                />
                            ))
                        )}
                    </Box>
                </Box>

                {/* Карточка лучшего найденного решения */}
                {logs.length > 0 && (
                    <BestSnapshotCard
                        bestSnapshotState={bestSnapshotState}
                        finalResultReceived={finalResultReceived}
                        expanded={bestPanelExpanded}
                        onToggleExpand={() => setBestPanelExpanded((prev) => !prev)}
                        taskParameters={activeTask.parameters}
                    />
                )}
            </DialogContent>

            {/* Нижняя панель статуса и управления */}
            <DialogActions sx={{ px: pxSize, py: 1.5, m: 0, gap: 1, borderTop: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#1a1d24", flexShrink: 0, minHeight: "auto", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: "stretch" }}>
                <Box sx={{ fontFamily: "monospace", fontWeight: 600, color: isOptimizing ? "#3b82f6" : wasAborted ? "#ef4444" : "#64748b", fontSize: "0.7rem", textAlign: isMobile ? "center" : "left", mb: isMobile ? 1 : 0, alignSelf: "center" }}>
                    SYS_STATUS: {sysStatusText}
                </Box>

                <Box sx={{ display: "flex", gap: 1, width: isMobile ? "100%" : "auto", flexDirection: isMobile ? "column-reverse" : "row", justifyContent: "flex-end" }}>
                    {isOptimizing ? (
                        <>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={finishOptimizationNow}
                                disabled={isStoppingGracefully}
                                startIcon={<StopIcon />}
                                fullWidth={isMobile}
                                sx={{ color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.4)", textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 2, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#f59e0b", bgcolor: "rgba(245, 158, 11, 0.06)" } }}
                            >
                                {isStoppingGracefully ? "Finishing..." : "Finish & Keep Best"}
                            </Button>

                            <Button
                                variant="outlined"
                                size="small"
                                onClick={abortOptimization}
                                fullWidth={isMobile}
                                sx={{ color: "#f44336", borderColor: "rgba(244, 67, 54, 0.4)", textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 2, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#f44336", bgcolor: "rgba(244, 67, 54, 0.06)" } }}
                            >
                                Abort Calculation
                            </Button>

                            <Button
                                variant="contained"
                                size="small"
                                disabled
                                fullWidth={isMobile}
                                sx={{ textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, "&.Mui-disabled": { bgcolor: "#1e293b", color: "#64748b" } }}
                            >
                                {isStoppingGracefully ? "Finalizing..." : "Calculating..."}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onClose}
                                fullWidth={isMobile}
                                sx={{ color: "#cbd5e1", borderColor: "#334155", textTransform: "none", fontWeight: 500, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#475569", bgcolor: "rgba(255,255,255,0.02)" } }}
                            >
                                {finalResultReceived ? "Discard & Close" : "Close Window"}
                            </Button>

                            {finalResultReceived && (
                                <>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={continueOptimization}
                                        startIcon={<PlayArrowIcon />}
                                        fullWidth={isMobile}
                                        sx={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)", textTransform: "none", fontWeight: 600, fontSize: "0.85rem", px: 2.5, borderRadius: isMobile ? 1.5 : 2, "&:hover": { borderColor: "#38bdf8", bgcolor: "rgba(56, 189, 248, 0.06)" } }}
                                    >
                                        Continue (+{defaultBudget.totalIterations})
                                    </Button>

                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleApplyParameters}
                                        disabled={!bestSnapshotState || !bestSnapshotState.params}
                                        fullWidth={isMobile}
                                        sx={{ bgcolor: "#2563eb", color: "#ffffff", textTransform: "none", fontWeight: 600, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, boxShadow: "none", "&:hover": { bgcolor: "#1d4ed8" }, "&.Mui-disabled": { bgcolor: "#1e293b", color: "#64748b" } }}
                                    >
                                        Apply Parameters
                                    </Button>
                                </>
                            )}

                            <Button
                                variant="contained"
                                size="small"
                                onClick={runOptimization}
                                startIcon={<PlayArrowIcon />}
                                fullWidth={isMobile}
                                sx={{ bgcolor: "#10b981", color: "#ffffff", textTransform: "none", fontWeight: 600, fontSize: "0.85rem", px: 3, borderRadius: isMobile ? 1.5 : 2, boxShadow: "none", "&:hover": { bgcolor: "#059669" } }}
                            >
                                {finalResultReceived || wasAborted ? "Run Again" : "Start Optimization"}
                            </Button>
                        </>
                    )}
                </Box>
            </DialogActions>
        </Dialog>
    );
}
