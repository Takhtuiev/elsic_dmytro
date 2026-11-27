/* eslint-disable no-restricted-globals */
import { optimizeForMaxSpeed } from "./optimizer.js";
import { simulate2DHeating } from "./heating2DModel.js";
import { resolveOptimizerTask, DEFAULT_TASK_ID } from "./optimizer.config.js";

// Доля прогресса одной симуляции, отводимая на нагрев (остальное — охлаждение)
const FIXED_HEATING_PERCENT = 90;
// Не чаще одного обновления прогресса в UI за этот интервал (мс)
const UI_TICK_INTERVAL_MS = 50;

const getTimestamp = () => new Date().toLocaleTimeString("uk-UA", { hour12: false });

// Состояние предыдущего запуска: «Продолжить» обязано работать с теми же
// исходными данными и той же задачей, на которых обучена модель
let lastRun = null; // { resumeState, baseParams, taskId, paramOverrides }
let stopRequested = false;
let isRunning = false;

const postLog = (stepMode, text, snapshot) => {
    self.postMessage({
        status: "log_step",
        logEntry: {
            stepMode: stepMode || "BAYES",
            type: { SUCCESS: "info", WARN: "warning", ABORT: "abort", ERROR: "error" }[snapshot.status] || "info",
            text: text || "Simulation completed",
            timestamp: getTimestamp(),
            candidateParams: snapshot.candidateParams,
            technicalMetrics: snapshot.technicalMetrics,
            currentStepVisual: snapshot.currentStepVisual,
            bestStepNumber: snapshot.bestStepNumber,
            message: snapshot.message,
            evaluationSummary: snapshot.evaluationSummary || null,
            isFinalReportMarker: Boolean(snapshot.isFinalReportMarker),
            finalMetricsCache: snapshot.finalMetricsCache || null
        }
    });
};

async function run(command, data) {
    const isContinue = command === "continue";
    if (isContinue && !lastRun?.resumeState) {
        isRunning = false;
        self.postMessage({ status: "error", error: "Nothing to continue: run the optimization first." });
        return;
    }

    // При продолжении берём исходные данные прошлого запуска, а не текущие из UI
    const baseParams = isContinue ? lastRun.baseParams : data.baseParams;
    const taskId = isContinue ? lastRun.taskId : (data.options?.taskId || DEFAULT_TASK_ID);
    const paramOverrides = isContinue ? lastRun.paramOverrides : (data.options?.paramOverrides || null);
    const resumeState = isContinue ? lastRun.resumeState : null;

    const task = resolveOptimizerTask(taskId, baseParams, paramOverrides, data.options?.settingsOverrides || null);
    const workerStartTime = performance.now();

    const simulate = (params) => simulate2DHeating({
        ...params,
        simulation: { ...params.simulation, maxHeatingPercent: FIXED_HEATING_PERCENT }
    });

    // Модель сообщает прогресс каждые 2 % (это нужно оптимизатору для ранних обрывов),
    // а интерфейсу хватает ~20 обновлений в секунду
    let lastTickMs = 0;
    const onProgress = (_percent, _count, totalIterations, snapshot) => {
        const now = performance.now();
        const isRoutineTick = snapshot.status === "RUNNING" && snapshot.percent < 100;
        if (isRoutineTick && now - lastTickMs < UI_TICK_INTERVAL_MS) return;
        lastTickMs = now;
        self.postMessage({
            status: "progress_tick",
            snapshotStatus: snapshot.status,
            percent: snapshot.percent,
            currentExecutionCount: snapshot.currentStepVisual,
            totalIterations,
            currentParams: snapshot.candidateParams,
            technicalMetrics: snapshot.technicalMetrics,
            bestStepNumber: snapshot.bestStepNumber
        });
    };

    const result = await optimizeForMaxSpeed(baseParams, simulate, {
        task,
        resumeState,
        shouldStop: () => stopRequested,
        onProgress,
        onStructuredLog: postLog
    });

    lastRun = { resumeState: result.resumeState, baseParams, taskId, paramOverrides };
    const { resumeState: _omit, ...cleanResult } = result;
    const metrics = cleanResult.metrics || {};
    const bestTm = metrics.technicalMetrics || {};

    const finalMessage = stopRequested
        ? "Optimization stopped by user. Best parameters found so far are selected."
        : metrics.isFallbackActivated
            ? "No configuration satisfied all constraints. The least-violating parameters are selected."
            : "Optimization completed. Optimal parameters selected.";

    postLog("FINAL_REPORT", finalMessage, {
        currentStepVisual: metrics.searchStepsMade,
        status: "SUCCESS",
        percent: 100,
        candidateParams: cleanResult.optimalLimits,
        technicalMetrics: { ...bestTm, calculationTimeMs: performance.now() - workerStartTime },
        evaluationSummary: {
            objective: { value: metrics.achievedValue ?? null, goal: metrics.appliedObjective || task.goal || "min", unit: task.unit || "" },
            constraints: metrics.constraints || []
        },
        message: null,
        bestStepNumber: metrics.bestStepNumber ?? null,
        isFinalReportMarker: true,
        finalMetricsCache: { ...metrics, unit: task.unit || "", iterations: bestTm.iterations || {} }
    });

    // Флаг снимаем до ответа: UI может сразу прислать «continue»
    isRunning = false;
    self.postMessage({ status: "success", data: cleanResult });
}

self.onmessage = async (e) => {
    const { command = "start", ...data } = e.data || {};

    if (command === "finish_now") {
        stopRequested = true;
        return;
    }
    if (isRunning) {
        self.postMessage({ status: "error", error: "Optimization is already running." });
        return;
    }
    if (command === "start") lastRun = null;

    stopRequested = false;
    isRunning = true;
    try {
        await run(command, data);
    } catch (error) {
        isRunning = false;
        self.postMessage({ status: "error", error: error?.message || String(error) });
    }
};
