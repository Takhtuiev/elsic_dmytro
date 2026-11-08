/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed } = require('./optimizer.js');
    const { simulate2DHeating } = require('./heating2DModel.js');

    function getTimestamp() {
        return new Date().toLocaleTimeString("uk-UA", { hour12: false });
    }

    self.onmessage = function (e) {
        const { baseParams, options } = e.data;

        const workerStartTime = performance.now();

        let totalSimulationsExecuted = 0;
        const fixedHeatingPercent = 90;

        self.lastEvaluatedBestParams = null;
        self.lastEvaluatedBestMetrics = null;

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
                    message: snapshot.message
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
                percent: snapshot.percent,
                currentExecutionCount: snapshot.currentStepVisual,
                totalIterations: totalIterations,
                currentParams: snapshot.candidateParams,
                technicalMetrics: snapshot.technicalMetrics,
                bestStepNumber: snapshot.bestStepNumber
            });
        };
        try {
            const result = optimizeForMaxSpeed(
                baseParams,
                simulateWithDynamicProgress,
                {
                    ...options,
                    onProgress: progressHandler
                }
            );

            const durationMs = performance.now() - workerStartTime;

            const finalReportSnapshot = {
                currentStepVisual: self.lastEvaluatedBestStepNumber || totalSimulationsExecuted,
                status: "SUCCESS",
                percent: 100,
                candidateParams: result.optimalLimits,
                technicalMetrics: {
                    calculationTimeMs: durationMs,
                    iterations: { totalGridPointsProcessed: result.metrics?.achievedLoad || 0 },
                    accuracy: { totalErrorScore: result.metrics?.resultingErrorScore || 0 }
                },
                message: null,
                bestStepNumber: self.lastEvaluatedBestStepNumber
            };

            sendStructuredLog(
                "FINAL_REPORT",
                "🏆 Optimization successfully completed! Final optimal parameters selected.",
                finalReportSnapshot
            );

            // Родной коллбек успеха (остается без изменений)
            self.postMessage({
                status: 'success',
                data: result
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
