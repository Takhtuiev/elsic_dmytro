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
            // Эталонные пресеты из LIMITS тепловой модели для калибровки и быстрого старта роя
            const modelPresets = {
                fast: { gridX: 0.35, gridY: 1.30, minGrid: 0.06, maxIter: 4, tolerance: 0.25, maxDt: 2.5, targetDt: 2.0, growthFactor: 1.30, shrinkFactor: 0.50 },
                optimal: { gridX: 0.16, gridY: 0.78, minGrid: 0.05, maxIter: 6, tolerance: 0.29, maxDt: 3.87, targetDt: 2.13, growthFactor: 1.35, shrinkFactor: 0.52 },
                accurate: { gridX: 0.116, gridY: 0.307, minGrid: 0.044, maxIter: 14, tolerance: 0.038, maxDt: 0.71, targetDt: 0.77, growthFactor: 1.39, shrinkFactor: 0.49 }
            };

            const result = optimizeForMaxSpeed(baseParams, simulateWithDynamicProgress, {
                ...options,
                modelPresets: modelPresets,
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
