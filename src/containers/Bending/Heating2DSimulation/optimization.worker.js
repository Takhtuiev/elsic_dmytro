/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed } = require('./optimizer.js');
    const { simulate2DHeating } = require('./heating2DModel.js');

    function getTimestamp() {
        return new Date().toLocaleTimeString("uk-UA", { hour12: false });
    }

    self.onmessage = function (e) {
        const { baseParams, options } = e.data;

        let totalSimulationsExecuted = 0;
        let dynamicHeatingPercent = 90;
        let bestErrorScore = Infinity;

        self.lastEvaluatedBestParams = null;
        self.lastEvaluatedBestMetrics = null;

        const sendStructuredLog = function (type, text, forcedParams = null, forcedMetrics = null, bestStepNumber = null) {
            let safeMetrics = null;

            const isErrorOrWarn = type === 'error' || type === 'warning' || text.includes('exception') || text.includes('[ABORT]');
            const activeMetrics = forcedMetrics || (isErrorOrWarn ? null : self.lastEvaluatedBestMetrics);

            if (activeMetrics) {
                safeMetrics = {
                    calculationTimeMs: activeMetrics.calculationTimeMs,
                    accuracy: activeMetrics.accuracy ? {
                        ...activeMetrics.accuracy,
                        totalErrorScore: activeMetrics.accuracy.totalErrorScore,
                        timeIntegrationErrorC: activeMetrics.accuracy.timeIntegrationErrorC,
                        spatialGridErrorC: activeMetrics.accuracy.spatialGridErrorC,
                        solverErrorC: activeMetrics.accuracy.solverErrorC
                    } : null,
                    iterations: activeMetrics.iterations ? { ...activeMetrics.iterations } : null
                };
            }

            const stepNumber = forcedParams ? self.currentRunningStepNumber : (self.currentRunningStepNumber || totalSimulationsExecuted);

            self.postMessage({
                status: 'log_step',
                logEntry: {
                    type: type,
                    text: text,
                    timestamp: getTimestamp(),
                    candidateParams: forcedParams || (isErrorOrWarn ? null : (self.lastEvaluatedBestParams ? { ...self.lastEvaluatedBestParams } : null)),
                    technicalMetrics: safeMetrics,
                    currentStepVisual: stepNumber,
                    bestStepNumber: bestStepNumber
                }
            });
        };

        self.optimizerStructuredLogger = sendStructuredLog;

        const simulateWithDynamicProgress = (params) => {
            if (!params.simulation)  params.simulation = {};

            params.simulation.calculateAccuracyError = true;
            params.simulation.maxHeatingPercent = dynamicHeatingPercent;

            const result = simulate2DHeating(params);
            totalSimulationsExecuted++;

            if (result && result.heatingTimeSeconds && result.coolingTimeSeconds && result.status?.type !== "abort" && result.status?.type !== "error") {
                const currentError = result.technicalMetrics?.accuracy?.totalErrorScore;
                if (Number.isFinite(currentError) && currentError < bestErrorScore) {
                    bestErrorScore = currentError;
                    const tTotal = result.heatingTimeSeconds + result.coolingTimeSeconds;
                    if (tTotal > 0) {
                        dynamicHeatingPercent = Math.max(10, Math.min(95, Math.round((result.heatingTimeSeconds / tTotal) * 100)));
                    }
                }
            }
            return result;
        };

        const progressHandler = (percent, currentExecutionCount, totalIterations, currentLoad, abortReason = null, technicalMetrics = null) => {
            if (abortReason) {
                sendStructuredLog('warning', abortReason, null, technicalMetrics);
                return;
            }
            self.postMessage({
                status: 'progress_tick',
                percent: percent,
                currentExecutionCount: currentExecutionCount,
                totalIterations: totalIterations,
                currentLoad: currentLoad || 0
            });
        };

        try {
            // Воркер больше ничего не собирает сам, а просто запускает PSO с конфигурацией из UI
            const result = optimizeForMaxSpeed(baseParams, simulateWithDynamicProgress, {
                ...options,
                onProgress: progressHandler
            });

            self.postMessage({ status: 'success', data: result });
        } catch (error) {
            self.postMessage({ status: 'error', error: error?.message || String(error) });
        }

    };
} catch (importError) {
    self.onmessage = function () {
        self.postMessage({ status: 'error', error: 'Worker crash: ' + (importError?.message || String(importError)) });
    };
}
