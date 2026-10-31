/**
 * Универсальный Байесовский оптимизатор с внешним управлением целью.
 *
 * Поддерживает два режима (options.optimizationObjective):
 * 1. 'minimize_load'        — минимальная вычислительная нагрузка при totalErrorScore <= maxErrorScore.
 * 2. 'minimize_uncertainty' — минимальный totalErrorScore при нагрузке <= maxAllowedLoad.
 *
 * Важно: totalErrorScore — оценочный критерий, а не физическая погрешность в °C.
 */
export function optimizeForMaxSpeed(baseParams, simulateFn, options = {}) {
    let currentExecutionCount = 0;

    const objective = options.optimizationObjective || 'minimize_load';
    const maxAllowedErrorScore = options.maxErrorScore ?? 1.0;
    const maxAllowedLoad = options.maxAllowedLoad ?? 250000;

    const earlyAbortLoadMultiplier = options.earlyAbortLoadMultiplier ?? 1.2;

    const totalIterations = options.totalBudgetIterations || 25;
    const initPointsCount = options.randomInitPoints || 6;
    const config = options.config;

    if (!config) throw new Error("Конфигурация параметров не передана!");
    if (!['minimize_load', 'minimize_uncertainty'].includes(objective)) {
        throw new Error(`Неизвестная цель оптимизации: ${objective}`);
    }

    const paramKeys = Object.keys(config);
    const numParams = paramKeys.length;

    const X_sample = [];
    const Y_load = [];
    const Y_errorScore = [];

    const toPhysical = (xNorm) => {
        const res = {};
        paramKeys.forEach((k, idx) => {
            let val = config[k].min + xNorm[idx] * (config[k].max - config[k].min);
            if (k === 'maxIter') val = Math.round(val);
            res[k] = val;
        });
        return res;
    };

    // === ПОЛНАЯ ЗАМЕНА ФУНКЦИИ evaluate В ФАЙЛЕ optimizer.js ===
    const evaluate = (paramsObj) => {
        currentExecutionCount++;
        let recordedAbortProgress = null; // Запоминаем данные на момент аборта

        const simArgs = {
            ...baseParams,
            onProgress: (percent, currentLoad) => {
                const progressFraction = Math.max(1, percent) / 100;
                const absoluteCeiling = maxAllowedLoad * earlyAbortLoadMultiplier;

                // Расчет прогноза оставляем, но использовать на старте его будем осторожно
                const predictedFinalLoad = currentLoad / progressFraction;

                // 🛑 ВНЕШНИЙ КОНТРОЛЬ НАГРУЗКИ (Исправленный надежный двойной контроль):
                if (percent < 5) {
                    // Защита старта: до 5% проверяем ЖЕСТКИЙ ФАКТИЧЕСКИЙ ПОРОГ (абсолютного потолка).
                    // Это не даст симуляции вылететь из-за стартовых колебаний адаптивного шага времени dt.

                    if (currentLoad > absoluteCeiling) {
                        recordedAbortProgress = { percent, currentLoad, isStart: true, predicted: predictedFinalLoad };
                        return true;
                    }
                } else {
                    // Основная фаза: когда график стабилизировался, включаем точное интеллектуальное прогнозирование
                    if (predictedFinalLoad > absoluteCeiling) {
                        recordedAbortProgress = { percent, currentLoad, isStart: false, predicted: predictedFinalLoad };
                        return true;
                    }
                }

                if (options.onProgress) {
                    options.onProgress(percent, currentExecutionCount, totalIterations, currentLoad);
                }
                return false;
            },
            simulation: {
                ...baseParams.simulation,
                accuracyMode: paramsObj,
                calculateAccuracyError: true
            }
        };

        try {
            const res = simulateFn(simArgs);
            if (!res || !res.technicalMetrics) return null;

            const isAborted = res.status?.type === "abort";
            const load = res.technicalMetrics.iterations?.totalGridPointsProcessed;
            let errorScore = res.technicalMetrics.accuracy?.totalErrorScore;

            if (!Number.isFinite(load) || !Number.isFinite(errorScore)) return null;

            // Формируем чистую строку лога для UI с финальной прогнозируемой нагрузкой
            let abortReason = null;
            if (isAborted && recordedAbortProgress) {
                const errStr = errorScore.toFixed(3);
                const stepStr = `Step ${currentExecutionCount}/${totalIterations}`;
                const finalLoadRounded = Math.round(recordedAbortProgress.predicted);

                if (recordedAbortProgress.isStart) {
                    abortReason = `🛑 [EARLY_ABORT]: ${stepStr} | Error: ${errStr} | Final load (early): ${finalLoadRounded} nodes`;
                } else {
                    abortReason = `🛑 [EARLY_ABORT]: ${stepStr} | Error: ${errStr} | Final load: ${finalLoadRounded} nodes`;
                }
            }

            // Штрафуем внутреннюю модель оптимизатора по точности пропорционально перегрузке.
            // Это делает холм сложности плавным для Гауссовского ядра RBF, не ломая математику ландшафта.
            if (isAborted) {
                const absoluteCeiling = maxAllowedLoad * earlyAbortLoadMultiplier;
                const overloadRatio = load / absoluteCeiling;

                // Мягкий множитель: минимум 1.5х, либо строго пропорционально перегрузу сетки
                const penaltyMultiplier = Math.max(1.5, overloadRatio);
                errorScore = errorScore * penaltyMultiplier;
            }
            return { load, errorScore, isAborted, abortReason };
        } catch (e) {
            return null;
        }
    };


    const kernelRBF = (x1, x2) => {
        let sumSq = 0;
        for (let i = 0; i < numParams; i++) {
            sumSq += (x1[i] - x2[i]) * (x1[i] - x2[i]);
        }
        return Math.exp(-sumSq / 0.2);
    };

    const predictSurrogate = (xTest) => {
        if (X_sample.length === 0) return 0;

        let numerator = 0;
        let denominator = 0;

        if (objective === 'minimize_load') {
            const hasValidPoint = Y_errorScore.some(score => score <= maxAllowedErrorScore);

            for (let i = 0; i < X_sample.length; i++) {
                const k = kernelRBF(X_sample[i], xTest);
                let score = Y_load[i];

                if (hasValidPoint && Y_errorScore[i] > maxAllowedErrorScore) {
                    score += 1e8 + (Y_errorScore[i] - maxAllowedErrorScore) * 100000;
                } else if (!hasValidPoint) {
                    score = Y_errorScore[i] * 100000 + Y_load[i] * 0.01;
                }

                numerator += k * score;
                denominator += k;
            }
        } else {
            const hasValidLoad = Y_load.some(load => load <= maxAllowedLoad);

            for (let i = 0; i < X_sample.length; i++) {
                const k = kernelRBF(X_sample[i], xTest);
                let score = Y_errorScore[i];

                if (hasValidLoad && Y_load[i] > maxAllowedLoad) {
                    score += 1e6 + (Y_load[i] - maxAllowedLoad) * 0.01;
                }

                numerator += k * score;
                denominator += k;
            }
        }

        return denominator === 0 ? 1e8 : numerator / denominator;
    };

    console.log(`🟢 [BAYES]: Optimization started [${objective.toUpperCase()}]`);

    // --- ФАЗА 1: Стартовая инициализация точек ---
    let attempts = 0;

    while (X_sample.length < initPointsCount && attempts < 200) {
        attempts++;

        const randX = Array.from({ length: numParams }, () => Math.random());
        const physical = toPhysical(randX);

        const res = evaluate(physical);

        if (res) {
            X_sample.push(randX);
            Y_load.push(res.load);
            Y_errorScore.push(res.errorScore);

            console.log(
                `🎲 [INIT ${X_sample.length}/${initPointsCount}]: ` +
                `Error score: ${res.errorScore.toFixed(3)} | Load: ${res.load}`
            );
        }
    }

    if (X_sample.length === 0) {
        throw new Error(
            "Failed to initialize simulation search space. " +
            "Please check boundary conditions or validity of passed configuration parameters."
        );
    }

    // --- ФАЗА 2: Основной цикл оптимизации ---
    for (let step = X_sample.length; step < totalIterations; step++) {
        let bestCandidateX = null;
        let minPredictedCost = Infinity;

        for (let c = 0; c < 200; c++) {
            const candidateX = Array.from({ length: numParams }, () => Math.random());
            const predCost = predictSurrogate(candidateX);

            let minDistanceToSamples = Infinity;
            for (let i = 0; i < X_sample.length; i++) {
                let dist = 0;
                for (let p = 0; p < numParams; p++) {
                    dist += (X_sample[i][p] - candidateX[p]) ** 2;
                }
                if (dist < minDistanceToSamples) minDistanceToSamples = dist;
            }

            const totalScore = predCost - minDistanceToSamples * 20000;
            if (totalScore < minPredictedCost) {
                minPredictedCost = totalScore;
                bestCandidateX = candidateX;
            }
        }

        if (!bestCandidateX) continue;

        const optimalPhysical = toPhysical(bestCandidateX);
        const res = evaluate(optimalPhysical);

        if (res) {
            X_sample.push(bestCandidateX);
            Y_load.push(res.load);
            Y_errorScore.push(res.errorScore);

            // Если шаг завершился АБОРТОМ — отправляем в UI готовую строку лога через onProgress воркера
            if (res.isAborted && res.abortReason) {
                if (options.onProgress) {
                    // Передаем сформированную строку 5-м параметром (abortReason)
                    options.onProgress(0, currentExecutionCount, totalIterations, res.load, res.abortReason);
                }
            }
            // Если шаг успешный — пишем стандартный лог в воркер
            else {
                console.log(
                    `🧠 [STEP ${X_sample.length}/${totalIterations}]: ` +
                    `Error score: ${res.errorScore.toFixed(3)} | Load: ${Math.round(res.load)}`
                );
            }
        }
    }

    // --- ФАЗА 3: Выбор победителя ---
    let bestIdx = -1;
    let fallbackActivated = false;

    if (objective === 'minimize_load') {
        let minFinalLoad = Infinity;

        for (let i = 0; i < X_sample.length; i++) {
            if (
                Y_errorScore[i] <= maxAllowedErrorScore &&
                Y_load[i] < minFinalLoad
            ) {
                minFinalLoad = Y_load[i];
                bestIdx = i;
            }
        }

        if (bestIdx === -1) {
            fallbackActivated = true;
            let minScore = Infinity;

            for (let i = 0; i < X_sample.length; i++) {
                if (Y_errorScore[i] < minScore) {
                    minScore = Y_errorScore[i];
                    bestIdx = i;
                }
            }
        }
    } else {
        let minErrorScore = Infinity;

        for (let i = 0; i < X_sample.length; i++) {
            if (
                Y_load[i] <= maxAllowedLoad &&
                Y_errorScore[i] < minErrorScore
            ) {
                minErrorScore = Y_errorScore[i];
                bestIdx = i;
            }
        }

        if (bestIdx === -1) {
            fallbackActivated = true;
            let minScore = Infinity;

            for (let i = 0; i < X_sample.length; i++) {
                if (Y_errorScore[i] < minScore) {
                    minScore = Y_errorScore[i];
                    bestIdx = i;
                }
            }
        }
    }

    if (bestIdx === -1) {
        throw new Error("Оптимизатор не смог выбрать итоговую конфигурацию.");
    }

    const finalOptimalLimits = toPhysical(X_sample[bestIdx]);

    console.log("\n=======================================================");
    console.log(`🏆 [OPTIMIZER]: RESULTS [${objective.toUpperCase()}]`);
    console.log("=======================================================");

    if (fallbackActivated) {
        console.warn("⚠️ Constraints not met.");
        console.warn(
            objective === 'minimize_load'
                ? "🎯 Fallback: minimum error score config chosen."
                : "🎯 Fallback: minimum error score config chosen due to load limits."
        );
    } else {
        console.log("✅ Constraints satisfied.");
    }

    console.log(`📊 Final error score: ${Y_errorScore[bestIdx].toFixed(3)}`);
    console.log(`⚡ Computational load: ${Y_load[bestIdx]} nodes`);
    console.log("=======================================================\n");

    return {
        optimalLimits: finalOptimalLimits,
        metrics: {
            achievedLoad: Y_load[bestIdx],
            resultingErrorScore: Y_errorScore[bestIdx],
            searchStepsMade: X_sample.length,
            isFallbackActivated: fallbackActivated,
            appliedObjective: objective
        }
    };
}