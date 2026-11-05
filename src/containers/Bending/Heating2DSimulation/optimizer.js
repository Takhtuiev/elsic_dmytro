/* eslint-disable no-restricted-globals */

function composeSmartScore(load, timeErr, gridItemErr, solvErr, maxAllowedErrorScore, maxAllowedLoad, objective) {
    const safeTime = Math.max(0.0, timeErr);
    const safeGrid = Math.max(0.0, gridItemErr);
    const safeSolv = Math.max(0.0, solvErr);

    const totalPredictedError = Math.sqrt(
        safeTime ** 2 + safeGrid ** 2 + safeSolv ** 2
    );

    if (objective === 'minimize_load') {
        // 1. Общая точность не достигнута
        if (totalPredictedError > maxAllowedErrorScore) {
            const errorViolation =
                (totalPredictedError - maxAllowedErrorScore) / maxAllowedErrorScore;

            const penalty = maxAllowedLoad * (
                1.5 + Math.min(2.0, errorViolation)
            );

            console.warn(
                `⚠️ [SCORE-CALC]: Accuracy NOT reached ` +
                `(Error: ${totalPredictedError.toFixed(4)} > Max: ${maxAllowedErrorScore}). ` +
                `Penalty Score: ${penalty.toFixed(0)}`
            );

            return penalty;
        }

        // 2. Вычислительная нагрузка превышена
        if (load > maxAllowedLoad) {
            const violationFraction = (load - maxAllowedLoad) / maxAllowedLoad;

            const penalty = maxAllowedLoad * (
                1.5 + Math.min(2.0, violationFraction)
            );

            console.warn(
                `⚠️ [SCORE-CALC]: Load limit exceeded ` +
                `(${load} > ${maxAllowedLoad}). Penalty Score: ${penalty.toFixed(0)}`
            );

            return penalty;
        }

        // 3. Точность достигнута — минимизируем нагрузку
        const safetyMargin = totalPredictedError / maxAllowedErrorScore;
        const finalScore = load + safetyMargin * 0.1 * load;

        console.log(
            `✅ [SCORE-CALC]: Accuracy reached ` +
            `(Error: ${totalPredictedError.toFixed(4)} <= ${maxAllowedErrorScore}). ` +
            `Pure Load: ${load}, Stabilized Score: ${finalScore.toFixed(0)}`
        );

        return finalScore;
    }

    // Минимизация общей ошибки
    let cost = totalPredictedError;

    if (load > maxAllowedLoad) {
        const violationFraction = (load - maxAllowedLoad) / maxAllowedLoad;
        const penalty = Math.min(10.0, violationFraction * 2.0);

        cost += penalty;

        console.warn(
            `⚠️ [SCORE-CALC]: Load limit exceeded. Cost with penalty: ${cost.toFixed(4)}`
        );
    } else {
        console.log(
            `✅ [SCORE-CALC]: Load within limits. Cost (Error): ${cost.toFixed(4)}`
        );
    }

    return cost;
}

function rbfKernel(x1, x2, lengthScale = 0.25) {
    let sum = 0;
    const len = x1.length;
    for (let i = 0; i < len; i++) {
        sum += (x1[i] - x2[i]) ** 2;
    }
    return Math.exp(-sum / (2 * (lengthScale ** 2)));
}

function robustSolve(A, b) {
    const n = b.length;
    const M = new Array(n);
    for (let i = 0; i < n; i++) M[i] = new Float64Array(A[i]);
    const x = new Float64Array(b);

    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
        }
        if (maxRow !== i) {
            const tempM = M[i]; M[i] = M[maxRow]; M[maxRow] = tempM;
            const tempV = x[i]; x[i] = x[maxRow]; x[maxRow] = tempV;
        }

        if (Math.abs(M[i][i]) < 1e-14) {
            console.error(`🚨 [ROBUST-SOLVE]: Matrix is singular or close to singular at index ${i} (pivot: ${M[i][i]}). Solving failed.`);
            return null;
        }

        for (let k = i + 1; k < n; k++) {
            const c = -M[k][i] / M[i][i];
            for (let j = i; j < n; j++) M[k][j] += c * M[i][j];
            x[k] += c * x[i];
        }
    }

    const res = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += M[i][j] * res[j];
        res[i] = (x[i] - sum) / M[i][i];
    }
    return res;
}

function normalCDF(x) {
    const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
    const d = 0.39894228 * Math.exp(-x * x / 2.0);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1.0 - p : p;
}

function normalPDF(x) {
    return 0.39894228 * Math.exp(-x * x / 2.0);
}

export function optimizeForMaxSpeed(baseParams, simulateFn, options = {}) {
    let currentExecutionCount = 0;

    const objective = options.optimizationObjective || 'minimize_load';
    const maxAllowedErrorScore = options.maxErrorScore ?? 1.0;
    const maxAllowedLoad = options.maxAllowedLoad ?? 250000;
    const earlyAbortLoadMultiplier = options.earlyAbortLoadMultiplier ?? 1.2;

    const totalIterations = options.totalBudgetIterations || 40;
    const initPointsCount = options.randomInitPoints || 12;
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

    const observedX = [];
    const observedY = [];
    const processedY = [];
    const observedNoise = [];

    let gBestMetrics = null;
    let gBestPhysical = null;

    let fallbackScore = Infinity;
    let fallbackMetrics = null;
    let fallbackPhysical = null;

    const evaluate = (paramsObj, normX, customTag = null) => {
        currentExecutionCount++;
        let recordedAbortProgress = null;
        self.currentRunningStepNumber = currentExecutionCount;
        self.currentStepPhysicalParams = paramsObj;
        self.currentStepCustomTag = customTag;

        console.log(`\n🚀 [EVALUATE] Step #${currentExecutionCount} | Tag: ${customTag || 'BAYES/RANDOM'}`);
        console.log(`Params: ${JSON.stringify(paramsObj)}`);

        const simArgs = {
            ...baseParams,
            onProgress: (percent, currentLoad) => {
                const progressFraction = Math.max(1, percent) / 100;
                const absoluteCeiling = maxAllowedLoad * earlyAbortLoadMultiplier;
                const predictedFinalLoad = currentLoad / progressFraction;

                if (percent < 10 && currentLoad > maxAllowedLoad * 3.0) {
                    recordedAbortProgress = { percent, currentLoad, predicted: predictedFinalLoad };
                    console.warn(`🛑 [EARLY-ABORT]: Massive initial load detected (${currentLoad} at ${percent}%). Aborting.`);
                    return true;
                }
                if (predictedFinalLoad > absoluteCeiling) {
                    recordedAbortProgress = { percent, currentLoad, predicted: predictedFinalLoad };
                    console.warn(`🛑 [EARLY-ABORT]: Predicted load ${predictedFinalLoad.toFixed(0)} exceeds ceiling ${absoluteCeiling}. Aborting.`);
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

        try {
            const res = simulateFn(simArgs);

            if (!res || !res.technicalMetrics) {
                console.error("🚨 [EVAL-CRASH]: Simulation returned invalid result.");

                observedX.push(new Float64Array(normX));
                observedY.push(1e14);
                processedY.push(Math.log1p(maxAllowedLoad * 5.0));
                observedNoise.push(1.0);

                return 1e14;
            }

            const statusType = res.status?.type;
            const metrics = res.technicalMetrics;
            const acc = metrics?.accuracy;
            const rawLoad = metrics?.iterations?.totalGridPointsProcessed;

            const timeErr = acc?.timeIntegrationErrorC;
            const gridItemErr = acc?.spatialGridErrorC;
            const solvErr = Number.isFinite(acc?.solverErrorC) ? Math.abs(acc.solverErrorC) : NaN;
            const errorScore = acc?.totalErrorScore;

            const isAborted = statusType === "abort";
            const isError = statusType === "error"
                || !Number.isFinite(rawLoad)
                || !Number.isFinite(errorScore)
                || !Number.isFinite(timeErr)
                || !Number.isFinite(gridItemErr)
                || !Number.isFinite(solvErr);

            const load = Number.isFinite(rawLoad)
                ? rawLoad
                : maxAllowedLoad * earlyAbortLoadMultiplier;

            const safeErrorScore = isError ? 1e10 : errorScore;
            const safeTimeErr = Number.isFinite(timeErr) ? timeErr : 0;
            const safeGridErr = Number.isFinite(gridItemErr) ? gridItemErr : 0;
            const safeSolvErr = Number.isFinite(solvErr) ? solvErr : 1e10;

            if (recordedAbortProgress) {
                console.log(
                    `ℹ️ [SIM-RESULT]: Early Abort -> ${recordedAbortProgress.percent}%, ` +
                    `Current Load: ${recordedAbortProgress.currentLoad}, ` +
                    `Predicted Load: ${recordedAbortProgress.predicted.toFixed(0)}`
                );
            }

            console.log(
                `📊 [SIM-RESULT]: Status = ${statusType}, Load = ${load}, ` +
                `TotalError = ${safeErrorScore.toFixed(4)} ` +
                `(Time: ${safeTimeErr.toFixed(4)}, Grid: ${safeGridErr.toFixed(4)}, Solver: ${safeSolvErr.toFixed(5)})`
            );

            const rawScore = isError
                ? maxAllowedLoad * 5
                : composeSmartScore(
                    load,
                    safeTimeErr,
                    safeGridErr,
                    safeSolvErr,
                    maxAllowedErrorScore,
                    maxAllowedLoad,
                    objective
                );

// Abort — это не точное значение целевой функции, а консервативная оценка.
// Она не позволяет частичному расчёту выглядеть лучше завершённого.
            let score = rawScore;

            if (isAborted && !isError) {
                if (objective === "minimize_load") {
                    const abortPenaltyFloor = maxAllowedLoad * (earlyAbortLoadMultiplier + 0.5);
                    score = Math.max(rawScore, abortPenaltyFloor);
                } else {
                    const abortPenaltyFloor = maxAllowedErrorScore * 2;
                    score = Math.max(rawScore, abortPenaltyFloor);
                }

                console.warn(
                    `⚠️ [ABORT-OBSERVATION]: Partial result retained for GP. ` +
                    `Raw Score: ${rawScore.toFixed(2)}, Training Score: ${score.toFixed(2)}`
                );
            }

            observedX.push(new Float64Array(normX));
            observedY.push(score);

// Оставляем существующее ограничение диапазона обучающих значений.
            const cappedScore = Math.min(score, maxAllowedLoad * 5.0);
            processedY.push(Math.log1p(Math.max(0, cappedScore)));

            observedNoise.push(
                isError ? 1.0 :
                    isAborted ? 0.25 :
                        0.0001
            );

            if (!isAborted && !isError) {
                const currentIsFeasible =
                    load <= maxAllowedLoad &&
                    safeErrorScore <= maxAllowedErrorScore;

                if (currentIsFeasible) {
                    const bestLoad = gBestMetrics?.iterations?.totalGridPointsProcessed;
                    const bestError = gBestMetrics?.accuracy?.totalErrorScore;

                    const isCurrentBetter =
                        !gBestMetrics ||
                        (objective === "minimize_load"
                            ? load < bestLoad
                            : safeErrorScore < bestError);

                    if (isCurrentBetter) {
                        console.log(
                            `🏆 [NEW FEASIBLE BEST]: Step #${currentExecutionCount}. ` +
                            `Load: ${load}, Error: ${safeErrorScore.toFixed(4)}`
                        );

                        gBestMetrics = metrics;
                        gBestPhysical = paramsObj;

                        self.lastEvaluatedBestParams = paramsObj;
                        self.lastEvaluatedBestMetrics = metrics;
                        self.lastEvaluatedBestStepNumber = currentExecutionCount;
                    }
                } else if (!gBestMetrics && score < fallbackScore) {
                    fallbackScore = score;
                    fallbackMetrics = metrics;
                    fallbackPhysical = paramsObj;

                    console.log(
                        `ℹ️ [BEST FALLBACK]: Step #${currentExecutionCount}. ` +
                        `Load: ${load}, Error: ${safeErrorScore.toFixed(4)}`
                    );
                }
            } else {
                console.log(
                    `⏭️ [BEST-SKIP]: Step #${currentExecutionCount} excluded from Global Best. Status: ${isAborted ? "ABORTED" : "ERROR"}`
                );
            }

            if (typeof self.optimizerStructuredLogger === 'function') {
                self.optimizerStructuredLogger(customTag ? 'init' : (currentExecutionCount <= initPointsCount ? 'step_rand' : 'step_bayes'), `Step #${currentExecutionCount} completed`, paramsObj, res.technicalMetrics, self.lastEvaluatedBestStepNumber);
            }

            return score;
        } catch (e) {
            console.error(`🚨 [EVAL-CRASH]: Exception during evaluation on step #${currentExecutionCount}:`, e);
            observedX.push(new Float64Array(normX));
            observedY.push(1e14);
            processedY.push(Math.log1p(maxAllowedLoad * 5.0));
            observedNoise.push(1.0);
            return 1e14;
        }
    };

    console.log("🟢 [BAYES-OPTIMIZER]: Running Initial Sampling Phase...");

    if (options.modelPresets) {
        const modesToLoad = options.accuracyModes || Object.keys(options.modelPresets);
        modesToLoad.forEach(presetKey => {
            if (options.modelPresets[presetKey]) {
                const vec = normalizeParamObject(options.modelPresets[presetKey]);
                if (vec) evaluate(toPhysical(vec), vec, `PRESET_${presetKey.toUpperCase()}`);
            }
        });
    }

    while (currentExecutionCount < initPointsCount) {
        const randX = new Float64Array(numParams).map(() => Math.random());
        const physical = toPhysical(randX);
        if (physical.minGrid < physical.gridX) {
            evaluate(physical, randX, `RANDOM_INIT_${currentExecutionCount}`);
        }
    }

    console.log("\n🧠 [BAYES-OPTIMIZER]: Starting Analytical Gaussian Process Loop...");

    while (currentExecutionCount < totalIterations) {
        const N = observedX.length;

// Стандартизация целевой функции: среднее 0, стандартное отклонение 1.
        let yMean = 0;
        for (let i = 0; i < N; i++) yMean += processedY[i];
        yMean /= N;

        let yVariance = 0;
        for (let i = 0; i < N; i++) {
            const diff = processedY[i] - yMean;
            yVariance += diff * diff;
        }

        const yStd = Math.sqrt(yVariance / N);
        const safeYStd = yStd > 1e-12 ? yStd : 1.0;

        const normalizedY = new Float64Array(N);

        for (let i = 0; i < N; i++) {
            normalizedY[i] = (processedY[i] - yMean) / safeYStd;
        }

        const K = Array.from({ length: N }, () => new Float64Array(N));
        const jitter = 1e-6;

        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                K[i][j] = rbfKernel(observedX[i], observedX[j]);

                if (i === j) {
                    K[i][j] += jitter + observedNoise[i];
                }
            }
        }

        const weights = robustSolve(K, normalizedY);

        if (!weights) {
            console.warn(`⚠️ [BAYES-LOOP]: GP Weight calculation failed. Activating random fallback point.`);
            const fallbackX = new Float64Array(numParams).map(() => Math.random());
            evaluate(toPhysical(fallbackX), fallbackX, "FALLBACK_SINGULAR_K");
            continue;
        }

        const invKVectors = [];
        let isVarianceValid = true;
        for (let i = 0; i < N; i++) {
            const unitB = new Float64Array(N);
            unitB[i] = 1.0;
            const invCol = robustSolve(K, unitB);
            if (!invCol) {
                isVarianceValid = false;
                console.warn(`⚠️ [BAYES-LOOP]: Variance matrix inversion failed at step ${i}. Fallback to simplified variance.`);
                break;
            }
            invKVectors.push(invCol);
        }

        let bestEI = -1;
        let nextBestX = null;
        let bestCandidateStats = null;

        const currentBestY = Math.min(...normalizedY);

        const candidatesCount = 1200;
        const candidates = [];

        for (let c = 0; c < candidatesCount; c++) {
            const candX = new Float64Array(numParams).map(() => Math.random());
            const phys = toPhysical(candX);
            if (phys.minGrid < phys.gridX) {
                candidates.push(candX);
            }
        }

        const localExplorers = 200;
        const sortedIndices = [...Array(N).keys()].sort((a, b) => processedY[a] - processedY[b]);
        for (let m = 0; m < localExplorers; m++) {
            const baseIdx = sortedIndices[m % Math.min(N, 3)];
            const basePoint = observedX[baseIdx];
            const mutatedX = new Float64Array(numParams);
            for (let i = 0; i < numParams; i++) {
                const offset = (Math.random() - 0.5) * 0.1;
                mutatedX[i] = Math.max(0.0, Math.min(1.0, basePoint[i] + offset));
            }
            const phys = toPhysical(mutatedX);
            if (phys.minGrid < phys.gridX) candidates.push(mutatedX);
        }

        let zeroSigmaCount = 0;

        for (let c = 0; c < candidates.length; c++) {
            const candX = candidates[c];

            let predMean = 0;
            const kStar = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                kStar[i] = rbfKernel(candX, observedX[i]);
                predMean += kStar[i] * weights[i];
            }

            let variance = 1.0;
            if (isVarianceValid) {
                let kInvKk = 0;
                for (let i = 0; i < N; i++) {
                    for (let j = 0; j < N; j++) {
                        kInvKk += kStar[i] * invKVectors[i][j] * kStar[j];
                    }
                }
                variance = Math.max(1e-6, 1.0 - kInvKk);
            } else {
                for (let i = 0; i < N; i++) variance -= kStar[i] ** 2;
                variance = Math.max(1e-6, variance);
            }
            const sigma = Math.sqrt(variance);
            if (sigma <= 1e-4) zeroSigmaCount++;

            const delta = currentBestY - predMean;
            let ei = 0;

            if (sigma > 1e-4) {
                const z = delta / sigma;
                ei = delta * normalCDF(z) + sigma * normalPDF(z);
            } else {
                ei = Math.max(0, delta);
            }

            if (ei > bestEI) {
                bestEI = ei;
                nextBestX = candX;
                bestCandidateStats = { predMean, sigma, delta, ei };
            }
        }

        console.log(
            `🧠 [BAYES-DECISION]: Evaluated ${candidates.length} candidates. ` +
            `Best Y: ${Math.min(...processedY).toFixed(0)}, ` +
            `Normalized Best Y: ${currentBestY.toFixed(4)}, ` +
            `Y Mean: ${yMean.toFixed(2)}, Y Std: ${safeYStd.toFixed(2)}`
        );

        if (bestCandidateStats) {
            const predictedLogScore =
                bestCandidateStats.predMean * safeYStd + yMean;

            const predictedOriginal = Math.expm1(predictedLogScore);
            const sigmaLog = bestCandidateStats.sigma * safeYStd;

            console.log(
                `   -> Predicted Score: ${predictedOriginal.toFixed(0)}, ` +
                `Sigma (log-space): ${sigmaLog.toFixed(4)}, ` +
                `Normalized Sigma: ${bestCandidateStats.sigma.toFixed(4)}`
            );

        }

        if (zeroSigmaCount > 0) {
            console.log(`   -> ⚠️ ${zeroSigmaCount} candidates had near-zero uncertainty (sigma <= 1e-4).`);
        }

        if (!nextBestX || bestEI <= 0) {
            console.warn(`⚠️ [BAYES-DECISION]: Max EI is ${bestEI.toFixed(4)} (<= 0). Generating random candidate.`);
            nextBestX = new Float64Array(numParams).map(() => Math.random());
            const phys = toPhysical(nextBestX);
            if (phys.minGrid >= phys.gridX) {
                continue;
            }
        }

        evaluate(toPhysical(nextBestX), nextBestX);
    }

    console.log(`\n🏁 [OPTIMIZER-FINISHED]: Run complete. Total steps made: ${currentExecutionCount}`);
    console.log(`   -> Resulting Best Physical Params: ${JSON.stringify(gBestPhysical)}`);

    const finalPhysical =
        gBestPhysical ||
        fallbackPhysical ||
        toPhysical(observedX[observedY.indexOf(Math.min(...observedY))]);

    const finalMetrics = gBestMetrics || fallbackMetrics;

    return {
        optimalLimits: finalPhysical,
        metrics: {
            achievedLoad: finalMetrics?.iterations?.totalGridPointsProcessed || maxAllowedLoad,
            resultingErrorScore: finalMetrics?.accuracy?.totalErrorScore || 1e10,
            searchStepsMade: currentExecutionCount,
            isFallbackActivated: !gBestMetrics,
            appliedObjective: objective
        }
    };
}
