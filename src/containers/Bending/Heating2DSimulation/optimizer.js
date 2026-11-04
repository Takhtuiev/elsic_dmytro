/* eslint-disable no-restricted-globals */

// Ограничение бюджета
//const MAX_BUDGET = 600;

/**
 * Оценочная функция с мягким квадратичным штрафом.
 */
function composeSmartScore(load, timeErr, gridErr, solvErr, maxAllowedErrorScore, maxAllowedLoad, objective) {
    const safeTime = Math.max(0.0, timeErr);
    const safeGrid = Math.max(0.0, gridErr);
    const safeSolv = Math.max(0.0, solvErr);

    const totalPredictedError = Math.sqrt(safeTime**2 + safeGrid**2 + safeSolv**2);

    if (objective === 'minimize_load') {
        let cost = load;

        if (totalPredictedError > maxAllowedErrorScore) {
            const violationFraction = (totalPredictedError - maxAllowedErrorScore) / maxAllowedErrorScore;

            const timeWeight = safeTime > 0.08 ? 1.5 : 1.0;
            const gridWeight = safeGrid > 0.08 ? 1.8 : 1.0;
            const solvWeight = safeSolv > 0.02 ? 2.0 : 1.0;
            const combinedWeight = timeWeight * gridWeight * solvWeight;

            cost += 10000000 * (violationFraction + Math.pow(violationFraction, 2)) * combinedWeight;
        }
        return cost;
    } else {
        let cost = totalPredictedError;
        if (load > maxAllowedLoad) {
            const violationFraction = (load - maxAllowedLoad) / maxAllowedLoad;
            cost += (violationFraction * 2.0) + (violationFraction * violationFraction * 10.0);
        }
        return cost;
    }
}

/**
 * Оптимизатор методом роя частиц (PSO - Particle Swarm Optimization),
 * спроектированный для нелинейных разрывных сеток тепловой симуляции.
 */
export function optimizeForMaxSpeed(baseParams, simulateFn, options = {}) {
    let currentExecutionCount = 0;

    const objective = options.optimizationObjective || 'minimize_load';
    const maxAllowedErrorScore = options.maxErrorScore ?? 1.0;
    const maxAllowedLoad = options.maxAllowedLoad ?? 250000;
    const earlyAbortLoadMultiplier = options.earlyAbortLoadMultiplier ?? 1.2;

    const totalIterations = options.totalBudgetIterations || 25;
    const initPointsCount = options.randomInitPoints || 16;
    const config = options.config;

    if (!config) throw new Error("Конфигурация параметров не передана!");

    const paramKeys = Object.keys(config);
    const numParams = paramKeys.length;

    self.lastEvaluatedBestParams = null;
    self.lastEvaluatedBestMetrics = null;
    self.lastEvaluatedBestStepNumber = null;

    const toPhysical = (xNorm) => {
        const res = {};
        paramKeys.forEach((k, idx) => {
            let val = config[k].min + xNorm[idx] * (config[k].max - config[k].min);
            if (k === 'maxIter') val = Math.round(val);
            res[k] = val;
        });
        return res;
    };

    // Сбор пула априорных технологических точек (Seeds)
    const seedPool = [];

    const normalizeParamObject = (pObj) => {
        if (!pObj || typeof pObj !== 'object') return null;
        const normX = new Float64Array(numParams);
        let isValid = true;

        paramKeys.forEach((k, idx) => {
            const val = pObj[k];
            if (val !== undefined && val !== null) {
                const range = config[k];
                const normVal = range.max !== range.min ? (val - range.min) / (range.max - range.min) : 0;
                normX[idx] = Math.max(0.0, Math.min(1.0, normVal));
            } else {
                isValid = false;
            }
        });

        if (isValid) {
            const physical = toPhysical(normX);
            if (physical.minGrid !== undefined && physical.gridX !== undefined && physical.minGrid >= physical.gridX) {
                isValid = false;
            }
        }
        return isValid ? normX : null;
    };

    // Накатываем эталонные системные пресеты в пул
    if (options.modelPresets) {
        ['fast', 'optimal', 'accurate'].forEach(presetKey => {
            const presetVec = normalizeParamObject(options.modelPresets[presetKey]);
            if (presetVec) {
                seedPool.push({ vector: presetVec, tag: `PRESET_${presetKey.toUpperCase()}` });
            }
        });
    }

    // Параметры роя частиц (PSO)
    const swarmSize = Math.max(6, Math.min(initPointsCount, 20));
    const particles = [];

    let gBestX = new Float64Array(numParams);
    let gBestScore = Infinity;
    let gBestMetrics = null;
    let gBestPhysical = null;

    const evaluate = (paramsObj, normX, customTag = null) => {
        currentExecutionCount++;
        let recordedAbortProgress = null;
        self.currentRunningStepNumber = currentExecutionCount;
        self.currentStepPhysicalParams = paramsObj;
        self.currentStepCustomTag = customTag;

        const simArgs = {
            ...baseParams,
            onProgress: (percent, currentLoad) => {
                const progressFraction = Math.max(1, percent) / 100;

                if (percent < 10 && currentLoad > maxAllowedLoad) {
                    recordedAbortProgress = {
                        percent,
                        currentLoad,
                        isStart: true,
                        predicted: currentLoad / progressFraction
                    };
                    return true;
                }

                const absoluteCeiling = maxAllowedLoad * earlyAbortLoadMultiplier;
                const predictedFinalLoad = currentLoad / progressFraction;

                if (predictedFinalLoad > absoluteCeiling) {
                    recordedAbortProgress = { percent, currentLoad, isStart: false, predicted: predictedFinalLoad };
                    return true;
                }

                if (options.onProgress) {
                    options.onProgress(percent, currentExecutionCount, totalIterations, currentLoad);
                }
                return false;
            },
            simulation: {
                ...baseParams.simulation,
                accuracyMode: paramsObj,
                calculateAccuracyError: true,
                stopAtMaxTemperature: false
            }
        };

        const isInitPhase = currentExecutionCount <= initPointsCount;
        const phaseTag = isInitPhase ? "INIT" : "STEP";
        const emoji = isInitPhase ? "🎲" : "🧠";

        try {
            const res = simulateFn(simArgs);

            if (!res || !res.technicalMetrics) {
                const finalScore = 1e12;
                return { score: finalScore, load: maxAllowedLoad * earlyAbortLoadMultiplier, errorScore: 1e10, timeErr: 10.0, gridItemErr: 10.0, solvErr: 10.0, metrics: null, isAborted: true };
            }

            const statusType = res.status?.type;
            const statusMessage = res.status?.message || "";
            const isError = statusType === "error" || /minimum limit/i.test(statusMessage);
            const isAborted = statusType === "abort";

            let load = res.technicalMetrics.iterations?.totalGridPointsProcessed;
            let errorScore = res.technicalMetrics.accuracy?.totalErrorScore;

            if (isError || !Number.isFinite(load) || !Number.isFinite(errorScore)) {
                return { score: 1e12, load: maxAllowedLoad * earlyAbortLoadMultiplier, errorScore: 1e10, timeErr: 10.0, gridItemErr: 10.0, solvErr: 10.0, metrics: res.technicalMetrics, isAborted: true };
            }

            if (isAborted && recordedAbortProgress) {
                const absoluteCeiling = maxAllowedLoad * earlyAbortLoadMultiplier;
                const penaltyErrorScore = errorScore * Math.max(1.5, load / absoluteCeiling);

                const currentAccuracy = res?.technicalMetrics?.accuracy;
                const currentIters = res?.technicalMetrics?.iterations;

                const abortMetrics = {
                    calculationTimeMs: res?.technicalMetrics?.calculationTimeMs,
                    accuracy: {
                        totalErrorScore: penaltyErrorScore,
                        timeIntegrationErrorC: currentAccuracy?.timeIntegrationErrorC || errorScore,
                        spatialGridErrorC: currentAccuracy?.spatialGridErrorC || 1.0,
                        solverErrorC: currentAccuracy?.solverErrorC || 0.5
                    },
                    iterations: {
                        totalGridPointsProcessed: Math.round(recordedAbortProgress.predicted),
                        totalTimeSteps: currentIters?.totalTimeSteps || Math.round(recordedAbortProgress.percent),
                        totalPicardIterations: currentIters?.totalPicardIterations
                    }
                };

                const score = composeSmartScore(
                    abortMetrics.iterations.totalGridPointsProcessed,
                    abortMetrics.accuracy.timeIntegrationErrorC,
                    abortMetrics.accuracy.spatialGridErrorC,
                    abortMetrics.accuracy.solverErrorC,
                    maxAllowedErrorScore, maxAllowedLoad, objective
                );

                if (typeof self.optimizerStructuredLogger === 'function') {
                    const estLoad = Math.round(recordedAbortProgress.predicted);
                    const formattedEstLoad = new Intl.NumberFormat("fr-FR").format(estLoad).replace(/\s/g, " ");
                    const formattedError = penaltyErrorScore.toFixed(3);

                    self.optimizerStructuredLogger(
                        'warning',
                        `Step #${currentExecutionCount} | Error: ${formattedError} | Load: ${formattedEstLoad} nodes [ABORT]`,
                        paramsObj,
                        abortMetrics,
                        self.lastEvaluatedBestStepNumber
                    );
                }

                return {
                    score,
                    load: abortMetrics.iterations.totalGridPointsProcessed,
                    errorScore: penaltyErrorScore,
                    timeErr: abortMetrics.accuracy.timeIntegrationErrorC,
                    gridItemErr: abortMetrics.accuracy.spatialGridErrorC,
                    solvErr: abortMetrics.accuracy.solverErrorC,
                    metrics: abortMetrics,
                    isAborted: true
                };
            }

            const acc = res.technicalMetrics.accuracy;
            const timeErr = acc?.timeIntegrationErrorC || 0;
            const gridItemErr = acc?.spatialGridErrorC || 0;
            const solvErr = Math.abs(acc?.solverErrorC || 0);

            const score = composeSmartScore(load, timeErr, gridItemErr, solvErr, maxAllowedErrorScore, maxAllowedLoad, objective);

            console.log(`${emoji} [${phaseTag} ${currentExecutionCount}/${totalIterations}]: Error score: ${errorScore.toFixed(3)} | Load: ${Math.round(load)} nodes | Cost: ${score.toFixed(1)}`);

            // Обновление глобального лидера
            let isCurrentBetter = false;
            if (gBestScore === Infinity) {
                isCurrentBetter = true;
            } else {
                const gBestIsFeasible = gBestMetrics?.accuracy?.totalErrorScore <= maxAllowedErrorScore;
                const currentIsFeasible = errorScore <= maxAllowedErrorScore;

                if (objective === 'minimize_load') {
                    if (currentIsFeasible && !gBestIsFeasible) isCurrentBetter = true;
                    else if (currentIsFeasible && gBestIsFeasible) isCurrentBetter = load < gBestMetrics.iterations.totalGridPointsProcessed;
                    else if (!currentIsFeasible && !gBestIsFeasible) isCurrentBetter = errorScore < gBestMetrics.accuracy.totalErrorScore;
                } else {
                    const gBestLoadFeasible = gBestMetrics?.iterations?.totalGridPointsProcessed <= maxAllowedLoad;
                    const currentLoadFeasible = load <= maxAllowedLoad;

                    if (currentLoadFeasible && !gBestLoadFeasible) isCurrentBetter = true;
                    else if (currentLoadFeasible && gBestLoadFeasible) isCurrentBetter = errorScore < gBestMetrics.accuracy.totalErrorScore;
                    else if (!currentLoadFeasible && !gBestLoadFeasible) isCurrentBetter = load < gBestMetrics.iterations.totalGridPointsProcessed;
                }
            }

            if (isCurrentBetter) {
                gBestScore = score;
                gBestX.set(normX);
                gBestMetrics = res.technicalMetrics;
                gBestPhysical = paramsObj;

                self.lastEvaluatedBestParams = paramsObj;
                self.lastEvaluatedBestMetrics = res.technicalMetrics;
                self.lastEvaluatedBestStepNumber = currentExecutionCount;
            }

            if (typeof self.optimizerStructuredLogger === 'function') {
                // Если это пресет, добавляем его имя в текст лога
                const logText = customTag
                    ? `Step #${currentExecutionCount} [${customTag}] completed`
                    : `Step #${currentExecutionCount} completed`;

                self.optimizerStructuredLogger(
                    customTag ? 'init' : (isInitPhase ? 'step_rand' : 'step_bayes'),
                    logText,
                    paramsObj,
                    res.technicalMetrics,
                    self.lastEvaluatedBestStepNumber
                );
            } else if (options.onProgress) {
                options.onProgress(100, currentExecutionCount, totalIterations, load || 0, null, res.technicalMetrics);
            }

            self.currentStepPhysicalParams = null;
            return { score, load, errorScore, timeErr, gridItemErr, solvErr, metrics: res.technicalMetrics, isAborted: false };

        } catch (e) {
            if (typeof self.optimizerStructuredLogger === 'function') {
                self.optimizerStructuredLogger(
                    'error',
                    `Step #${currentExecutionCount} critical exception: ${e?.message || String(e)}`,
                    paramsObj,
                    null,
                    self.lastEvaluatedBestStepNumber
                );
            }
            return { score: 1e12, load: maxAllowedLoad * earlyAbortLoadMultiplier, errorScore: 1e10, timeErr: 10.0, gridItemErr: 10.0, solvErr: 10.0, metrics: null, isAborted: true };
        }
    };

    console.log(`🟢 [PSO-OPTIMIZER]: Swarm Intelligence Exploration Started [${objective.toUpperCase()}]`);

    // 1. Инициализация частиц роя
    for (let i = 0; i < swarmSize; i++) {
        let pX = new Float64Array(numParams);
        let pV = new Float64Array(numParams);
        let valid = false;
        let physical = null;
        let currentSeedTag = null;

        // Если в пуле есть пресеты — инициализируем частицу значениями пресета
        if (i < seedPool.length) {
            const seed = seedPool[i];
            pX.set(seed.vector);
            for (let p = 0; p < numParams; p++) {
                pV[p] = (Math.random() - 0.5) * 0.04; // Меньшая скорость для сидов (локальное уточнение)
            }
            physical = toPhysical(pX);
            valid = true;
            currentSeedTag = seed.tag;
        }

        let localAttempts = 0;
        while (!valid && localAttempts < 100) {
            localAttempts++;
            for (let p = 0; p < numParams; p++) {
                pX[p] = Math.random();
                pV[p] = (Math.random() - 0.5) * 0.1;
            }
            physical = toPhysical(pX);
            if (physical.minGrid === undefined || physical.gridX === undefined || physical.minGrid < physical.gridX) {
                valid = true;
            }
        }

        // Передаем третьим аргументом currentSeedTag для красивой разметки в логах
        const evalRes = evaluate(physical, pX, currentSeedTag);

        particles.push({
            x: pX,
            v: pV,
            bestX: new Float64Array(pX),
            bestScore: evalRes.score,
            bestError: evalRes.errorScore,
            bestLoad: evalRes.load,
            bestMetrics: evalRes.metrics
        });
    }
    // Добираем оставшийся начальный бюджет случайными точками, если необходимо
    let remainingInit = initPointsCount - swarmSize;
    for (let i = 0; i < remainingInit; i++) {
        const randX = Array.from({length: numParams}, () => Math.random());
        const physical = toPhysical(randX);
        if (physical.minGrid !== undefined && physical.gridX !== undefined && physical.minGrid >= physical.gridX) {
            i--;
            continue;
        }
        evaluate(physical, randX);
    }

    // 2. Основной итерационный цикл роя частиц
    let w = 0.729;  // Инерционный вес
    const c1 = 1.49445; // Когнитивный коэффициент (движение к собственному максимуму)
    const c2 = 1.49445; // Социальный коэффициент (движение к глобальному лидеру роя)

    while (currentExecutionCount < totalIterations) {
        const particleIdx = currentExecutionCount % swarmSize;
        const p = particles[particleIdx];

        // Корректировка скорости и позиции частицы
        for (let idx = 0; idx < numParams; idx++) {
            const r1 = Math.random();
            const r2 = Math.random();

            p.v[idx] = w * p.v[idx] + c1 * r1 * (p.bestX[idx] - p.x[idx]) + c2 * r2 * (gBestX[idx] - p.x[idx]);
            // Ограничение скорости
            if (p.v[idx] > 0.2) p.v[idx] = 0.2;
            if (p.v[idx] < -0.2) p.v[idx] = -0.2;

            p.x[idx] = Math.max(0.0, Math.min(1.0, p.x[idx] + p.v[idx]));
        }

        let physical = toPhysical(p.x);

        // Исправление геометрии сетки «на лету»
        if (physical.minGrid !== undefined && physical.gridX !== undefined && physical.minGrid >= physical.gridX) {
            const minGridIdx = paramKeys.indexOf('minGrid');
            const gridXIdx = paramKeys.indexOf('gridX');
            p.x[minGridIdx] = Math.max(0.0, p.x[gridXIdx] - 0.05);
            physical = toPhysical(p.x);
        }

        console.log(`🧠 [DECISION] Шаг №${currentExecutionCount + 1}: Режим = EXPLOITATION (PSO Swarm Flight)`);

        const evalRes = evaluate(physical, p.x);

        // Обновление персонального рекорда частицы с учетом многокритериальности
        let isPersonalBetter = false;
        const pBestIsFeasible = p.bestError <= maxAllowedErrorScore;
        const currentIsFeasible = evalRes.errorScore <= maxAllowedErrorScore;

        if (objective === 'minimize_load') {
            if (currentIsFeasible && !pBestIsFeasible) isPersonalBetter = true;
            else if (currentIsFeasible && pBestIsFeasible) isPersonalBetter = evalRes.load < p.bestLoad;
            else if (!currentIsFeasible && !pBestIsFeasible) isPersonalBetter = evalRes.score < p.bestScore;
        } else {
            const pBestLoadFeasible = p.bestLoad <= maxAllowedLoad;
            const currentLoadFeasible = evalRes.load <= maxAllowedLoad;

            if (currentLoadFeasible && !pBestLoadFeasible) isPersonalBetter = true;
            else if (currentLoadFeasible && pBestLoadFeasible) isPersonalBetter = evalRes.errorScore < p.bestError;
            else if (!currentLoadFeasible && !pBestLoadFeasible) isPersonalBetter = evalRes.score < p.bestScore;
        }

        if (isPersonalBetter) {
            p.bestScore = evalRes.score;
            p.bestError = evalRes.errorScore;
            p.bestLoad = evalRes.load;
            p.bestX.set(p.x);
            p.bestMetrics = evalRes.metrics;
        }

        // Адаптивное затухание инерции для тонкой локальной настройки в конце
        w = Math.max(0.4, w * 0.99);
    }

    const fallbackActivated = !gBestPhysical;

    return {
        optimalLimits: gBestPhysical || toPhysical(gBestX),
        metrics: {
            achievedLoad: gBestMetrics?.iterations?.totalGridPointsProcessed || (maxAllowedLoad * earlyAbortLoadMultiplier),
            resultingErrorScore: gBestMetrics?.accuracy?.totalErrorScore || 1e10,
            searchStepsMade: currentExecutionCount,
            isFallbackActivated: fallbackActivated,
            appliedObjective: objective
        }
    };
}
