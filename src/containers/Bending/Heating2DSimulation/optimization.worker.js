/* eslint-disable no-restricted-globals */

/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed } = require('./optimizer.js');
    const { simulate2DHeating } = require('./heating2DModel.js');

    self.onmessage = function (e) {
        const { baseParams, options } = e.data;

        let totalSimulationsExecuted = 0;
        let dynamicHeatingPercent = 90;
        let bestErrorScore = Infinity;

        let currentStepParams = null;

        const originalLog = console.log;
        console.log = function (...args) {
            const message = args.join(' ');

            if (
                message.includes('🧠') ||
                message.includes('🎲') ||
                message.includes('🟢') ||
                message.includes('🏆') ||
                message.includes('✅') ||
                message.includes('⚠️') ||
                message.includes('📊') ||
                message.includes('⚡')
            ) {
                self.postMessage({
                    status: 'log_step',
                    logMessage: message,
                    candidateParams: (message.includes('🧠') || message.includes('🎲')) ? currentStepParams : null
                });
            }

            // 🛑 УБРАНО: Вызов оригинального лога удален, чтобы не засорять DevTools браузера
        };

        const simulateWithDynamicProgress = (params) => {
            if (!params.simulation) {
                params.simulation = {};
            }
            params.simulation.calculateAccuracyError = true;
            params.simulation.maxHeatingPercent = dynamicHeatingPercent;

            if (params.simulation.accuracyMode) {
                currentStepParams = { ...params.simulation.accuracyMode };
            }

            const result = simulate2DHeating(params);
            totalSimulationsExecuted++;

            if (result && result.heatingTimeSeconds && result.coolingTimeSeconds) {
                const currentError = result.technicalMetrics?.accuracy?.totalErrorScore;
                const isFirstStep = totalSimulationsExecuted === 1;
                const isAccuracyImproved = Number.isFinite(currentError) && currentError < bestErrorScore;

                if (isFirstStep || isAccuracyImproved) {
                    if (Number.isFinite(currentError)) {
                        bestErrorScore = currentError;
                    }

                    const tHeating = result.heatingTimeSeconds;
                    const tCooling = result.coolingTimeSeconds;
                    const tTotal = tHeating + tCooling;

                    if (tTotal > 0) {
                        const realPercent = Math.round((tHeating / tTotal) * 100);
                        const clampedPercent = Math.max(10, Math.min(95, realPercent));

                        if (clampedPercent !== dynamicHeatingPercent) {
                            dynamicHeatingPercent = clampedPercent;

                            self.postMessage({
                                status: 'log_step',
                                logMessage: `⚙️ [WORKER_CORE]: Progress bar distribution updated: Heating = ${dynamicHeatingPercent}%, Cooling = ${100 - dynamicHeatingPercent}%`
                            });
                        }
                    }
                }
            }

            return result;
        };

        const progressHandler = (percent, currentExecutionCount, totalIterations, currentLoad, abortReason = null) => {
            if (abortReason) {
                self.postMessage({
                    status: 'log_step',
                    logMessage: abortReason,
                    candidateParams: currentStepParams
                });
            }

            self.postMessage({
                status: 'progress_tick',
                percent,
                currentExecutionCount,
                totalIterations,
                currentLoad: currentLoad || 0
            });
        };

        try {
            const extendedOptions = {
                ...options,
                onProgress: progressHandler
            };

            const result = optimizeForMaxSpeed(
                baseParams,
                simulateWithDynamicProgress,
                extendedOptions
            );

            console.log = originalLog;

            self.postMessage({
                status: 'success',
                data: result
            });
        } catch (error) {
            console.log = originalLog;

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
