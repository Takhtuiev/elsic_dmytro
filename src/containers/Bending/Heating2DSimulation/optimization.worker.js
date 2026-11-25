/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed: runBayesianOptimization } = require("./optimizer.js");
    const { simulate2DHeating } = require("./heating2DModel.js");
    const { resolveOptimizerTask, DEFAULT_TASK_ID } = require("./optimizer.config.js");

    function getTimestamp() {
        return new Date().toLocaleTimeString("uk-UA", { hour12: false });
    }

    let savedResumeState = null;
    let stopRequested = false;

    self.onmessage = async function (e) {
        const { command = "start", baseParams, options } = e.data;

        if (command === "finish_now") {
            stopRequested = true;
            return;
        }

        if (command === "start") {
            savedResumeState = null;
        }

        stopRequested = false;
        const activeResumeState = command === "continue" ? savedResumeState : null;
        const workerStartTime = performance.now();

        let totalSimulationsExecuted = activeResumeState ? activeResumeState.currentExecutionCount : 0;
        const fixedHeatingPercent = 90;

        const sendStructuredLog = function (stepMode, rawStatusMessage, snapshot) {
            const logTypeMap = {
                "SUCCESS": "info",
                "WARN": "warning",
                "ABORT": "abort",
                "ERROR": "error"
            };

            self.postMessage({
                status: "log_step",
                logEntry: {
                    stepMode: stepMode || "BAYES",
                    type: logTypeMap[snapshot.status] || "info",
                    text: rawStatusMessage || "Simulation completed",
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

        self.optimizerStructuredLogger = sendStructuredLog;

        const task = resolveOptimizerTask(
            options?.taskId || DEFAULT_TASK_ID,
            baseParams,
            options?.paramOverrides || null,
            options?.settingsOverrides || null
        );

        const simulateWithDynamicProgress = (params) => {
            const simulationParams = {
                ...params,
                simulation: {
                    ...(params.simulation || {}),
                    ...(task.simOverrides || {}),
                    maxHeatingPercent: fixedHeatingPercent
                }
            };

            const result = simulate2DHeating(simulationParams);
            totalSimulationsExecuted++;
            return result;
        };

        const progressHandler = (percent, _currentExecutionCount, totalIterations, snapshot) => {
            if (snapshot.status === "ABORT" || snapshot.status === "ERROR") {
                sendStructuredLog("BAYES", snapshot.message || "Simulation stopped", snapshot);
                return;
            }

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

        try {
            const result = await runBayesianOptimization(
                baseParams,
                simulateWithDynamicProgress,
                {
                    ...options,
                    task,
                    resumeState: activeResumeState,
                    shouldStop: () => stopRequested,
                    onProgress: progressHandler,
                    onStructuredLog: sendStructuredLog
                }
            );

            savedResumeState = result.resumeState;
            const cleanResult = { ...result };
            delete cleanResult.resumeState;

            const durationMs = performance.now() - workerStartTime;

            const bestTm = cleanResult.metrics?.technicalMetrics || {};

            const finalEvaluationSummary = {
                objective: {
                    value: cleanResult.metrics?.achievedValue ?? null,
                    goal: cleanResult.metrics?.appliedObjective || task.goal || "min",
                    unit: task.unit || ""
                },
                constraints: cleanResult.metrics?.constraints || []
            };

            const finalReportSnapshot = {
                currentStepVisual: totalSimulationsExecuted,
                status: "SUCCESS",
                percent: 100,
                candidateParams: cleanResult.optimalLimits,
                technicalMetrics: {
                    ...bestTm,
                    calculationTimeMs: durationMs
                },
                evaluationSummary: finalEvaluationSummary,
                message: null,
                bestStepNumber: cleanResult.metrics?.bestStepNumber ?? null,
                isFinalReportMarker: true,
                finalMetricsCache: {
                    ...cleanResult.metrics,
                    unit: task.unit || "",
                    iterations: bestTm.iterations || {}
                }
            };

            const finalMessage = stopRequested
                ? "⏹️ Optimization stopped by user! Best found parameters selected."
                : cleanResult.metrics?.isFallbackActivated
                    ? "⚠️ No configuration satisfied all constraints. The least-violating parameters were selected."
                    : "🏆 Optimization successfully completed! Final optimal parameters selected.";

            sendStructuredLog("FINAL_REPORT", finalMessage, finalReportSnapshot);

            self.postMessage({
                status: "success",
                data: cleanResult
            });
        } catch (error) {
            self.postMessage({
                status: "error",
                error: error?.message || String(error)
            });
        }
    };
} catch (importError) {
    self.onmessage = function () {
        self.postMessage({
            status: "error",
            error: "Worker crash: " + (importError?.message || String(importError))
        });
    };
}