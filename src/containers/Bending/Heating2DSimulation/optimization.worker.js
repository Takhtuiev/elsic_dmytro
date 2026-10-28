/* eslint-disable no-restricted-globals */

try {
    const { optimizeForMaxSpeed } = require('./optimizer.js');
    const { simulate2DHeating } = require('./heating2DModel.js');

    self.onmessage = function (e) {
        const { baseParams, options } = e.data;

        // Инициализируем счетчики итераций и параметры состояния перед циклом оптимизации
        let totalSimulationsExecuted = 0;
        let dynamicHeatingPercent = 90; // Стартовое значение по умолчанию жестко установлено на 90%
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
                    // Если в строке есть значки шагов, прикрепляем кэшированный объект параметров
                    candidateParams: (message.includes('🧠') || message.includes('🎲')) ? currentStepParams : null
                });
            }

            originalLog.apply(console, args);
        };

        // Кастомная обертка вокруг симулятора для динамической синхронизации профиля солвера
        const simulateWithDynamicProgress = (params) => {
            // ГАРАНТИРУЕМ НАЛИЧИЕ ОБЪЕКТА SIMULATION И ПРИНУДИТЕЛЬНО ВКЛЮЧАЕМ РАСЧЕТ ОШИБКИ
            if (!params.simulation) {
                params.simulation = {};
            }
            params.simulation.calculateAccuracyError = true;
            params.simulation.maxHeatingPercent = dynamicHeatingPercent;

            // Перехватываем сгенерированные оптимизатором физические параметры
            if (params.simulation.accuracyMode) {
                currentStepParams = { ...params.simulation.accuracyMode };
            }

            // Запускаем базовый математический 2D-солвер переходных конечных разностей
            const result = simulate2DHeating(params);

            // Увеличиваем счетчик строго по факту завершения вычислительного кадра физики
            totalSimulationsExecuted++;

            if (result && result.heatingTimeSeconds && result.coolingTimeSeconds) {
                // Вытаскиваем текущий показатель точности напрямую из полей объекта результатов
                const currentError = result.technicalMetrics?.accuracy?.totalErrorScore;

                const isFirstStep = totalSimulationsExecuted === 1;
                const isAccuracyImproved = Number.isFinite(currentError) && currentError < bestErrorScore;

                // Если это первый шаг или точность стала лучше
                if (isFirstStep || isAccuracyImproved) {

                    // Обновляем лучшую точность в любом случае
                    if (Number.isFinite(currentError)) {
                        bestErrorScore = currentError;
                    }

                    const tHeating = result.heatingTimeSeconds;
                    const tCooling = result.coolingTimeSeconds;
                    const tTotal = tHeating + tCooling;

                    if (tTotal > 0) {
                        const realPercent = Math.round((tHeating / tTotal) * 100);
                        const clampedPercent = Math.max(10, Math.min(95, realPercent));

                        // 🟢 ДОБАВЛЕНО УСЛОВИЕ: Обновляем и логируем ТОЛЬКО если новый процент отличается от текущего
                        if (clampedPercent !== dynamicHeatingPercent) {
                            dynamicHeatingPercent = clampedPercent;

                            // Отправляем технический лог в поток терминала пользовательского интерфейса
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

        const progressHandler = (percent, currentExecutionCount, totalIterations) => {
            self.postMessage({
                status: 'progress_tick',
                percent,
                currentExecutionCount,
                totalIterations
            });
        };

        try {
            const extendedOptions = {
                ...options,
                onProgress: progressHandler
            };

            // Запускаем алгоритм оптимизации, используя динамическую самокорректирующуюся обертку
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
