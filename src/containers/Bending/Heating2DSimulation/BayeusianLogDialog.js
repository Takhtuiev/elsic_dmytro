import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    IconButton,
    LinearProgress,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckIcon from "@mui/icons-material/Check";
import BlockIcon from "@mui/icons-material/Block";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import TuneIcon from "@mui/icons-material/Tune";

import {
    DEFAULT_TASK_ID,
    getAdaptiveOptimizerBudget,
    getApplicableTasks,
    resolveOptimizerTask
} from "./optimizer.config";
import { downloadDiagnosticLog } from "./optimizerDiagnostics";

// ============================================================================
// 1. ОФОРМЛЕНИЕ
// Тёмная «инженерная» палитра: нейтральный фон, один акцентный цвет,
// семантические цвета только для статусов. Все числа — моноширинные и табличные.
// ============================================================================

const C = {
    bg: "#0d1015",
    panel: "#141820",
    panelAlt: "#181d26",
    border: "#252b36",
    borderStrong: "#323a48",
    text: "#dfe4ec",
    textDim: "#9aa4b4",
    textMute: "#6b7585",
    accent: "#4f8ff7",
    ok: "#2fbf71",
    warn: "#f0a531",
    err: "#ef5350",
    abort: "#f97316"
};

const MONO = "'JetBrains Mono', 'SFMono-Regular', Consolas, Menlo, monospace";
const NUM_SX = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" };

const MODE_COLORS = {
    final: "#eab308",
    bayes: "#34d399",
    random: "#c586c0",
    preset: "#4ec9b0",
    system: "#38bdf8",
    fallback: "#c586c0",
    init: "#c586c0"
};

const STATUS_META = {
    idle: { label: "Ready", color: C.textMute },
    running: { label: "Running", color: C.accent },
    stopping: { label: "Finishing", color: C.warn },
    done: { label: "Completed", color: C.ok },
    aborted: { label: "Aborted", color: C.err },
    error: { label: "Error", color: C.err }
};

const panelSx = {
    bgcolor: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    minWidth: 0
};

const sectionTitleSx = {
    color: C.textMute,
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
};

// ============================================================================
// 2. ФОРМАТИРОВАНИЕ
// ============================================================================

export const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, "0")}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
};

const groupDigits = (num) => new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, "\u00A0");

// Число знаков после запятой по шагу параметра (0.1 → 1, 0.01 → 2, 0.4151 → 4)
function digitsForStep(step) {
    if (!Number.isFinite(step) || step <= 0) return 3;
    for (let d = 0; d <= 6; d++) {
        if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
    }
    return 4;
}

function formatNumber(val, unit = "") {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return "—";
    const num = Number(val);
    const abs = Math.abs(num);
    let text;
    if (abs >= 10000) text = groupDigits(Math.round(num));
    else if (Number.isInteger(num)) text = String(num);
    else if (abs >= 100) text = num.toFixed(2);
    else if (abs >= 1) text = num.toFixed(3);
    else text = num.toFixed(4);
    return unit ? `${text}\u00A0${unit}` : text;
}

function formatParamValue(name, value, taskParameters) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);
    const cfg = taskParameters?.[name];
    const digits = cfg?.digits ?? digitsForStep(cfg?.step);
    const text = value.toFixed(digits);
    return cfg?.unit ? `${text}\u00A0${cfg.unit}` : text;
}

function formatBound(c) {
    if (!c) return "";
    const fmt = (v) => (Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(2)}\u00A0M` : Math.abs(v) >= 10000 ? groupDigits(Math.round(v)) : String(v));
    const hasMin = Number.isFinite(c.min);
    const hasMax = Number.isFinite(c.max);
    if (hasMin && hasMax) return `[${fmt(c.min)}…${fmt(c.max)}]`;
    if (hasMax) return `≤ ${fmt(c.max)}`;
    if (hasMin) return `≥ ${fmt(c.min)}`;
    return "";
}

function formatResidual(val) {
    if (!Number.isFinite(val)) return null;
    if (val < 1e-16) return "<1e-16";
    return val.toExponential(1);
}

const formatErr = (v) => (Number.isFinite(v) ? `${Math.abs(v).toFixed(3)}\u00A0°C` : "—");

function extractSolverDetails(tm) {
    const acc = tm?.accuracy;
    const it = tm?.iterations;
    return {
        calcTime: Number.isFinite(tm?.calculationTimeMs) ? `${tm.calculationTimeMs.toFixed(1)}\u00A0ms` : "—",
        hasAccuracy: Number.isFinite(acc?.totalErrorScore),
        timeErr: formatErr(acc?.timeIntegrationErrorC),
        gridErr: formatErr(acc?.spatialGridErrorC),
        picardErr: formatErr(acc?.picardConvergenceErrorC),
        residual: formatResidual(acc?.linearResidual),
        steps: it?.totalTimeSteps ?? "—",
        rejected: it?.rejectedTimeSteps ?? 0,
        picardIters: it?.totalPicardIterations ?? "—",
        load: Number.isFinite(it?.totalGridPointsProcessed) ? groupDigits(it.totalGridPointsProcessed) : "—"
    };
}

// Подпись и единица метрики задачи (cpuLoad → «Load», ops)
const metricInfo = (task, name) => task?.metricsInfo?.[name] || { label: name || "Objective", unit: "" };

// Значение метрики для крупного показа: большие числа — в миллионах/тысячах
function formatMetric(value, unit = "") {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return { text: "—", unit: "" };
    const v = Number(value);
    const abs = Math.abs(v);
    if (abs >= 1e6) return { text: (v / 1e6).toFixed(abs >= 1e8 ? 1 : 2), unit: `M${unit ? ` ${unit}` : ""}` };
    if (abs >= 1e4) return { text: (v / 1e3).toFixed(1), unit: `k${unit ? ` ${unit}` : ""}` };
    return { text: formatNumber(v), unit };
}
const metricText = (value, unit) => {
    const f = formatMetric(value, unit);
    return f.unit ? `${f.text} ${f.unit}` : f.text;
};

// Значения совпадают (метрика задачи и тот же показатель решателя)
const sameValue = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// Эмодзи в начале сообщений оптимизатора в инженерном журнале не нужны
const cleanText = (text) => String(text ?? "").replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "");

const timestamp = () => new Date().toLocaleTimeString("uk-UA", { hour12: false });
let logIdCounter = 0;
const nextLogId = () => `log-${Date.now()}-${++logIdCounter}`;

const modeColor = (stepMode) => {
    const root = String(stepMode || "system").toLowerCase().split("_")[0];
    return MODE_COLORS[root] || MODE_COLORS.system;
};

// ============================================================================
// 3. МЕЛКИЕ КОМПОНЕНТЫ
// ============================================================================

// Таймер обновляет только сам себя, а не весь диалог
const ElapsedTimer = memo(function ElapsedTimer({ startedAt, baseSeconds, running }) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!running) return undefined;
        const id = setInterval(() => setTick((t) => t + 1), 250);
        return () => clearInterval(id);
    }, [running]);
    const seconds = baseSeconds + (running && startedAt !== null ? (performance.now() - startedAt) / 1000 : 0);
    return (
        <Box component="span" sx={{ ...NUM_SX, display: "inline-flex", alignItems: "center", gap: 0.5, color: running ? C.accent : C.textDim }}>
            <TimerOutlinedIcon sx={{ fontSize: "0.95rem" }} />
            {formatTime(seconds)}
        </Box>
    );
});

function KeyValue({ label, value, color = C.text }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, py: 0.35, minWidth: 0 }}>
            <Typography component="span" sx={{ color: C.textDim, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{label}</Typography>
            <Typography component="span" sx={{ ...NUM_SX, color, fontSize: "0.78rem", fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>
                {value}
            </Typography>
        </Box>
    );
}

// Ширина контейнера — чтобы график рисовался в настоящих пикселях
function useElementWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        setWidth(el.clientWidth);
        if (typeof ResizeObserver === "undefined") return undefined;
        const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
}

// ============================================================================
// 4. ГРАФИК СХОДИМОСТИ
// Точки — значения цели по шагам (закрашенные — допустимые, контурные — нарушают
// ограничения), ступенчатая линия — лучшее найденное значение.
// ============================================================================

const ConvergenceChart = memo(function ConvergenceChart({ points, goal, unit, bestStep, height = 200 }) {
    const [ref, width] = useElementWidth();
    const [hover, setHover] = useState(null);

    const model = useMemo(() => {
        const valid = points.filter((p) => Number.isFinite(p.value));
        if (valid.length === 0 || width < 60) return null;
        const values = valid.map((p) => p.value);
        let yMin = Math.min(...values);
        let yMax = Math.max(...values);
        // Логарифмическая шкала, если значения различаются больше чем в 30 раз
        const useLog = yMin > 0 && yMax / yMin > 30;
        const tf = useLog ? Math.log10 : (v) => v;
        let lo = tf(yMin);
        let hi = tf(yMax);
        if (hi - lo < 1e-12) {
            const pad = Math.abs(hi) * 0.01 || 1;
            lo -= pad;
            hi += pad;
        }
        const padY = (hi - lo) * 0.08;
        lo -= padY;
        hi += padY;
        const maxStep = Math.max(...valid.map((p) => p.step), 2);
        const minStep = Math.min(...valid.map((p) => p.step), 1);
        const m = { l: 62, r: 12, t: 12, b: 24 };
        const plotW = Math.max(10, width - m.l - m.r);
        const plotH = height - m.t - m.b;
        const x = (s) => m.l + ((s - minStep) / Math.max(1, maxStep - minStep)) * plotW;
        const y = (v) => m.t + (1 - (tf(v) - lo) / (hi - lo)) * plotH;

        // Лучшее значение по ходу поиска (только допустимые точки)
        const better = (a, b) => (goal === "max" ? a > b : a < b);
        let best = null;
        const bestPath = [];
        for (const p of [...valid].sort((a, b) => a.step - b.step)) {
            if (p.feasible && (best === null || better(p.value, best))) best = p.value;
            if (best !== null) bestPath.push([x(p.step), y(best)]);
        }
        const pathD = bestPath.map(([px, py], i) => {
            if (i === 0) return `M${px},${py}`;
            return `H${px}V${py}`;
        }).join("");

        const ticks = [0, 0.5, 1].map((f) => {
            const tv = lo + padY + f * (hi - lo - 2 * padY);
            const v = useLog ? 10 ** tv : tv;
            return { v, py: y(v) };
        });
        return { valid, x, y, m, plotW, plotH, pathD, ticks, maxStep, minStep, useLog };
    }, [points, width, height, goal]);

    const onMove = useCallback((e) => {
        if (!model) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        let nearest = null;
        let dist = Infinity;
        for (const p of model.valid) {
            const d = Math.abs(model.x(p.step) - mx);
            if (d < dist) {
                dist = d;
                nearest = p;
            }
        }
        setHover(dist < 24 ? nearest : null);
    }, [model]);

    return (
        <Box ref={ref} sx={{ position: "relative", width: "100%", height }}>
            {!model ? (
                <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMute, fontSize: "0.8rem" }}>
                    The convergence plot appears after the first evaluations
                </Box>
            ) : (
                <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
                    {model.ticks.map((t, i) => (
                        <g key={i}>
                            <line x1={model.m.l} x2={model.m.l + model.plotW} y1={t.py} y2={t.py} stroke={C.border} strokeDasharray="3 4" />
                            <text x={model.m.l - 8} y={t.py + 4} textAnchor="end" fill={C.textMute} fontSize="10" fontFamily={MONO}>
                                {metricText(t.v)}
                            </text>
                        </g>
                    ))}
                    <text x={model.m.l} y={height - 6} fill={C.textMute} fontSize="10" fontFamily={MONO}>#{model.minStep}</text>
                    <text x={model.m.l + model.plotW} y={height - 6} textAnchor="end" fill={C.textMute} fontSize="10" fontFamily={MONO}>
                        #{model.maxStep}{model.useLog ? " · log" : ""}
                    </text>
                    <path d={model.pathD} fill="none" stroke={C.ok} strokeWidth="2" />
                    {model.valid.map((p) => (
                        <circle
                            key={p.step}
                            cx={model.x(p.step)}
                            cy={model.y(p.value)}
                            r={p.step === bestStep ? 5 : 3}
                            fill={p.feasible ? C.accent : "transparent"}
                            stroke={p.step === bestStep ? C.ok : (p.feasible ? C.accent : C.warn)}
                            strokeWidth={p.step === bestStep ? 2 : 1.25}
                        />
                    ))}
                    {hover && (
                        <line x1={model.x(hover.step)} x2={model.x(hover.step)} y1={model.m.t} y2={model.m.t + model.plotH} stroke={C.borderStrong} />
                    )}
                </svg>
            )}
            {hover && model && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 6,
                        left: Math.min(Math.max(model.m.l, model.x(hover.step) + 8), width - 150),
                        px: 1,
                        py: 0.5,
                        bgcolor: C.panelAlt,
                        border: `1px solid ${C.borderStrong}`,
                        borderRadius: "6px",
                        pointerEvents: "none",
                        ...NUM_SX,
                        fontSize: "0.72rem",
                        color: C.text
                    }}
                >
                    #{hover.step} · {metricText(hover.value, unit)}
                    {!hover.feasible && <Box component="span" sx={{ color: C.warn }}> · infeasible</Box>}
                </Box>
            )}
        </Box>
    );
});

// ============================================================================
// 5. СТРОКА ЖУРНАЛА
// ============================================================================

const LogRow = memo(function LogRow({ log, expanded, onToggle, task, isBest }) {
    const taskParameters = task?.parameters;
    const objectiveName = task?.spec?.objective?.name;
    const hasDetails = Boolean(log.candidateParams);
    const statusColor = log.type === "error" ? C.err : log.type === "abort" ? C.abort : C.text;
    const summary = log.evaluationSummary;
    const details = hasDetails ? extractSolverDetails(log.technicalMetrics) : null;

    const toggle = () => hasDetails && onToggle(log.id);
    const onKeyDown = (e) => {
        if (hasDetails && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle(log.id);
        }
    };

    return (
        <Box sx={{ borderBottom: `1px solid ${expanded ? C.border : "transparent"}` }}>
            <Box
                role={hasDetails ? "button" : undefined}
                tabIndex={hasDetails ? 0 : undefined}
                aria-expanded={hasDetails ? expanded : undefined}
                onClick={toggle}
                onKeyDown={onKeyDown}
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "16px auto 1fr", sm: "16px 52px auto 1fr auto" },
                    alignItems: "baseline",
                    columnGap: 1,
                    rowGap: 0.25,
                    px: 1,
                    py: 0.5,
                    borderRadius: "4px",
                    cursor: hasDetails ? "pointer" : "default",
                    bgcolor: isBest ? "rgba(47,191,113,0.07)" : (expanded ? "rgba(79,143,247,0.06)" : "transparent"),
                    "&:hover": { bgcolor: hasDetails ? "rgba(255,255,255,0.04)" : undefined },
                    "&:focus-visible": { outline: `1px solid ${C.accent}` }
                }}
            >
                <Box sx={{ color: C.textMute, display: "flex", alignSelf: "center" }}>
                    {hasDetails && (expanded ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />)}
                </Box>
                <Box sx={{ ...NUM_SX, color: C.textMute, display: { xs: "none", sm: "block" } }}>
                    {hasDetails && !log.isFinalReportMarker ? `#${String(log.currentStepVisual ?? "").padStart(3, "0")}` : log.timestamp?.slice(0, 5)}
                </Box>
                <Box component="span" sx={{ color: modeColor(log.stepMode), fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.04em" }}>
                    {log.stepMode ? String(log.stepMode).toUpperCase() : "SYSTEM"}
                    <Box component="span" sx={{ ...NUM_SX, color: C.textMute, fontWeight: 400, ml: 1, display: { sm: "none" } }}>
                        {hasDetails && !log.isFinalReportMarker ? `#${log.currentStepVisual}` : ""}
                    </Box>
                </Box>
                <Box sx={{ color: statusColor, minWidth: 0, gridColumn: { xs: "2 / -1", sm: "auto" }, overflowWrap: "anywhere" }}>
                    {hasDetails && !log.isFinalReportMarker && /^simulation completed$/i.test(String(log.text || "").trim()) ? "" : cleanText(log.text)}
                    {isBest && <Box component="span" sx={{ color: C.ok, ml: 1, fontWeight: 700 }}>★ leader</Box>}
                </Box>
                {summary?.objective && hasDetails && (
                    <Box sx={{ ...NUM_SX, gridColumn: { xs: "2 / -1", sm: "auto" }, color: C.textDim, whiteSpace: "nowrap", textAlign: { sm: "right" } }}>
                        <Box component="span" sx={{ color: C.textMute }}>{metricInfo(task, objectiveName).label} </Box>
                        <Box component="span" sx={{ color: log.type === "error" || log.type === "abort" ? C.err : C.accent, fontWeight: 700 }}>
                            {metricText(summary.objective.value, summary.objective.unit || metricInfo(task, objectiveName).unit)}
                        </Box>
                        {(summary.constraints || []).map((c, i) => (
                            <Box component="span" key={c.name || i} sx={{ ml: 1.5, color: c.feasible === false ? C.warn : C.textDim }}>
                                {metricInfo(task, c.name).label} {metricText(c.value, metricInfo(task, c.name).unit)}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            {hasDetails && expanded && (
                <Box sx={{ ml: { xs: 1, sm: 4 }, mr: 1, mb: 1, mt: 0.5, p: 1.25, bgcolor: C.panelAlt, borderLeft: `2px solid ${C.accent}`, borderRadius: "4px" }}>
                    {(log.type === "abort" || log.type === "error") && (
                        <Typography sx={{ color: C.err, fontSize: "0.78rem", fontWeight: 600, mb: 0.75 }}>
                            {cleanText(log.message) || "Simulation problem encountered. Candidate discarded."}
                        </Typography>
                    )}
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 3 }}>
                        <Box>
                            {Object.entries(log.candidateParams).map(([name, value]) => (
                                <KeyValue key={name} label={taskParameters?.[name]?.label || name} value={formatParamValue(name, value, taskParameters)} color={C.ok} />
                            ))}
                        </Box>
                        <Box>
                            <KeyValue label="Calculation time" value={details.calcTime} />
                            <KeyValue label="Solver steps" value={`${details.steps} (${details.rejected} rejected)`} color={Number(details.rejected) > 0 ? C.warn : C.text} />
                            <KeyValue label="Picard iterations" value={details.picardIters} />
                            <KeyValue label="Computational load" value={details.load} />
                            {details.hasAccuracy && (
                                <>
                                    <KeyValue label="Error: time / grid / Picard" value={`${details.timeErr} / ${details.gridErr} / ${details.picardErr}`} />
                                    {details.residual && <KeyValue label="Linear residual" value={details.residual} />}
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
});

// ============================================================================
// 5a. ЛИДЕР — лучшая найденная конфигурация
// Главное крупно: цель, ограничения (с пределом и отметкой выполнения) и шаг,
// на котором найден лидер. Ниже — параметры и только те данные решателя,
// которых ещё нет среди метрик (без повторов).
// ============================================================================

function MetricTile({ label, bound, value, unit, state, accent, hint, title }) {
    const border = state === "ok" ? "rgba(47,191,113,0.35)" : state === "bad" ? "rgba(239,83,80,0.5)" : C.border;
    return (
        <Box title={title} sx={{ px: 1.25, py: 0.9, borderRadius: "6px", bgcolor: C.panelAlt, border: `1px solid ${border}`, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
                <Typography noWrap sx={{ ...sectionTitleSx, fontSize: "0.64rem" }}>{label}</Typography>
                {bound && <Box component="span" sx={{ ...NUM_SX, color: C.textMute, fontSize: "0.68rem", whiteSpace: "nowrap" }}>{bound}</Box>}
                {state && (
                    <Box component="span" sx={{ ml: "auto", color: state === "ok" ? C.ok : C.err, fontSize: "0.75rem", fontWeight: 700 }}>
                        {state === "ok" ? "✓" : "✗"}
                    </Box>
                )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 0.25, minWidth: 0 }}>
                <Typography noWrap sx={{ ...NUM_SX, color: accent ? C.accent : state === "bad" ? C.err : C.text, fontWeight: 700, fontSize: accent ? "1.5rem" : "1.2rem", lineHeight: 1.15 }}>
                    {value}
                </Typography>
                {unit && <Typography noWrap sx={{ color: C.textDim, fontSize: "0.75rem" }}>{unit}</Typography>}
            </Box>
            {hint && <Typography noWrap sx={{ ...NUM_SX, color: C.textMute, fontSize: "0.68rem", mt: 0.25 }}>{hint}</Typography>}
        </Box>
    );
}

const LeaderPanel = memo(function LeaderPanel({ task, bestLog, bestStepLog, bestStepNumber, totalSteps, isFinal, open, onToggle }) {
    const summary = bestLog?.evaluationSummary || null;
    const objectiveName = task?.spec?.objective?.name;
    const objectiveInfo = metricInfo(task, objectiveName);
    const goalLabel = task?.goal === "max" ? "max" : "min";
    const constraints = summary?.constraints || [];
    const objectiveValue = summary?.objective?.value;
    const allFeasible = constraints.every((c) => c.feasible !== false);

    const tm = bestStepLog?.technicalMetrics || bestLog?.technicalMetrics;
    const acc = tm?.accuracy;
    const it = tm?.iterations;
    const shown = [objectiveValue, ...constraints.map((c) => c.value)];
    const isShown = (v) => shown.some((x) => sameValue(x, v));
    const errorBreakdown = acc && Number.isFinite(acc.totalErrorScore)
        ? [acc.timeIntegrationErrorC, acc.spatialGridErrorC, acc.picardConvergenceErrorC]
            .map((v, i) => `${["time", "grid", "Picard"][i]} ${Number.isFinite(v) ? Math.abs(v).toFixed(3) : "—"}`).join(" · ")
        : null;
    const errorShown = isShown(acc?.totalErrorScore);

    const objective = formatMetric(objectiveValue, summary?.objective?.unit || objectiveInfo.unit);
    const tiles = [
        {
            key: "objective",
            label: `${objectiveInfo.label} · ${goalLabel}`,
            value: objective.text,
            unit: objective.unit,
            accent: true,
            title: Number.isFinite(objectiveValue) ? String(objectiveValue) : undefined
        },
        ...constraints.map((c) => {
            const info = metricInfo(task, c.name);
            const f = formatMetric(c.value, info.unit);
            return {
                key: c.name,
                label: info.label,
                bound: formatBound({ min: c.min ?? undefined, max: c.max ?? undefined }),
                value: f.text,
                unit: f.unit,
                state: c.feasible === false ? "bad" : "ok",
                title: Number.isFinite(c.value) ? String(c.value) : undefined
            };
        }),
        {
            key: "step",
            label: "Found at step",
            value: bestStepNumber !== null && bestStepNumber !== undefined ? `#${bestStepNumber}` : "—",
            hint: Number.isFinite(totalSteps) && totalSteps > 0 ? `of ${totalSteps}` : undefined
        }
    ];

    // Данные решателя — только то, чего нет среди метрик
    const solverRows = tm ? [
        Number.isFinite(tm.calculationTimeMs) && !isFinal && ["Simulation time", `${tm.calculationTimeMs.toFixed(0)} ms`],
        Number.isFinite(it?.totalTimeSteps) && ["Solver steps / Picard", `${it.totalTimeSteps}${it.rejectedTimeSteps ? ` (${it.rejectedTimeSteps} rej.)` : ""} / ${it.totalPicardIterations ?? "—"}`],
        Number.isFinite(it?.totalGridPointsProcessed) && !isShown(it.totalGridPointsProcessed) && ["Load", metricText(it.totalGridPointsProcessed, "ops")],
        errorBreakdown && (errorShown
            ? ["Error components", errorBreakdown]
            : ["Error", `${acc.totalErrorScore.toFixed(3)} (${errorBreakdown})`])
    ].filter(Boolean) : [];

    const title = isFinal ? (allFeasible ? "Final optimum" : "Final (least violating)") : "Leader";

    return (
        <Box sx={{ ...panelSx, borderColor: isFinal ? (allFeasible ? C.ok : C.warn) : C.border, overflow: "hidden", flexShrink: 0 }}>
            {/* Заголовок — он же свёрнутый вид: главное в одну строку */}
            <Box
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={onToggle}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    px: 1.5,
                    py: 1,
                    cursor: "pointer",
                    flexWrap: "wrap",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                    "&:focus-visible": { outline: `1px solid ${C.accent}`, outlineOffset: -1 }
                }}
            >
                {open ? <KeyboardArrowDownIcon sx={{ fontSize: 18, color: C.textMute }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 18, color: C.textMute }} />}
                <Typography sx={{ ...sectionTitleSx, color: isFinal ? (allFeasible ? C.ok : C.warn) : C.textMute }}>{title}</Typography>
                {bestStepNumber !== null && bestStepNumber !== undefined && (
                    <Box component="span" sx={{ ...NUM_SX, color: C.text, fontSize: "0.78rem", fontWeight: 700 }}>#{bestStepNumber}</Box>
                )}
                {!open && summary && (
                    <Box sx={{ ...NUM_SX, display: "flex", gap: 1.75, flexWrap: "wrap", fontSize: "0.82rem", ml: { sm: "auto" } }}>
                        <span>
                            <Box component="span" sx={{ color: C.textDim }}>{objectiveInfo.label} </Box>
                            <Box component="span" sx={{ color: C.accent, fontWeight: 700 }}>{metricText(objectiveValue, objectiveInfo.unit)}</Box>
                        </span>
                        {constraints.map((c) => (
                            <span key={c.name}>
                                <Box component="span" sx={{ color: C.textDim }}>{metricInfo(task, c.name).label} </Box>
                                <Box component="span" sx={{ color: c.feasible === false ? C.err : C.text, fontWeight: 700 }}>{metricText(c.value, metricInfo(task, c.name).unit)}</Box>
                                <Box component="span" sx={{ color: c.feasible === false ? C.err : C.ok, ml: 0.5 }}>{c.feasible === false ? "✗" : "✓"}</Box>
                            </span>
                        ))}
                    </Box>
                )}
                {!summary && (
                    <Typography sx={{ color: C.textMute, fontSize: "0.78rem", ml: { sm: "auto" } }}>No result yet</Typography>
                )}
            </Box>

            {open && summary && (
                <Box sx={{ px: 1.5, pb: 1.5, borderTop: `1px solid ${C.border}`, pt: 1.25 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1 }}>
                        {tiles.map(({ key, ...tile }) => <MetricTile key={key} {...tile} />)}
                    </Box>

                    {bestLog?.candidateParams && (
                        <Box sx={{ mt: 1.5 }}>
                            <Typography sx={{ ...sectionTitleSx, mb: 0.5 }}>Parameters</Typography>
                            {Object.entries(bestLog.candidateParams).map(([name, value]) => (
                                <KeyValue key={name} label={task?.parameters?.[name]?.label || name} value={formatParamValue(name, value, task?.parameters)} color={C.text} />
                            ))}
                        </Box>
                    )}

                    {solverRows.length > 0 && (
                        <Box sx={{ mt: 1.25, pt: 0.75, borderTop: `1px solid ${C.border}` }}>
                            {solverRows.map(([label, value]) => (
                                <KeyValue key={label} label={label} value={value} color={C.textDim} />
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
});

// ============================================================================
// 6. ОСНОВНОЙ КОМПОНЕНТ
// ============================================================================

export function BayeusianLogDialog({ open, onClose, parentState, setParentState }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    // --- Исходные данные задачи ---
    const baseParams = useMemo(() => {
        const thicknessMm = Number(parentState.geometry?.thickness) || 0;
        const widthHalfMm = parentState.simulation?.widthHalfMm !== undefined
            ? parentState.simulation.widthHalfMm
            : ((Number(parentState.geometry?.width) || 0) / 2 || 20);
        return {
            thicknessMm,
            material: parentState.material,
            machine: parentState.machine,
            simulation: { ...parentState.simulation, widthHalfMm }
        };
    }, [parentState.geometry, parentState.material, parentState.machine, parentState.simulation]);

    // Только задачи, применимые к текущей машине (у Line 3 нет ПИД)
    const applicableTasks = useMemo(() => getApplicableTasks(baseParams), [baseParams]);
    const [selectedTaskId, setSelectedTaskId] = useState(DEFAULT_TASK_ID);
    useEffect(() => {
        if (!applicableTasks.some((t) => t.id === selectedTaskId) && applicableTasks.length > 0) {
            setSelectedTaskId(applicableTasks[0].id);
        }
    }, [applicableTasks, selectedTaskId]);

    const activeTask = useMemo(() => resolveOptimizerTask(selectedTaskId, baseParams), [selectedTaskId, baseParams]);
    const budget = useMemo(() => getAdaptiveOptimizerBudget(activeTask), [activeTask]);

    // --- Состояние прогона ---
    const [runStatus, setRunStatus] = useState("idle");
    const [logs, setLogs] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [bestStepNumber, setBestStepNumber] = useState(null);
    const [live, setLive] = useState(null); // { step, percent, thinking, params }
    const [completedSteps, setCompletedSteps] = useState(0);
    const [totalBudget, setTotalBudget] = useState(budget.totalIterations);
    const [timer, setTimer] = useState({ startedAt: null, baseSeconds: 0 });
    const [hasResult, setHasResult] = useState(false);
    // Панель лидера: во время расчёта свёрнута (видна строка с главным), по завершении раскрыта
    const [leaderOpen, setLeaderOpen] = useState(true);

    const isRunning = runStatus === "running" || runStatus === "stopping";

    // --- Web Worker: создаётся один раз; обработчик берётся из ref, ---
    // --- поэтому изменение props не убивает идущую оптимизацию      ---
    const workerRef = useRef(null);
    const handlerRef = useRef(() => {});

    const appendLog = useCallback((entry) => {
        setLogs((prev) => [...prev, { ...entry, id: entry.id || nextLogId(), timestamp: entry.timestamp || timestamp() }]);
    }, []);

    const pauseTimer = useCallback(() => {
        setTimer((t) => ({
            startedAt: null,
            baseSeconds: t.baseSeconds + (t.startedAt !== null ? (performance.now() - t.startedAt) / 1000 : 0)
        }));
    }, []);

    const createWorker = useCallback(() => {
        workerRef.current?.terminate();
        const worker = new Worker(new URL("./optimization.worker.js", import.meta.url), { type: "module" });
        worker.onmessage = (e) => handlerRef.current(e.data || {});
        worker.onerror = (event) => handlerRef.current({ status: "error", error: event.message || "Worker failed to start" });
        workerRef.current = worker;
    }, []);

    useEffect(() => {
        createWorker();
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [createWorker]);

    const handleWorkerMessage = (msg) => {
        if (msg.status === "progress_tick") {
            const step = Math.max(0, msg.currentExecutionCount ?? 0);
            if (Number.isFinite(msg.totalIterations)) setTotalBudget(msg.totalIterations);
            if (msg.bestStepNumber !== null && msg.bestStepNumber !== undefined) setBestStepNumber(msg.bestStepNumber);
            setCompletedSteps(Math.max(0, step - 1));
            setLive({
                step,
                thinking: msg.snapshotStatus === "THINKING",
                percent: Number.isFinite(Number(msg.percent)) ? Math.max(0, Math.min(100, Number(msg.percent))) : 0,
                params: msg.currentParams || null
            });
            return;
        }
        if (msg.status === "log_step" && msg.logEntry) {
            const entry = msg.logEntry;
            // Предупреждение модели (например, перегрев) у обычного шага — не ошибка оптимизации
            const normalized = entry.type === "warning" && entry.candidateParams
                ? { ...entry, type: "info", text: "Simulation completed", message: null }
                : entry;
            if (normalized.bestStepNumber !== null && normalized.bestStepNumber !== undefined) {
                setBestStepNumber(normalized.bestStepNumber);
            }
            if (!normalized.isFinalReportMarker && Number.isFinite(normalized.currentStepVisual)) {
                setCompletedSteps(normalized.currentStepVisual);
            }
            appendLog(normalized);
            return;
        }
        if (msg.status === "success") {
            downloadDiagnosticLog(msg.data?.diagnosticLogText);
            const steps = msg.data?.metrics?.searchStepsMade;
            if (Number.isFinite(steps)) {
                setCompletedSteps(steps);
                setTotalBudget(steps);
            }
            setLive(null);
            setHasResult(true);
            setLeaderOpen(true);
            setRunStatus("done");
            pauseTimer();
            return;
        }
        if (msg.status === "error") {
            setLive(null);
            setRunStatus("error");
            pauseTimer();
            appendLog({ type: "error", stepMode: "SYSTEM", text: `Optimization error: ${msg.error || "unknown internal error"}` });
        }
    };

    // Обработчик обновляется после каждого рендера — воркер всегда видит актуальные setState/данные
    useLayoutEffect(() => {
        handlerRef.current = handleWorkerMessage;
    });

    // --- Команды ---
    const resetRunView = useCallback(() => {
        setLogs([]);
        setExpanded({});
        setBestStepNumber(null);
        setLive(null);
        setCompletedSteps(0);
        setHasResult(false);
        setTimer({ startedAt: null, baseSeconds: 0 });
    }, []);

    const start = useCallback(() => {
        if (!workerRef.current || isRunning) return;
        resetRunView();
        setTotalBudget(budget.totalIterations);
        setLeaderOpen(false);
        setRunStatus("running");
        setTimer({ startedAt: performance.now(), baseSeconds: 0 });
        appendLog({ type: "info", stepMode: "SYSTEM", text: `Started: ${activeTask.label}` });

        // Числовые границы параметров считаются здесь, по текущим исходным данным
        const widthHalfMm = baseParams.simulation.widthHalfMm;
        const paramOverrides = Object.fromEntries(
            Object.entries(activeTask.parameters)
                .filter(([key]) => !(widthHalfMm === 0 && key === "gridDensityY"))
                .map(([key, { label, path, unit, min, max, step }]) => [key, { label, path, unit, min, max, step }])
        );
        workerRef.current.postMessage({
            command: "start",
            baseParams: {
                ...baseParams,
                material: { ...baseParams.material },
                machine: { ...baseParams.machine }
            },
            options: { taskId: selectedTaskId, paramOverrides }
        });
    }, [isRunning, resetRunView, budget.totalIterations, appendLog, activeTask, baseParams, selectedTaskId]);

    const resume = useCallback(() => {
        if (!workerRef.current || isRunning || !hasResult) return;
        setTotalBudget((t) => completedSteps + budget.totalIterations || t);
        setHasResult(false);
        setLeaderOpen(false);
        setRunStatus("running");
        setTimer((t) => ({ ...t, startedAt: performance.now() }));
        appendLog({ type: "info", stepMode: "SYSTEM", text: "Continue: re-checking the found optimum with the trained model" });
        workerRef.current.postMessage({ command: "continue" });
    }, [isRunning, hasResult, completedSteps, budget.totalIterations, appendLog]);

    const finishNow = useCallback(() => {
        if (!workerRef.current || runStatus !== "running") return;
        setRunStatus("stopping");
        workerRef.current.postMessage({ command: "finish_now" });
        appendLog({ type: "warning", stepMode: "SYSTEM", text: "Finishing the current step and keeping the best configuration…" });
    }, [runStatus, appendLog]);

    const abort = useCallback(() => {
        if (!isRunning) return;
        createWorker();
        setLive(null);
        setHasResult(false);
        setRunStatus("aborted");
        pauseTimer();
        appendLog({ type: "error", stepMode: "SYSTEM", text: "Optimization terminated by user. Results of this run are discarded." });
    }, [isRunning, createWorker, pauseTimer, appendLog]);

    const changeTask = useCallback((id) => {
        setSelectedTaskId(id);
        resetRunView();
        setRunStatus("idle");
    }, [resetRunView]);

    // --- Производные данные ---
    // Точки графика: завершённые шаги с вычисленной целью
    const chartPoints = useMemo(() => logs
        .filter((l) => l.candidateParams && !l.isFinalReportMarker && Number.isFinite(l.currentStepVisual)
            && l.type !== "abort" && l.type !== "error" && Number.isFinite(l.evaluationSummary?.objective?.value))
        .map((l) => ({
            step: l.currentStepVisual,
            value: l.evaluationSummary.objective.value,
            feasible: (l.evaluationSummary.constraints || []).every((c) => c.feasible !== false)
        })), [logs]);

    // Лучшая запись: итоговый отчёт, иначе шаг с номером лучшего
    const bestLog = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            if (logs[i].isFinalReportMarker) return logs[i];
        }
        if (bestStepNumber === null) return null;
        for (let i = logs.length - 1; i >= 0; i--) {
            const l = logs[i];
            if (l.candidateParams && !l.isFinalReportMarker && l.currentStepVisual === bestStepNumber) return l;
        }
        return null;
    }, [logs, bestStepNumber]);

    // Метрики решателя для итогового отчёта берём из лога самого лучшего шага
    const bestStepLog = useMemo(() => {
        if (bestStepNumber === null) return null;
        for (let i = logs.length - 1; i >= 0; i--) {
            const l = logs[i];
            if (l.candidateParams && !l.isFinalReportMarker && l.currentStepVisual === bestStepNumber) return l;
        }
        return null;
    }, [logs, bestStepNumber]);

    const specConstraints = activeTask.spec?.constraints || [];
    const toggleLeader = useCallback(() => setLeaderOpen((v) => !v), []);

    const toggleExpand = useCallback((id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] })), []);

    // --- Применение найденных параметров ---
    const applyParameters = useCallback(() => {
        const params = bestLog?.candidateParams;
        if (!params) return;
        setParentState((prev) => {
            const next = { ...prev };
            let isGridTask = false;
            for (const [key, val] of Object.entries(params)) {
                const path = activeTask.parameters[key]?.path;
                if (!path) continue;
                if (path.startsWith("simulation.accuracyMode")) isGridTask = true;
                const parts = path.split(".");
                let curr = next;
                for (let i = 0; i < parts.length - 1; i++) {
                    curr[parts[i]] = Array.isArray(curr[parts[i]]) ? [...curr[parts[i]]] : { ...(curr[parts[i]] || {}) };
                    curr = curr[parts[i]];
                }
                curr[parts[parts.length - 1]] = val;
            }
            if (isGridTask) {
                next.simulation = { ...next.simulation, accuracyMode: { ...params }, customAccuracyParams: { ...params } };
            }
            return next;
        });
        onClose?.();
    }, [bestLog, activeTask, setParentState, onClose]);

    // --- Прокрутка журнала как в терминале/IDE ---
    // У нижнего края журнал «следует» за новыми строками мгновенным переходом (до отрисовки
    // кадра, поэтому нет ни рывка, ни догоняющей анимации при частых строках). Стоит
    // прокрутить вверх — позиция замирает, а новые строки копятся в счётчике кнопки «↓».
    const consoleRef = useRef(null);
    const followRef = useRef(true);
    const prevLogCount = useRef(0);
    const [following, setFollowing] = useState(true);
    const [unseen, setUnseen] = useState(0);

    useLayoutEffect(() => {
        const added = logs.length - prevLogCount.current;
        prevLogCount.current = logs.length;
        const el = consoleRef.current;
        if (!el) return;
        if (logs.length === 0) {
            followRef.current = true;
            setFollowing(true);
            setUnseen(0);
            return;
        }
        if (followRef.current) el.scrollTop = el.scrollHeight;
        else if (added > 0) setUnseen((n) => n + added);
    }, [logs.length]);

    const onConsoleScroll = useCallback(() => {
        const el = consoleRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        if (atBottom !== followRef.current) {
            followRef.current = atBottom;
            setFollowing(atBottom);
        }
        if (atBottom) setUnseen(0);
    }, []);

    const jumpToLatest = useCallback(() => {
        const el = consoleRef.current;
        if (!el) return;
        followRef.current = true;
        setFollowing(true);
        setUnseen(0);
        // Единичный переход по кнопке — плавный, чтобы было видно, куда уехали
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, []);

    // --- Прогресс ---
    const stepFraction = isRunning && live && !live.thinking ? live.percent / 100 : 0;
    const overallProgress = totalBudget > 0
        ? Math.min(100, ((runStatus === "done" ? totalBudget : completedSteps + stepFraction) / totalBudget) * 100)
        : 0;
    const statusMeta = STATUS_META[runStatus];
    const goalLabel = (activeTask.goal || "min").toUpperCase();
    const liveIsInit = live && live.step <= budget.initPoints;

    // ========================================================================
    // РЕНДЕР
    // ========================================================================
    const header = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: { xs: 1.5, md: 2.5 }, py: 1, bgcolor: C.panel, borderBottom: `1px solid ${C.border}`, flexWrap: { xs: "wrap", md: "nowrap" } }}>
            <TuneIcon sx={{ color: C.accent }} />
            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: { xs: "0.95rem", md: "1.05rem" }, whiteSpace: "nowrap" }}>
                Optimization Monitor
            </Typography>
            <Chip
                size="small"
                label={statusMeta.label}
                sx={{ height: 22, fontWeight: 700, fontSize: "0.7rem", color: statusMeta.color, bgcolor: "transparent", border: `1px solid ${statusMeta.color}` }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <TextField
                select
                size="small"
                value={applicableTasks.some((t) => t.id === selectedTaskId) ? selectedTaskId : ""}
                onChange={(e) => changeTask(e.target.value)}
                disabled={isRunning}
                slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { bgcolor: C.panel, color: C.text, border: `1px solid ${C.border}` } } } } } }}
                sx={{
                    order: { xs: 10, md: 0 },
                    width: { xs: "100%", md: 340 },
                    "& .MuiInputBase-root": { color: C.text, fontSize: "0.85rem", bgcolor: C.bg },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: C.borderStrong },
                    "& .MuiSvgIcon-root": { color: C.textDim }
                }}
            >
                {applicableTasks.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
                ))}
            </TextField>
            <Tooltip title={isRunning ? "Stop the optimization first" : "Close"}>
                <span>
                    <IconButton aria-label="close" onClick={onClose} disabled={isRunning} sx={{ color: C.textDim }}>
                        <CloseIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );

    const progressPanel = (
        <Box sx={{ ...panelSx, p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={sectionTitleSx}>Progress</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <ElapsedTimer startedAt={timer.startedAt} baseSeconds={timer.baseSeconds} running={timer.startedAt !== null} />
                <Box component="span" sx={{ ...NUM_SX, color: C.text, fontWeight: 700 }}>
                    {completedSteps}/{totalBudget}
                </Box>
            </Box>
            <LinearProgress
                variant="determinate"
                value={overallProgress}
                sx={{ height: 6, borderRadius: 3, bgcolor: C.border, "& .MuiLinearProgress-bar": { bgcolor: C.accent, borderRadius: 3 } }}
            />
            <Box sx={{ ...NUM_SX, color: C.textDim, fontSize: "0.75rem", display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                <span>Goal: <Box component="span" sx={{ color: C.accent, fontWeight: 700 }}>{goalLabel} {metricInfo(activeTask, activeTask.spec?.objective?.name).label}</Box></span>
                {specConstraints.map((c, i) => (
                    <span key={c.name || i}>{metricInfo(activeTask, c.name).label} {formatBound(c)}{metricInfo(activeTask, c.name).unit ? `\u00A0${metricInfo(activeTask, c.name).unit}` : ""}</span>
                ))}
            </Box>
            {isRunning && live && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ ...NUM_SX, color: C.textDim, fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        {live.thinking ? `Model: choosing step ${live.step}` : `${liveIsInit ? "Init" : "Step"} ${live.step}: simulation`}
                    </Typography>
                    <LinearProgress
                        variant={live.thinking ? "indeterminate" : "determinate"}
                        value={live.percent}
                        sx={{ flexGrow: 1, height: 4, borderRadius: 2, bgcolor: C.border, "& .MuiLinearProgress-bar": { bgcolor: C.ok } }}
                    />
                    <Typography sx={{ ...NUM_SX, color: C.ok, fontSize: "0.75rem", minWidth: 36, textAlign: "right" }}>
                        {live.thinking ? "" : `${Math.round(live.percent)}%`}
                    </Typography>
                </Box>
            )}
        </Box>
    );

    const leaderPanel = (
        <LeaderPanel
            task={activeTask}
            bestLog={bestLog}
            bestStepLog={bestStepLog}
            bestStepNumber={bestStepNumber}
            totalSteps={runStatus === "done" ? completedSteps : totalBudget}
            isFinal={Boolean(bestLog?.isFinalReportMarker)}
            open={leaderOpen}
            onToggle={toggleLeader}
        />
    );

    const chartPanel = (
        <Box sx={{ ...panelSx, p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
                <Typography sx={sectionTitleSx}>Convergence</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, fontSize: "0.7rem", color: C.textDim, flexWrap: "wrap" }}>
                    <span><Box component="span" sx={{ color: C.accent }}>●</Box> feasible</span>
                    <span><Box component="span" sx={{ color: C.warn }}>○</Box> infeasible</span>
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <svg width="11" height="11" viewBox="0 0 11 11" style={{ display: "block" }}>
                            <circle cx="5.5" cy="5.5" r="3.8" fill={C.accent} stroke={C.ok} strokeWidth="1.8" />
                        </svg>
                        best
                    </Box>
                </Box>
            </Box>
            <ConvergenceChart points={chartPoints} goal={activeTask.goal} unit={activeTask.unit} bestStep={bestStepNumber} height={isMobile ? 170 : 210} />
        </Box>
    );

    const consolePanel = (
        <Box sx={{ ...panelSx, position: "relative", display: "flex", flexDirection: "column", minHeight: { xs: "45vh", md: 0 }, height: { md: "100%" }, overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderBottom: `1px solid ${C.border}` }}>
                <Typography sx={sectionTitleSx}>Evaluation log</Typography>
                <Box component="span" sx={{ ...NUM_SX, color: C.textMute, fontSize: "0.72rem" }}>{chartPoints.length} evaluated</Box>
                <Box sx={{ flexGrow: 1 }} />
                {!following && logs.length > 0 && (
                    <Box component="span" sx={{ color: C.warn, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em" }}>PAUSED</Box>
                )}
            </Box>
            {!following && logs.length > 0 && (
                <Button
                    size="small"
                    onClick={jumpToLatest}
                    startIcon={<KeyboardArrowDownIcon />}
                    sx={{
                        position: "absolute",
                        right: 16,
                        bottom: 16,
                        zIndex: 2,
                        textTransform: "none",
                        fontWeight: 700,
                        borderRadius: "16px",
                        px: 1.5,
                        color: "#fff",
                        bgcolor: unseen > 0 ? C.accent : C.borderStrong,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                        "&:hover": { bgcolor: unseen > 0 ? "#3d7be6" : C.border }
                    }}
                >
                    {unseen > 0 ? `${unseen} new` : "Latest"}
                </Button>
            )}
            <Box
                ref={consoleRef}
                onScroll={onConsoleScroll}
                sx={{
                    flexGrow: 1,
                    overflowY: "auto",
                    // Не даём браузеру самому «подтягивать» прокрутку при росте содержимого
                    overflowAnchor: "none",
                    overscrollBehavior: "contain",
                    maxHeight: { xs: "60vh", md: "none" },
                    px: 0.5,
                    py: 0.5,
                    bgcolor: C.bg,
                    fontFamily: MONO,
                    fontSize: { xs: "0.72rem", sm: "0.78rem" },
                    lineHeight: 1.5
                }}
            >
                {logs.length === 0 ? (
                    <Typography sx={{ color: C.textMute, fontStyle: "italic", textAlign: "center", mt: 4, fontSize: "0.8rem" }}>
                        Select a task and press “Start”.
                    </Typography>
                ) : (
                    logs.map((log) => (
                        <LogRow
                            key={log.id}
                            log={log}
                            expanded={Boolean(expanded[log.id])}
                            onToggle={toggleExpand}
                            task={activeTask}
                            isBest={!log.isFinalReportMarker && bestStepNumber !== null && log.currentStepVisual === bestStepNumber && Boolean(log.candidateParams)}
                        />
                    ))
                )}
            </Box>
        </Box>
    );

    const btnSx = { textTransform: "none", fontWeight: 600, borderRadius: "6px", px: 2, whiteSpace: "nowrap" };
    const actions = (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: { xs: 1.5, md: 2.5 },
                py: 1.25,
                bgcolor: C.panel,
                borderTop: `1px solid ${C.border}`,
                flexWrap: "wrap",
                justifyContent: "flex-end",
                pb: { xs: "calc(10px + env(safe-area-inset-bottom))", md: 1.25 }
            }}
        >
            {isRunning ? (
                <>
                    <Button variant="outlined" onClick={finishNow} disabled={runStatus === "stopping"} startIcon={<StopIcon />}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.warn, borderColor: "rgba(240,165,49,0.5)" }}>
                        {runStatus === "stopping" ? "Finishing…" : "Finish & keep best"}
                    </Button>
                    <Button variant="outlined" onClick={abort} startIcon={<BlockIcon />}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.err, borderColor: "rgba(239,83,80,0.5)" }}>
                        Abort
                    </Button>
                </>
            ) : (
                <>
                    <Button variant="text" onClick={onClose} sx={{ ...btnSx, color: C.textDim, mr: { md: "auto" }, order: { xs: 3, md: 0 } }}>
                        {hasResult ? "Discard & close" : "Close"}
                    </Button>
                    {hasResult && (
                        <Button variant="outlined" onClick={resume} startIcon={<ReplayIcon />}
                                sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.accent, borderColor: "rgba(79,143,247,0.5)" }}>
                            Continue (+{budget.totalIterations})
                        </Button>
                    )}
                    <Button variant={hasResult ? "outlined" : "contained"} onClick={start} startIcon={<PlayArrowIcon />}
                            disabled={applicableTasks.length === 0}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, ...(hasResult ? { color: C.text, borderColor: C.borderStrong } : { bgcolor: C.accent, boxShadow: "none" }) }}>
                        {runStatus === "idle" ? "Start" : "Run again"}
                    </Button>
                    {hasResult && (
                        <Button variant="contained" onClick={applyParameters} startIcon={<CheckIcon />} disabled={!bestLog?.candidateParams}
                                sx={{ ...btnSx, flex: { xs: "1 1 100%", md: "none" }, bgcolor: C.ok, boxShadow: "none", "&:hover": { bgcolor: "#27a862" } }}>
                            Apply parameters
                        </Button>
                    )}
                </>
            )}
        </Box>
    );

    return (
        <Dialog
            open={open}
            fullScreen
            disableEnforceFocus
            onClose={(_e, reason) => {
                if (reason === "backdropClick" || isRunning) return;
                onClose?.();
            }}
            slotProps={{ paper: { sx: { bgcolor: C.bg, backgroundImage: "none", display: "flex", flexDirection: "column", color: C.text } } }}
        >
            {header}
            <Box
                sx={{
                    flexGrow: 1,
                    minHeight: 0,
                    p: { xs: 1, md: 2 },
                    gap: { xs: 1, md: 2 },
                    overflowY: { xs: "auto", md: "hidden" },
                    display: { xs: "flex", md: "grid" },
                    flexDirection: "column",
                    // Десктоп: журнал слева, прогресс / лидер / сходимость справа
                    gridTemplateColumns: { md: "1fr minmax(380px, 36%)" }
                }}
            >
                {isMobile ? (
                    <>
                        {progressPanel}
                        {leaderPanel}
                        {chartPanel}
                        {consolePanel}
                    </>
                ) : (
                    <>
                        <Box sx={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
                            {consolePanel}
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, overflowY: "auto", pr: 0.25 }}>
                            {progressPanel}
                            {leaderPanel}
                            {chartPanel}
                        </Box>
                    </>
                )}
            </Box>
            {actions}
        </Dialog>
    );
}
