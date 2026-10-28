
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

    const evaluate = (paramsObj) => {
        currentExecutionCount++;

        const simArgs = {
            ...baseParams,
            onProgress: (percent) => {
                if (options.onProgress) {
                    options.onProgress(percent, currentExecutionCount, totalIterations);
                }
            },
            simulation: {
                ...baseParams.simulation,
                accuracyMode: paramsObj,
                calculateAccuracyError: true
            }
        };

        try {
            const res = simulateFn(simArgs);

            // Результаты с диагностическими ошибками сохраняем, если метрики присутствуют.
            if (!res || !res.technicalMetrics) return null;

            const load = res.technicalMetrics.iterations?.totalGridPointsProcessed;
            const errorScore = res.technicalMetrics.accuracy?.totalErrorScore;

            if (!Number.isFinite(load) || !Number.isFinite(errorScore)) return null;

            return { load, errorScore };
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

    console.log(`🟢 [Байесовский подбор]: Запущена задача [${objective.toUpperCase()}]`);

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
                `🎲 [Старт ${X_sample.length}/${initPointsCount}]: ` +
                `Error score: ${res.errorScore.toFixed(3)} | Load: ${res.load}`
            );
        }
    }

    if (X_sample.length === 0) {
        throw new Error(
            "Не удалось инициализировать пространство симуляций. " +
            "Проверьте граничные условия или корректность переданных параметров."
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

            console.log(
                `🧠 [Шаг ${X_sample.length}/${totalIterations}]: ` +
                `Error score: ${res.errorScore.toFixed(3)} | Load: ${res.load}`
            );
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
    console.log(`🏆 [ОПТИМИЗАТОР]: РЕЗУЛЬТАТЫ [${objective.toUpperCase()}]`);
    console.log("=======================================================");

    if (fallbackActivated) {
        console.warn("⚠️ Основные ограничения не выполнены.");
        console.warn(
            objective === 'minimize_load'
                ? "🎯 Fallback: выбрана конфигурация с минимальным error score."
                : "🎯 Fallback: выбрана конфигурация с минимальным error score, поскольку лимит нагрузки не соблюдён."
        );
    } else {
        console.log("✅ Ограничения выполнены.");
    }

    console.log(`📊 Итоговый error score: ${Y_errorScore[bestIdx].toFixed(3)}`);
    console.log(`⚡ Вычислительная нагрузка: ${Y_load[bestIdx]} точек`);
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
