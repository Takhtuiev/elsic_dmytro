import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import InsightsIcon from "@mui/icons-material/Insights";

import {
    DEFAULT_TASK_ID,
    getAdaptiveOptimizerBudget,
    getApplicableTasks,
    resolveOptimizerTask
} from "./optimizer.config";
import { downloadDiagnosticLog } from "./optimizerDiagnostics";

// ============================================================================
// ОПТИМИЗАТОР — МОНИТОР ПРОГОНА
//
// Раскладка (десктоп): слева — сводка (прогресс, лидер, сходимость),
// справа — журнал шагов таблицей с колонками метрик задачи.
// Плотная «инженерная» вёрстка: мелкий шрифт, моноширинные табличные цифры,
// значения метрик — точно по допуску (resolution) из конфига, без обрезки.
// ============================================================================

// --- Палитра: графитовый фон, один акцент, семантические цвета только для статусов
const C = {
    bg: "#0b0e13",
    panel: "#11151c",
    panelHead: "#151a23",
    raised: "#181e28",
    border: "#222a36",
    borderStrong: "#2e3847",
    text: "#d8dee8",
    textDim: "#97a2b3",
    textMute: "#646f80",
    accent: "#4c8dff",
    accentSoft: "rgba(76,141,255,0.12)",
    ok: "#2bb673",
    okSoft: "rgba(43,182,115,0.10)",
    warn: "#e9a23b",
    err: "#ef5b5b",
    errSoft: "rgba(239,91,91,0.08)"
};

// Отметка лидера в журнале — яркая, чтобы строка находилась сразу
const LEADER_COLOR = "#4ff09a";

const MONO = "'JetBrains Mono', 'Roboto Mono', 'SFMono-Regular', Consolas, Menlo, monospace";
const NUM = { fontFamily: MONO, fontVariantNumeric: "tabular-nums" };
const FS = { xs: "0.66rem", sm: "0.72rem", md: "0.78rem", lg: "0.9rem" };

// Режимы шагов оптимизатора → короткая метка и цвет
const MODE_META = {
    BAYES: { label: "BAYES", color: "#5fd3a1" },
    RANDOM: { label: "INIT", color: "#b392f0" },
    INIT: { label: "INIT", color: "#b392f0" },
    PRESET: { label: "PRESET", color: "#56c2c9" },
    FALLBACK: { label: "FALLBK", color: "#b392f0" },
    FINAL: { label: "FINAL", color: "#e7c35a" },
    SYSTEM: { label: "SYS", color: "#6fb3ff" }
};
const modeMeta = (stepMode) => MODE_META[String(stepMode || "SYSTEM").toUpperCase().split("_")[0]] || MODE_META.SYSTEM;

const STATUS_META = {
    idle: { label: "Ready", color: C.textMute },
    running: { label: "Running", color: C.accent },
    stopping: { label: "Finishing", color: C.warn },
    done: { label: "Completed", color: C.ok },
    aborted: { label: "Aborted", color: C.err },
    error: { label: "Error", color: C.err }
};

// ============================================================================
// ФОРМАТИРОВАНИЕ
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

const NBSP = " ";
const groupDigits = (num) => new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, NBSP);

// Знаков после запятой по шагу (0.1 → 1, 0.005 → 3, 1 → 0)
function digitsForStep(step) {
    if (!Number.isFinite(step) || step <= 0) return 3;
    for (let d = 0; d <= 6; d++) {
        if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
    }
    return 4;
}

function formatNumber(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return "—";
    const num = Number(val);
    const abs = Math.abs(num);
    if (abs >= 10000) return groupDigits(Math.round(num));
    if (Number.isInteger(num)) return String(num);
    if (abs >= 100) return num.toFixed(2);
    if (abs >= 1) return num.toFixed(3);
    return num.toFixed(4);
}

// Значение метрики точно по допуску из конфига; тысячи — через неразрывный пробел
function formatMetricValue(value, resolution) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    const v = Number(value);
    if (!(Number.isFinite(resolution) && resolution > 0)) return formatNumber(v);
    const [intPart, frac] = Math.abs(v).toFixed(digitsForStep(resolution)).split(".");
    const grouped = intPart.length > 4 ? groupDigits(Number(intPart)) : intPart;
    return `${v < 0 ? "−" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

function formatParamValue(name, value, taskParameters) {
    if (value === null || value === undefined) return "—";
    if (typeof value !== "number") return String(value);
    const cfg = taskParameters?.[name];
    return value.toFixed(cfg?.digits ?? digitsForStep(cfg?.step));
}

function formatBound(min, max, resolution) {
    const f = (v) => formatMetricValue(v, resolution);
    const hasMin = Number.isFinite(min);
    const hasMax = Number.isFinite(max);
    if (hasMin && hasMax) return `${f(min)} … ${f(max)}`;
    if (hasMax) return `≤ ${f(max)}`;
    if (hasMin) return `≥ ${f(min)}`;
    return "—";
}

// Подписи осей — коротко, чтобы помещались
function axisText(value) {
    const abs = Math.abs(value);
    if (abs >= 1e6) return `${+(value / 1e6).toFixed(2)}${NBSP}M`;
    if (abs >= 1e4) return `${+(value / 1e3).toFixed(1)}${NBSP}k`;
    return formatNumber(value);
}

const sameValue = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const cleanText = (text) => String(text ?? "").replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "");
const metricInfo = (task, name) => task?.metricsInfo?.[name] || { label: name || "Objective", unit: "" };
const timestamp = () => new Date().toLocaleTimeString("uk-UA", { hour12: false });
let logIdCounter = 0;
const nextLogId = () => `log-${Date.now()}-${++logIdCounter}`;

// Метрики задачи в порядке показа: цель, затем ограничения
function taskMetricColumns(task) {
    const objective = task?.spec?.objective?.name;
    const names = Object.keys(task?.metricsInfo || {});
    const ordered = [objective, ...names.filter((n) => n !== objective)].filter(Boolean);
    return ordered.map((name) => ({ name, isObjective: name === objective, ...metricInfo(task, name) }));
}

// Значения метрик шага по именам (цель в сводке без имени — берём имя задачи)
function stepMetricValues(summary, objectiveName) {
    const values = {};
    if (!summary) return values;
    if (objectiveName) values[objectiveName] = { value: summary.objective?.value, feasible: true };
    for (const c of summary.constraints || []) values[c.name] = { value: c.value, feasible: c.feasible !== false, min: c.min, max: c.max };
    return values;
}

function stepOutcome(log) {
    if (log.type === "abort") return { label: "aborted", color: C.err };
    if (log.type === "error") return { label: "error", color: C.err };
    const constraints = log.evaluationSummary?.constraints || [];
    if (constraints.some((c) => c.feasible === false)) return { label: "infeasible", color: C.warn };
    return { label: "ok", color: C.textMute };
}

// ============================================================================
// БАЗОВЫЕ ЭЛЕМЕНТЫ
// ============================================================================

const ElapsedTimer = memo(function ElapsedTimer({ startedAt, baseSeconds, running }) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!running) return undefined;
        const id = setInterval(() => setTick((t) => t + 1), 250);
        return () => clearInterval(id);
    }, [running]);
    const seconds = baseSeconds + (running && startedAt !== null ? (performance.now() - startedAt) / 1000 : 0);
    return <Box component="span" sx={{ ...NUM, color: running ? C.text : C.textDim }}>{formatTime(seconds)}</Box>;
});

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

const headTitleSx = { color: C.textDim, fontSize: FS.xs, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" };

// Панель с заголовочной полосой
function Panel({ title, right, children, sx, bodySx, onHeadClick, headProps }) {
    return (
        <Box sx={{ bgcolor: C.panel, border: `1px solid ${C.border}`, borderRadius: "6px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", ...sx }}>
            <Box
                onClick={onHeadClick}
                {...headProps}
                sx={{
                    display: "flex", alignItems: "center", gap: 1, px: 1.25, minHeight: 28, flexShrink: 0,
                    bgcolor: C.panelHead, borderBottom: `1px solid ${C.border}`,
                    cursor: onHeadClick ? "pointer" : "default",
                    "&:focus-visible": { outline: `1px solid ${C.accent}`, outlineOffset: -1 }
                }}
            >
                {typeof title === "string" ? <Typography sx={headTitleSx}>{title}</Typography> : title}
                <Box sx={{ flexGrow: 1 }} />
                {right}
            </Box>
            <Box sx={{ minHeight: 0, ...bodySx }}>{children}</Box>
        </Box>
    );
}

// Строка «подпись — значение» (значение не обрезается, переносится)
function KV({ label, value, color = C.text, strong = false }) {
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 1.5, py: "2px", alignItems: "baseline" }}>
            <Typography component="span" sx={{ color: C.textDim, fontSize: FS.sm }}>{label}</Typography>
            <Typography component="span" sx={{ ...NUM, color, fontSize: FS.sm, fontWeight: strong ? 700 : 500, textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography>
        </Box>
    );
}

// ============================================================================
// ГРАФИК СХОДИМОСТИ
// ============================================================================

const ConvergenceChart = memo(function ConvergenceChart({ points, goal, unit, resolution, bestStep, height }) {
    const [ref, width] = useElementWidth();
    const [hover, setHover] = useState(null);

    const model = useMemo(() => {
        const valid = points.filter((p) => Number.isFinite(p.value));
        if (valid.length === 0 || width < 60) return null;
        let yMin = Infinity, yMax = -Infinity, sMin = Infinity, sMax = -Infinity;
        for (const p of valid) {
            if (p.value < yMin) yMin = p.value;
            if (p.value > yMax) yMax = p.value;
            if (p.step < sMin) sMin = p.step;
            if (p.step > sMax) sMax = p.step;
        }
        const useLog = yMin > 0 && yMax / yMin > 30;
        const tf = useLog ? Math.log10 : (v) => v;
        let lo = tf(yMin), hi = tf(yMax);
        if (hi - lo < 1e-12) {
            const pad = Math.abs(hi) * 0.01 || 1;
            lo -= pad;
            hi += pad;
        }
        const padY = (hi - lo) * 0.08;
        lo -= padY;
        hi += padY;
        sMax = Math.max(sMax, 2);
        sMin = Math.min(sMin, 1);
        const m = { l: 52, r: 8, t: 8, b: 18 };
        const plotW = Math.max(10, width - m.l - m.r);
        const plotH = height - m.t - m.b;
        const x = (s) => m.l + ((s - sMin) / Math.max(1, sMax - sMin)) * plotW;
        const y = (v) => m.t + (1 - (tf(v) - lo) / (hi - lo)) * plotH;

        const better = (a, b) => (goal === "max" ? a > b : a < b);
        let best = null;
        const path = [];
        for (const p of [...valid].sort((a, b) => a.step - b.step)) {
            if (p.feasible && (best === null || better(p.value, best))) best = p.value;
            if (best !== null) path.push(path.length === 0 ? `M${x(p.step)},${y(best)}` : `H${x(p.step)}V${y(best)}`);
        }
        const ticks = [0, 0.5, 1].map((f) => {
            const tv = lo + padY + f * (hi - lo - 2 * padY);
            const v = useLog ? 10 ** tv : tv;
            return { v, py: y(v) };
        });
        return { valid, x, y, m, plotW, plotH, pathD: path.join(""), ticks, sMin, sMax, useLog };
    }, [points, width, height, goal]);

    const onMove = useCallback((e) => {
        if (!model) return;
        const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
        let nearest = null, dist = Infinity;
        for (const p of model.valid) {
            const d = Math.abs(model.x(p.step) - mx);
            if (d < dist) { dist = d; nearest = p; }
        }
        setHover(dist < 20 ? nearest : null);
    }, [model]);

    return (
        <Box ref={ref} sx={{ position: "relative", width: "100%", height }}>
            {!model ? (
                <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMute, fontSize: FS.sm }}>
                    Appears after the first evaluations
                </Box>
            ) : (
                <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: "block" }}>
                    {model.ticks.map((t, i) => (
                        <g key={i}>
                            <line x1={model.m.l} x2={model.m.l + model.plotW} y1={t.py} y2={t.py} stroke={C.border} strokeDasharray="2 4" />
                            <text x={model.m.l - 6} y={t.py + 3} textAnchor="end" fill={C.textMute} fontSize="9" fontFamily={MONO}>{axisText(t.v)}</text>
                        </g>
                    ))}
                    <text x={model.m.l} y={height - 4} fill={C.textMute} fontSize="9" fontFamily={MONO}>#{model.sMin}</text>
                    <text x={model.m.l + model.plotW} y={height - 4} textAnchor="end" fill={C.textMute} fontSize="9" fontFamily={MONO}>
                        #{model.sMax}{model.useLog ? " · log" : ""}
                    </text>
                    <path d={model.pathD} fill="none" stroke={C.ok} strokeWidth="1.5" />
                    {model.valid.map((p) => (
                        <circle
                            key={p.step}
                            cx={model.x(p.step)}
                            cy={model.y(p.value)}
                            r={p.step === bestStep ? 4 : 2.4}
                            fill={p.feasible ? C.accent : "transparent"}
                            stroke={p.step === bestStep ? C.ok : (p.feasible ? C.accent : C.warn)}
                            strokeWidth={p.step === bestStep ? 1.8 : 1}
                        />
                    ))}
                    {hover && <line x1={model.x(hover.step)} x2={model.x(hover.step)} y1={model.m.t} y2={model.m.t + model.plotH} stroke={C.borderStrong} />}
                </svg>
            )}
            {hover && model && (
                <Box sx={{
                    position: "absolute", top: 4, left: Math.min(Math.max(model.m.l, model.x(hover.step) + 8), Math.max(model.m.l, width - 170)),
                    px: 0.75, py: 0.25, bgcolor: C.raised, border: `1px solid ${C.borderStrong}`, borderRadius: "4px",
                    pointerEvents: "none", ...NUM, fontSize: FS.xs, color: C.text, whiteSpace: "nowrap"
                }}>
                    #{hover.step} · {formatMetricValue(hover.value, resolution)}{unit ? `${NBSP}${unit}` : ""}
                    {!hover.feasible && <Box component="span" sx={{ color: C.warn }}> · infeasible</Box>}
                </Box>
            )}
        </Box>
    );
});

// ============================================================================
// ЛИДЕР
// ============================================================================

const LeaderPanel = memo(function LeaderPanel({ task, bestLog, bestStepLog, bestStepNumber, isFinal, open, onToggle }) {
    const summary = bestLog?.evaluationSummary || null;
    const columns = taskMetricColumns(task);
    const values = stepMetricValues(summary, task?.spec?.objective?.name);
    const goalLabel = task?.goal === "max" ? "max" : "min";
    const allFeasible = (summary?.constraints || []).every((c) => c.feasible !== false);

    const tm = bestStepLog?.technicalMetrics || bestLog?.technicalMetrics;
    const acc = tm?.accuracy;
    const it = tm?.iterations;
    const shownValues = Object.values(values).map((v) => v.value);
    const isShown = (v) => shownValues.some((x) => sameValue(x, v));
    const errorParts = acc && Number.isFinite(acc.totalErrorScore)
        ? [["time", acc.timeIntegrationErrorC], ["grid", acc.spatialGridErrorC], ["Picard", acc.picardConvergenceErrorC]]
            .map(([n, v]) => `${n}${NBSP}${Number.isFinite(v) ? Math.abs(v).toFixed(3) : "—"}`).join("  ")
        : null;

    // Данные решателя — только то, чего нет среди метрик задачи
    const solverRows = tm ? [
        !isFinal && Number.isFinite(tm.calculationTimeMs) && ["Simulation time", `${tm.calculationTimeMs.toFixed(0)}${NBSP}ms`],
        Number.isFinite(it?.totalTimeSteps) && ["Solver steps", `${it.totalTimeSteps}${it.rejectedTimeSteps ? ` (${it.rejectedTimeSteps} rejected)` : ""}`],
        Number.isFinite(it?.totalPicardIterations) && ["Picard iterations", String(it.totalPicardIterations)],
        Number.isFinite(it?.totalGridPointsProcessed) && !isShown(it.totalGridPointsProcessed) && ["Load", `${formatMetricValue(it.totalGridPointsProcessed, 1)}${NBSP}ops`],
        errorParts && !isShown(acc.totalErrorScore) && ["Error score", acc.totalErrorScore.toFixed(3)],
        errorParts && ["Error components", errorParts]
    ].filter(Boolean) : [];

    const title = isFinal ? (allFeasible ? "Final optimum" : "Final · least violating") : "Leader";
    const titleColor = isFinal ? (allFeasible ? C.ok : C.warn) : C.textDim;

    return (
        <Panel
            sx={{ flexShrink: 0 }}
            onHeadClick={onToggle}
            headProps={{
                role: "button",
                tabIndex: 0,
                "aria-expanded": open,
                onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggle();
                    }
                }
            }}
            title={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", py: 0.5, minWidth: 0 }}>
                    {open ? <KeyboardArrowDownIcon sx={{ fontSize: 16, color: C.textMute }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: C.textMute }} />}
                    <Typography sx={{ ...headTitleSx, color: titleColor }}>{title}</Typography>
                    {bestStepNumber !== null && bestStepNumber !== undefined && (
                        // Номер шага лидера — крупно, без рамки
                        <Box component="span" sx={{ ...NUM, display: "inline-flex", alignItems: "baseline", gap: 0.5 }}>
                            <Box component="span" sx={{ color: C.textDim, fontSize: FS.xs, fontWeight: 600 }}>step</Box>
                            <Box component="span" sx={{ color: C.text, fontSize: FS.lg, fontWeight: 800, lineHeight: 1.2 }}>#{bestStepNumber}</Box>
                        </Box>
                    )}
                    {/* Свёрнутый вид: главные метрики в строку */}
                    {!open && summary && columns.map((col) => {
                        const v = values[col.name];
                        if (!v) return null;
                        return (
                            <Box key={col.name} component="span" sx={{ ...NUM, fontSize: FS.sm, ml: 1, whiteSpace: "nowrap" }}>
                                <Box component="span" sx={{ color: C.textDim }}>{col.label} </Box>
                                <Box component="span" sx={{ color: v.feasible ? C.text : C.err, fontWeight: 700 }}>
                                    {formatMetricValue(v.value, col.resolution)}
                                </Box>
                                {col.unit && <Box component="span" sx={{ color: C.textMute }}>{NBSP}{col.unit}</Box>}
                            </Box>
                        );
                    })}
                    {!summary && <Typography sx={{ color: C.textMute, fontSize: FS.sm, ml: 1 }}>no result yet</Typography>}
                </Box>
            }
        >
            {open && summary && (
                <Box sx={{ px: 1.25, py: 1 }}>
                    {/* Метрики: подпись | значение | предел | статус */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto 14px", columnGap: 1.25, rowGap: 0.5, alignItems: "baseline" }}>
                        {columns.map((col) => {
                            const v = values[col.name];
                            if (!v) return null;
                            const bound = formatBound(v.min ?? task?.metricsInfo?.[col.name]?.min, v.max ?? task?.metricsInfo?.[col.name]?.max, col.resolution);
                            return (
                                <React.Fragment key={col.name}>
                                    <Typography sx={{ color: C.textDim, fontSize: FS.sm, whiteSpace: "nowrap" }}>
                                        {col.label}
                                        {col.isObjective && <Box component="span" sx={{ color: C.accent, ml: 0.5, fontSize: FS.xs, fontWeight: 700 }}>{goalLabel.toUpperCase()}</Box>}
                                    </Typography>
                                    <Typography sx={{ ...NUM, textAlign: "right", fontSize: FS.lg, fontWeight: 700, color: v.feasible ? C.text : C.err, overflowWrap: "anywhere" }}>
                                        {formatMetricValue(v.value, col.resolution)}
                                        {col.unit && <Box component="span" sx={{ color: C.textMute, fontSize: FS.xs, fontWeight: 500 }}>{NBSP}{col.unit}</Box>}
                                    </Typography>
                                    <Typography sx={{ ...NUM, color: C.textMute, fontSize: FS.xs, whiteSpace: "nowrap" }}>{bound !== "—" ? bound : ""}</Typography>
                                    <Typography sx={{ fontSize: FS.sm, fontWeight: 700, color: v.feasible ? C.ok : C.err }}>{bound !== "—" ? (v.feasible ? "✓" : "✗") : ""}</Typography>
                                </React.Fragment>
                            );
                        })}
                    </Box>

                    {bestLog?.candidateParams && (
                        <Box sx={{ mt: 1, pt: 0.75, borderTop: `1px solid ${C.border}` }}>
                            <Typography sx={{ ...headTitleSx, color: C.textMute, mb: 0.25 }}>Parameters</Typography>
                            {Object.entries(bestLog.candidateParams).map(([name, value]) => {
                                const cfg = task?.parameters?.[name];
                                return (
                                    <KV
                                        key={name}
                                        label={cfg?.label || name}
                                        value={`${formatParamValue(name, value, task?.parameters)}${cfg?.unit ? `${NBSP}${cfg.unit}` : ""}`}
                                        strong
                                    />
                                );
                            })}
                        </Box>
                    )}

                    {solverRows.length > 0 && (
                        <Box sx={{ mt: 0.75, pt: 0.75, borderTop: `1px solid ${C.border}` }}>
                            <Typography sx={{ ...headTitleSx, color: C.textMute, mb: 0.25 }}>Solver</Typography>
                            {solverRows.map(([label, value]) => <KV key={label} label={label} value={value} color={C.textDim} />)}
                        </Box>
                    )}
                </Box>
            )}
        </Panel>
    );
});

// ============================================================================
// ЖУРНАЛ — таблица шагов
// ============================================================================

const LogRow = memo(function LogRow({ log, expanded, onToggle, task, columns, gridTemplate, isBest, compact }) {
    const isStep = Boolean(log.candidateParams) && !log.isFinalReportMarker;
    const hasDetails = Boolean(log.candidateParams);
    const mode = modeMeta(log.stepMode);
    const values = stepMetricValues(log.evaluationSummary, task?.spec?.objective?.name);
    const outcome = isStep ? stepOutcome(log) : null;
    const failed = log.type === "abort" || log.type === "error";
    const simMs = log.technicalMetrics?.calculationTimeMs;

    const toggle = () => hasDetails && onToggle(log.id);
    const onKeyDown = (e) => {
        if (hasDetails && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle(log.id);
        }
    };

    const rowBg = isBest ? C.okSoft : failed ? C.errSoft : log.isFinalReportMarker ? "rgba(231,195,90,0.08)" : "transparent";
    const stepLabel = isStep ? `#${String(log.currentStepVisual ?? "").padStart(3, "0")}` : (log.timestamp || "").slice(0, 8);

    const metricCells = columns.map((col) => {
        const v = values[col.name];
        const text = v && !(failed && !Number.isFinite(v.value)) ? formatMetricValue(v.value, col.resolution) : "—";
        const color = !v ? C.textMute : failed ? C.err : col.isObjective ? C.accent : (v.feasible ? C.text : C.warn);
        return { key: col.name, text, color, label: col.label, unit: col.unit };
    });

    return (
        <Box sx={{ borderBottom: `1px solid ${C.border}` }}>
            <Box
                role={hasDetails ? "button" : undefined}
                tabIndex={hasDetails ? 0 : undefined}
                aria-expanded={hasDetails ? expanded : undefined}
                onClick={toggle}
                onKeyDown={onKeyDown}
                sx={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    columnGap: 1.25,
                    alignItems: "baseline",
                    px: 1,
                    py: "3px",
                    bgcolor: expanded ? C.accentSoft : rowBg,
                    cursor: hasDetails ? "pointer" : "default",
                    "&:hover": { bgcolor: hasDetails ? "rgba(255,255,255,0.035)" : undefined },
                    "&:focus-visible": { outline: `1px solid ${C.accent}`, outlineOffset: -1 }
                }}
            >
                <Box sx={{ ...NUM, color: isBest ? LEADER_COLOR : C.textMute, fontWeight: isBest ? 800 : 400, whiteSpace: "nowrap" }}>
                    {stepLabel}
                </Box>
                <Box sx={{ color: mode.color, fontWeight: 700, fontSize: FS.xs, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {mode.label}
                </Box>

                {(isStep || log.isFinalReportMarker) && !compact && metricCells.map((c) => (
                    <Box key={c.key} sx={{ ...NUM, textAlign: "right", color: c.color, fontWeight: c.color === C.accent ? 700 : 500, whiteSpace: "nowrap" }}>
                        {c.text}
                    </Box>
                ))}
                {(isStep || log.isFinalReportMarker) && !compact && (
                    <Box sx={{ ...NUM, textAlign: "right", color: C.textMute, whiteSpace: "nowrap" }}>
                        {Number.isFinite(simMs) && isStep ? `${simMs.toFixed(0)}` : ""}
                    </Box>
                )}
                {(isStep || log.isFinalReportMarker) && !compact && (
                    <Box sx={{ color: isBest ? LEADER_COLOR : (outcome?.color || C.textDim), fontWeight: isBest ? 800 : 400, minWidth: 0, overflowWrap: "anywhere" }}>
                        {log.isFinalReportMarker ? cleanText(log.text) : isBest ? "★ leader" : outcome?.label}
                    </Box>
                )}

                {/* Узкий экран: метрики строкой под номером */}
                {(isStep || log.isFinalReportMarker) && compact && (
                    <Box sx={{ ...NUM, display: "flex", flexWrap: "wrap", columnGap: 1.25, minWidth: 0 }}>
                        {metricCells.map((c) => (
                            <span key={c.key}>
                                <Box component="span" sx={{ color: C.textMute }}>{c.label} </Box>
                                <Box component="span" sx={{ color: c.color, fontWeight: 700 }}>{c.text}</Box>
                            </span>
                        ))}
                        {isBest && <Box component="span" sx={{ color: LEADER_COLOR, fontWeight: 800 }}>★ leader</Box>}
                        {outcome && outcome.label !== "ok" && <Box component="span" sx={{ color: outcome.color }}>{outcome.label}</Box>}
                    </Box>
                )}

                {/* Системные сообщения: текст на всю ширину */}
                {!isStep && !log.isFinalReportMarker && (
                    <Box sx={{ gridColumn: "3 / -1", color: log.type === "error" ? C.err : log.type === "warning" ? C.warn : C.textDim, minWidth: 0, overflowWrap: "anywhere" }}>
                        {cleanText(log.text)}
                    </Box>
                )}
            </Box>

            {hasDetails && expanded && <StepDetails log={log} task={task} />}
        </Box>
    );
});

function StepDetails({ log, task }) {
    const tm = log.technicalMetrics;
    const it = tm?.iterations;
    const acc = tm?.accuracy;
    return (
        <Box sx={{ mx: 1, mb: 0.75, mt: 0.25, px: 1.25, py: 0.75, bgcolor: C.raised, borderLeft: `2px solid ${C.accent}`, borderRadius: "3px" }}>
            {(log.type === "abort" || log.type === "error") && (
                <Typography sx={{ color: C.err, fontSize: FS.sm, fontWeight: 600, mb: 0.5 }}>
                    {cleanText(log.message) || "Simulation problem encountered. Candidate discarded."}
                </Typography>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 3 }}>
                <Box>
                    {Object.entries(log.candidateParams).map(([name, value]) => {
                        const cfg = task?.parameters?.[name];
                        return <KV key={name} label={cfg?.label || name} value={`${formatParamValue(name, value, task?.parameters)}${cfg?.unit ? `${NBSP}${cfg.unit}` : ""}`} strong />;
                    })}
                </Box>
                <Box>
                    {Number.isFinite(tm?.calculationTimeMs) && <KV label="Simulation time" value={`${tm.calculationTimeMs.toFixed(1)}${NBSP}ms`} color={C.textDim} />}
                    {Number.isFinite(it?.totalTimeSteps) && (
                        <KV label="Solver steps" value={`${it.totalTimeSteps}${it.rejectedTimeSteps ? ` (${it.rejectedTimeSteps} rejected)` : ""}`} color={it.rejectedTimeSteps ? C.warn : C.textDim} />
                    )}
                    {Number.isFinite(it?.totalPicardIterations) && <KV label="Picard iterations" value={it.totalPicardIterations} color={C.textDim} />}
                    {Number.isFinite(it?.totalGridPointsProcessed) && <KV label="Load" value={`${formatMetricValue(it.totalGridPointsProcessed, 1)}${NBSP}ops`} color={C.textDim} />}
                    {Number.isFinite(acc?.totalErrorScore) && (
                        <KV
                            label="Error: time / grid / Picard"
                            value={[acc.timeIntegrationErrorC, acc.spatialGridErrorC, acc.picardConvergenceErrorC].map((v) => (Number.isFinite(v) ? Math.abs(v).toFixed(3) : "—")).join(" / ")}
                            color={C.textDim}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}

// ============================================================================
// ОСНОВНОЙ КОМПОНЕНТ
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

    const applicableTasks = useMemo(() => getApplicableTasks(baseParams), [baseParams]);
    const [selectedTaskId, setSelectedTaskId] = useState(DEFAULT_TASK_ID);
    useEffect(() => {
        if (!applicableTasks.some((t) => t.id === selectedTaskId) && applicableTasks.length > 0) {
            setSelectedTaskId(applicableTasks[0].id);
        }
    }, [applicableTasks, selectedTaskId]);

    const activeTask = useMemo(() => resolveOptimizerTask(selectedTaskId, baseParams), [selectedTaskId, baseParams]);
    const budget = useMemo(() => getAdaptiveOptimizerBudget(activeTask), [activeTask]);
    const columns = useMemo(() => taskMetricColumns(activeTask), [activeTask]);
    const objectiveInfo = columns.find((c) => c.isObjective) || metricInfo(activeTask, activeTask.spec?.objective?.name);

    // --- Состояние прогона ---
    const [runStatus, setRunStatus] = useState("idle");
    const [logs, setLogs] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [bestStepNumber, setBestStepNumber] = useState(null);
    const [live, setLive] = useState(null); // { step, percent, thinking }
    const [completedSteps, setCompletedSteps] = useState(0);
    const [totalBudget, setTotalBudget] = useState(budget.totalIterations);
    const [timer, setTimer] = useState({ startedAt: null, baseSeconds: 0 });
    const [hasResult, setHasResult] = useState(false);
    // Лидер во время расчёта свёрнут (видна строка с главным), по завершении раскрыт
    const [leaderOpen, setLeaderOpen] = useState(true);

    const isRunning = runStatus === "running" || runStatus === "stopping";

    // --- Web Worker создаётся один раз; обработчик берётся из ref ---
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
                percent: Number.isFinite(Number(msg.percent)) ? Math.max(0, Math.min(100, Number(msg.percent))) : 0
            });
            return;
        }
        if (msg.status === "log_step" && msg.logEntry) {
            const entry = msg.logEntry;
            // Предупреждение модели у обычного шага — не ошибка оптимизации
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

        const widthHalfMm = baseParams.simulation.widthHalfMm;
        const paramOverrides = Object.fromEntries(
            Object.entries(activeTask.parameters)
                .filter(([key]) => !(widthHalfMm === 0 && key === "gridDensityY"))
                .map(([key, { label, path, unit, min, max, step }]) => [key, { label, path, unit, min, max, step }])
        );
        workerRef.current.postMessage({
            command: "start",
            baseParams: { ...baseParams, material: { ...baseParams.material }, machine: { ...baseParams.machine } },
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
    const stepLogs = useMemo(() => logs.filter((l) => l.candidateParams && !l.isFinalReportMarker && Number.isFinite(l.currentStepVisual)), [logs]);

    const stats = useMemo(() => {
        let feasible = 0, infeasible = 0, aborted = 0, errors = 0, simMs = 0;
        for (const l of stepLogs) {
            if (l.type === "abort") aborted++;
            else if (l.type === "error") errors++;
            else if ((l.evaluationSummary?.constraints || []).some((c) => c.feasible === false)) infeasible++;
            else feasible++;
            if (Number.isFinite(l.technicalMetrics?.calculationTimeMs)) simMs += l.technicalMetrics.calculationTimeMs;
        }
        return { evaluated: stepLogs.length, feasible, infeasible, aborted, errors, avgSimMs: stepLogs.length ? simMs / stepLogs.length : null };
    }, [stepLogs]);

    const chartPoints = useMemo(() => stepLogs
        .filter((l) => l.type !== "abort" && l.type !== "error" && Number.isFinite(l.evaluationSummary?.objective?.value))
        .map((l) => ({
            step: l.currentStepVisual,
            value: l.evaluationSummary.objective.value,
            feasible: (l.evaluationSummary.constraints || []).every((c) => c.feasible !== false)
        })), [stepLogs]);

    const bestStepLog = useMemo(() => {
        if (bestStepNumber === null) return null;
        for (let i = stepLogs.length - 1; i >= 0; i--) if (stepLogs[i].currentStepVisual === bestStepNumber) return stepLogs[i];
        return null;
    }, [stepLogs, bestStepNumber]);

    // Лидер: итоговый отчёт, иначе лучший шаг
    const bestLog = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) if (logs[i].isFinalReportMarker) return logs[i];
        return bestStepLog;
    }, [logs, bestStepLog]);

    const toggleExpand = useCallback((id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] })), []);
    const toggleLeader = useCallback(() => setLeaderOpen((v) => !v), []);

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

    // --- Прокрутка журнала как в терминале: у нижнего края следует за новыми строками ---
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
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, []);

    // --- Прогресс ---
    const stepFraction = isRunning && live && !live.thinking ? live.percent / 100 : 0;
    const overallProgress = totalBudget > 0
        ? Math.min(100, ((runStatus === "done" ? totalBudget : completedSteps + stepFraction) / totalBudget) * 100)
        : 0;
    const statusMeta = STATUS_META[runStatus];
    const goalLabel = activeTask.goal === "max" ? "max" : "min";
    const liveIsInit = live && live.step <= budget.initPoints;

    // Колонки таблицы журнала: шаг | режим | метрики… | время, мс | итог
    const gridTemplate = isMobile
        ? "56px 52px minmax(0, 1fr)"
        : `62px 56px ${columns.map(() => "minmax(84px, max-content)").join(" ")} 56px minmax(80px, 1fr)`;

    // ========================================================================
    // РЕНДЕР
    // ========================================================================
    const header = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 1.25, md: 2 }, py: 0.75, bgcolor: C.panel, borderBottom: `1px solid ${C.border}`, flexWrap: { xs: "wrap", md: "nowrap" } }}>
            <InsightsIcon sx={{ color: C.accent, fontSize: 20 }} />
            <Typography sx={{ color: C.text, fontWeight: 700, fontSize: FS.lg, whiteSpace: "nowrap" }}>Optimizer</Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1, py: "2px", borderRadius: "10px", bgcolor: "rgba(255,255,255,0.04)", border: `1px solid ${statusMeta.color}` }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: statusMeta.color }} />
                <Typography sx={{ color: statusMeta.color, fontSize: FS.xs, fontWeight: 700, letterSpacing: "0.04em" }}>{statusMeta.label}</Typography>
            </Box>
            <Box sx={{ ...NUM, display: { xs: "none", md: "flex" }, gap: 2, ml: 1, color: C.textDim, fontSize: FS.sm, whiteSpace: "nowrap" }}>
                <span>Budget <Box component="span" sx={{ color: C.text }}>{budget.totalIterations}</Box> · init <Box component="span" sx={{ color: C.text }}>{budget.initPoints}</Box></span>
                <span>Params <Box component="span" sx={{ color: C.text }}>{Object.keys(activeTask.parameters || {}).length}</Box></span>
                <span>Elapsed <ElapsedTimer startedAt={timer.startedAt} baseSeconds={timer.baseSeconds} running={timer.startedAt !== null} /></span>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <TextField
                select
                size="small"
                value={applicableTasks.some((t) => t.id === selectedTaskId) ? selectedTaskId : ""}
                onChange={(e) => changeTask(e.target.value)}
                disabled={isRunning}
                slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { bgcolor: C.panel, color: C.text, border: `1px solid ${C.border}`, "& .MuiMenuItem-root": { fontSize: FS.md } } } } } } }}
                sx={{
                    order: { xs: 10, md: 0 },
                    width: { xs: "100%", md: 300 },
                    "& .MuiInputBase-root": { color: C.text, fontSize: FS.md, bgcolor: C.bg, height: 30 },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: C.borderStrong },
                    "& .MuiSvgIcon-root": { color: C.textDim },
                    "& .Mui-disabled": { WebkitTextFillColor: C.textDim }
                }}
            >
                {applicableTasks.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
            </TextField>
            <Tooltip title={isRunning ? "Stop the optimization first" : "Close"}>
                <span>
                    <IconButton aria-label="close" size="small" onClick={onClose} disabled={isRunning} sx={{ color: C.textDim }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );

    const progressPanel = (
        <Panel
            title="Run"
            right={
                <Box sx={{ ...NUM, fontSize: FS.sm, color: C.textDim, display: "flex", gap: 1.5 }}>
                    <Box component="span" sx={{ display: { md: "none" } }}>
                        <ElapsedTimer startedAt={timer.startedAt} baseSeconds={timer.baseSeconds} running={timer.startedAt !== null} />
                    </Box>
                    <span><Box component="span" sx={{ color: C.text, fontWeight: 700 }}>{completedSteps}</Box> / {totalBudget}</span>
                </Box>
            }
            bodySx={{ px: 1.25, py: 1, display: "flex", flexDirection: "column", gap: 0.75 }}
        >
            <LinearProgress
                variant="determinate"
                value={overallProgress}
                sx={{ height: 4, borderRadius: 2, bgcolor: C.border, "& .MuiLinearProgress-bar": { bgcolor: runStatus === "done" ? C.ok : C.accent, borderRadius: 2 } }}
            />
            {isRunning && live && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ ...NUM, color: C.textDim, fontSize: FS.sm, whiteSpace: "nowrap" }}>
                        {live.thinking ? `Model choosing step ${live.step}` : `${liveIsInit ? "Init" : "Step"} ${live.step} · simulation`}
                    </Typography>
                    <LinearProgress
                        variant={live.thinking ? "indeterminate" : "determinate"}
                        value={live.percent}
                        sx={{ flexGrow: 1, height: 3, borderRadius: 2, bgcolor: C.border, "& .MuiLinearProgress-bar": { bgcolor: C.ok } }}
                    />
                    <Typography sx={{ ...NUM, color: C.ok, fontSize: FS.sm, minWidth: 30, textAlign: "right" }}>
                        {live.thinking ? "" : `${Math.round(live.percent)}%`}
                    </Typography>
                </Box>
            )}

            {/* Цель и пределы */}
            <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: "2px", fontSize: FS.sm }}>
                <Typography sx={{ color: C.textMute, fontSize: FS.sm }}>Goal</Typography>
                <Typography sx={{ ...NUM, color: C.accent, fontSize: FS.sm, fontWeight: 700 }}>
                    {goalLabel} {objectiveInfo.label}{objectiveInfo.unit ? ` [${objectiveInfo.unit}]` : ""}
                </Typography>
                {columns.filter((c) => Number.isFinite(c.min) || Number.isFinite(c.max)).map((c) => (
                    <React.Fragment key={c.name}>
                        <Typography sx={{ color: C.textMute, fontSize: FS.sm }}>Limit</Typography>
                        <Typography sx={{ ...NUM, color: C.text, fontSize: FS.sm }}>
                            {c.label} {formatBound(c.min, c.max, c.resolution)}{c.unit ? `${NBSP}${c.unit}` : ""}
                        </Typography>
                    </React.Fragment>
                ))}
            </Box>

            {/* Сводка по шагам */}
            <Box sx={{ ...NUM, display: "flex", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.25, fontSize: FS.sm, color: C.textDim, pt: 0.5, borderTop: `1px solid ${C.border}` }}>
                <span>evaluated <Box component="span" sx={{ color: C.text }}>{stats.evaluated}</Box></span>
                <span>feasible <Box component="span" sx={{ color: C.ok }}>{stats.feasible}</Box></span>
                <span>infeasible <Box component="span" sx={{ color: stats.infeasible ? C.warn : C.text }}>{stats.infeasible}</Box></span>
                <span>aborted <Box component="span" sx={{ color: stats.aborted ? C.err : C.text }}>{stats.aborted}</Box></span>
                {stats.errors > 0 && <span>errors <Box component="span" sx={{ color: C.err }}>{stats.errors}</Box></span>}
                {Number.isFinite(stats.avgSimMs) && <span>avg sim <Box component="span" sx={{ color: C.text }}>{stats.avgSimMs.toFixed(0)}{NBSP}ms</Box></span>}
            </Box>
        </Panel>
    );

    const leaderPanel = (
        <LeaderPanel
            task={activeTask}
            bestLog={bestLog}
            bestStepLog={bestStepLog}
            bestStepNumber={bestStepNumber}
            isFinal={Boolean(bestLog?.isFinalReportMarker)}
            open={leaderOpen}
            onToggle={toggleLeader}
        />
    );

    const chartPanel = (
        <Panel
            title="Convergence"
            sx={{ flexShrink: 0 }}
            right={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, fontSize: FS.xs, color: C.textDim }}>
                    <span><Box component="span" sx={{ color: C.accent }}>●</Box> feasible</span>
                    <span><Box component="span" sx={{ color: C.warn }}>○</Box> infeasible</span>
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block" }}>
                            <circle cx="5" cy="5" r="3.4" fill={C.accent} stroke={C.ok} strokeWidth="1.6" />
                        </svg>
                        best
                    </Box>
                </Box>
            }
            bodySx={{ px: 0.75, py: 0.75 }}
        >
            <ConvergenceChart
                points={chartPoints}
                goal={activeTask.goal}
                unit={objectiveInfo.unit}
                resolution={objectiveInfo.resolution}
                bestStep={bestStepNumber}
                height={isMobile ? 150 : 180}
            />
        </Panel>
    );

    const logHeader = !isMobile && (
        <Box sx={{
            display: "grid", gridTemplateColumns: gridTemplate, columnGap: 1.25, px: 1, py: 0.5,
            bgcolor: C.panel, borderBottom: `1px solid ${C.borderStrong}`, position: "sticky", top: 0, zIndex: 1,
            fontSize: FS.xs, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMute
        }}>
            <span>Step</span>
            <span>Mode</span>
            {columns.map((c) => (
                <Box key={c.name} component="span" sx={{ textAlign: "right", whiteSpace: "nowrap", color: c.isObjective ? C.accent : C.textMute }}>
                    {c.label}{c.unit ? <Box component="span" sx={{ textTransform: "none", fontWeight: 500 }}>{` ${c.unit}`}</Box> : null}
                </Box>
            ))}
            <Box component="span" sx={{ textAlign: "right" }}>Sim ms</Box>
            <span>Result</span>
        </Box>
    );

    const logPanel = (
        <Panel
            title="Evaluation log"
            sx={{ position: "relative", flexGrow: 1, minHeight: { xs: "50vh", md: 0 }, height: { md: "100%" } }}
            right={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {!following && logs.length > 0 && (
                        <Box component="span" sx={{ color: C.warn, fontSize: FS.xs, fontWeight: 700, letterSpacing: "0.06em" }}>SCROLL PAUSED</Box>
                    )}
                    <Box component="span" sx={{ ...NUM, color: C.textMute, fontSize: FS.xs }}>{logs.length} lines</Box>
                </Box>
            }
            bodySx={{ flexGrow: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
            {!following && logs.length > 0 && (
                <Button
                    size="small"
                    onClick={jumpToLatest}
                    startIcon={<KeyboardArrowDownIcon />}
                    sx={{
                        position: "absolute", right: 14, bottom: 12, zIndex: 2, textTransform: "none", fontWeight: 700, fontSize: FS.sm,
                        borderRadius: "14px", px: 1.25, py: 0.25, color: "#fff", bgcolor: unseen > 0 ? C.accent : C.borderStrong,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.45)", "&:hover": { bgcolor: unseen > 0 ? "#3b7af0" : C.border }
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
                    overflowX: "auto",
                    overflowAnchor: "none",
                    overscrollBehavior: "contain",
                    maxHeight: { xs: "70vh", md: "none" },
                    bgcolor: C.bg,
                    fontFamily: MONO,
                    fontSize: FS.sm,
                    lineHeight: 1.45,
                    color: C.text
                }}
            >
                {logHeader}
                {logs.length === 0 ? (
                    <Typography sx={{ color: C.textMute, textAlign: "center", mt: 4, fontSize: FS.md }}>
                        Select a task and press Start.
                    </Typography>
                ) : (
                    logs.map((log) => (
                        <LogRow
                            key={log.id}
                            log={log}
                            expanded={Boolean(expanded[log.id])}
                            onToggle={toggleExpand}
                            task={activeTask}
                            columns={columns}
                            gridTemplate={gridTemplate}
                            compact={isMobile}
                            isBest={!log.isFinalReportMarker && bestStepNumber !== null && log.currentStepVisual === bestStepNumber && Boolean(log.candidateParams)}
                        />
                    ))
                )}
            </Box>
        </Panel>
    );

    const btnSx = { textTransform: "none", fontWeight: 600, fontSize: FS.md, borderRadius: "5px", px: 1.75, py: 0.5, whiteSpace: "nowrap", minHeight: 30 };
    const actions = (
        <Box sx={{
            display: "flex", alignItems: "center", gap: 1, px: { xs: 1.25, md: 2 }, py: 0.75,
            bgcolor: C.panel, borderTop: `1px solid ${C.border}`, flexWrap: "wrap", justifyContent: "flex-end",
            pb: { xs: "calc(8px + env(safe-area-inset-bottom))", md: 0.75 }
        }}>
            {isRunning ? (
                <>
                    <Button variant="outlined" onClick={finishNow} disabled={runStatus === "stopping"} startIcon={<StopIcon />}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.warn, borderColor: "rgba(233,162,59,0.5)" }}>
                        {runStatus === "stopping" ? "Finishing…" : "Finish & keep best"}
                    </Button>
                    <Button variant="outlined" onClick={abort} startIcon={<BlockIcon />}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.err, borderColor: "rgba(239,91,91,0.5)" }}>
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
                                sx={{ ...btnSx, flex: { xs: 1, md: "none" }, color: C.accent, borderColor: "rgba(76,141,255,0.5)" }}>
                            Continue (+{budget.totalIterations})
                        </Button>
                    )}
                    <Button variant={hasResult ? "outlined" : "contained"} onClick={start} startIcon={<PlayArrowIcon />}
                            disabled={applicableTasks.length === 0}
                            sx={{ ...btnSx, flex: { xs: 1, md: "none" }, ...(hasResult ? { color: C.text, borderColor: C.borderStrong } : { bgcolor: C.accent, color: "#fff", boxShadow: "none" }) }}>
                        {runStatus === "idle" ? "Start" : "Run again"}
                    </Button>
                    {hasResult && (
                        <Button variant="contained" onClick={applyParameters} startIcon={<CheckIcon />} disabled={!bestLog?.candidateParams}
                                sx={{ ...btnSx, flex: { xs: "1 1 100%", md: "none" }, bgcolor: C.ok, color: "#fff", boxShadow: "none", "&:hover": { bgcolor: "#249e63" } }}>
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
                    p: { xs: 0.75, md: 1.25 },
                    gap: { xs: 0.75, md: 1.25 },
                    overflowY: { xs: "auto", md: "hidden" },
                    display: { xs: "flex", md: "grid" },
                    flexDirection: "column",
                    // Десктоп: сводка слева, журнал справа
                    gridTemplateColumns: { md: "minmax(360px, 31%) minmax(0, 1fr)" }
                }}
            >
                <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 0.75, md: 1.25 }, minHeight: 0, overflowY: { md: "auto" } }}>
                    {progressPanel}
                    {leaderPanel}
                    {chartPanel}
                </Box>
                <Box sx={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
                    {logPanel}
                </Box>
            </Box>
            {actions}
        </Dialog>
    );
}
