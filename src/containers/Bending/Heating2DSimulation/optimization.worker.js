/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed } = require('./optimizer.js');
    const { simulate2DHeating } = require('./heating2DModel.js');

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
            self.lastEvaluatedBestParams = null;
            self.lastEvaluatedBestMetrics = null;
            self.lastEvaluatedBestStepNumber = null;
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
                status: 'log_step',
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
                    isFinalReportMarker: Boolean(snapshot.isFinalReportMarker),
                    finalMetricsCache: snapshot.finalMetricsCache || null
                }
            });
        };

        self.optimizerStructuredLogger = sendStructuredLog;

        const simulateWithDynamicProgress = (params) => {
            const simulationParams = {
                ...params,
                simulation: {
                    ...(params.simulation || {}),
                    calculateAccuracyError: true,
                    maxHeatingPercent: fixedHeatingPercent
                }
            };

            const result = simulate2DHeating(simulationParams);
            totalSimulationsExecuted++;
            return result;
        };

        const progressHandler = (percent, currentExecutionCount, totalIterations, snapshot) => {
            if (snapshot.status === "ABORT" || snapshot.status === "ERROR") {
                sendStructuredLog("BAYES", snapshot.message || "Simulation stopped", snapshot);
                return;
            }

            self.postMessage({
                status: 'progress_tick',
                snapshotStatus: snapshot.status,
                percent: snapshot.percent,
                currentExecutionCount: snapshot.currentStepVisual,
                totalIterations: totalIterations,
                currentParams: snapshot.candidateParams,
                technicalMetrics: snapshot.technicalMetrics,
                bestStepNumber: snapshot.bestStepNumber
            });
        };

        try {
            const result = await optimizeForMaxSpeed(
                baseParams,
                simulateWithDynamicProgress,
                {
                    ...options,
                    resumeState: activeResumeState,
                    shouldStop: () => stopRequested,
                    onProgress: progressHandler
                }
            );

            savedResumeState = result.resumeState;
            const cleanResult = { ...result };
            delete cleanResult.resumeState;

            const durationMs = performance.now() - workerStartTime;

            const finalReportSnapshot = {
                currentStepVisual: totalSimulationsExecuted,
                status: "SUCCESS",
                percent: 100,
                candidateParams: cleanResult.optimalLimits,
                technicalMetrics: {
                    calculationTimeMs: durationMs,
                    iterations: {
                        totalGridPointsProcessed: cleanResult.metrics?.achievedLoad || 0,
                        totalTimeSteps: self.lastEvaluatedBestMetrics?.iterations?.totalTimeSteps
                    },
                    accuracy: {
                        totalErrorScore: cleanResult.metrics?.resultingErrorScore || 0
                    }
                },
                message: null,
                bestStepNumber: self.lastEvaluatedBestStepNumber,
                isFinalReportMarker: true,
                finalMetricsCache: {
                    ...cleanResult.metrics,
                    iterations: self.lastEvaluatedBestMetrics?.iterations || {}
                }
            };

            sendStructuredLog(
                "FINAL_REPORT",
                stopRequested
                    ? "⏹️ Optimization stopped by user! Best found parameters selected."
                    : "🏆 Optimization successfully completed! Final optimal parameters selected.",
                finalReportSnapshot
            );

            self.postMessage({
                status: 'success',
                data: cleanResult
            });
        } catch (error) {
            self.postMessage({
                status: 'error',
                error: error?.message || String(error)
            });
        }
    };

} catch (importError) {
    self.onmessage = function () {
        self.postMessage({
            status: 'error',
            error: 'Worker crash: ' + (importError?.message || String(importError))
        });
    };
}
