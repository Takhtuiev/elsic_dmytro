import { createDiagnosticLogger } from "./optimizerDiagnostics.js";

/* eslint-disable no-restricted-globals */

// ============================================================================
// 1. ЧИСЛЕННЫЕ И МАТЕМАТИЧЕСКИЕ ОСНОВЫ
// Расстояния, ядро Матерна, линейная алгебра и функции нормального распределения.
// ============================================================================

// Вспомогательная функция: Расстояние с учетом шкал длин ядра (Махаланобиса-подобное)
function calculateKernelDistance(x1, x2, lengthScales) {
    if (
        !x1 ||
        !x2 ||
        !lengthScales ||
        x1.length === 0 ||
        x1.length !== x2.length ||
        x1.length !== lengthScales.length
    ) {
        return Infinity;
    }

    let sumSq = 0;

    for (let d = 0; d < x1.length; d++) {
        const scale = Number.isFinite(lengthScales[d]) && lengthScales[d] > 0
            ? lengthScales[d]
            : 0.55;

        const diff = (x1[d] - x2[d]) / scale;

        if (!Number.isFinite(diff)) return Infinity;

        sumSq += diff * diff;
    }

    return Math.sqrt(sumSq / x1.length);
}

function matern52Kernel(x1, x2, lengthScales, isCoarseAxis = null) {
    if (!x1 || !x2 || !lengthScales || x1.length !== x2.length || x1.length !== lengthScales.length) {
        return NaN;
    }

    let dSqSmooth = 0;
    let dSqCoarse = 0;
    let hasCoarse = false;

    for (let i = 0; i < x1.length; i++) {
        const scale = lengthScales[i];
        if (!Number.isFinite(x1[i]) || !Number.isFinite(x2[i]) || !Number.isFinite(scale) || scale <= 0) {
            return NaN;
        }
        const diff = (x1[i] - x2[i]) / scale;
        if (isCoarseAxis && isCoarseAxis[i]) {
            dSqCoarse += diff * diff;
            hasCoarse = true;
        } else {
            dSqSmooth += diff * diff;
        }
    }

    if (!Number.isFinite(dSqSmooth) || !Number.isFinite(dSqCoarse)) return NaN;

    // Гладкая составляющая (Matérn 5/2)
    let kSmooth = 1.0;
    if (dSqSmooth > 0) {
        const d = Math.sqrt(dSqSmooth);
        const sqrt5 = 2.23606797749979;
        kSmooth = (1 + sqrt5 * d + (5 / 3) * dSqSmooth) * Math.exp(-sqrt5 * d);
    }

    // Ступенчатая составляющая (Matérn 3/2 — допускает изломы без осцилляций)
    let kCoarse = 1.0;
    if (hasCoarse && dSqCoarse > 0) {
        const dC = Math.sqrt(dSqCoarse);
        const sqrt3 = 1.7320508075688772;
        kCoarse = (1 + sqrt3 * dC) * Math.exp(-sqrt3 * dC);
    }

    const value = kSmooth * kCoarse;
    return Number.isFinite(value) ? value : NaN;
}

function choleskyDecomposition(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) return null;

    const n = matrix.length;

    for (let i = 0; i < n; i++) {
        if (!matrix[i] || matrix[i].length !== n) return null;

        for (let j = 0; j < n; j++) {
            if (!Number.isFinite(matrix[i][j])) return null;
        }
    }

    const L = Array.from(
        { length: n },
        () => new Float64Array(n)
    );

    for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
            let sum = matrix[i][j];

            for (let k = 0; k < j; k++) {
                sum -= L[i][k] * L[j][k];
            }

            if (!Number.isFinite(sum)) return null;

            if (i === j) {
                if (sum <= 1e-14) return null;

                L[i][j] = Math.sqrt(sum);

                if (!Number.isFinite(L[i][j])) return null;
            } else {
                const diagonal = L[j][j];

                if (
                    !Number.isFinite(diagonal) ||
                    diagonal <= 1e-14
                ) {
                    return null;
                }

                L[i][j] = sum / diagonal;

                if (!Number.isFinite(L[i][j])) return null;
            }
        }
    }

    return L;
}

function forwardSubstitution(L, b) {
    if (!Array.isArray(L) || !b || L.length !== b.length) {
        return null;
    }

    const n = L.length;
    const result = new Float64Array(n);

    for (let i = 0; i < n; i++) {
        if (!L[i] || L[i].length !== n) return null;
        if (!Number.isFinite(b[i])) return null;

        const diagonal = L[i][i];

        if (
            !Number.isFinite(diagonal) ||
            diagonal <= 1e-14
        ) {
            return null;
        }

        let sum = b[i];

        for (let j = 0; j < i; j++) {
            sum -= L[i][j] * result[j];
        }

        if (!Number.isFinite(sum)) return null;

        result[i] = sum / diagonal;

        if (!Number.isFinite(result[i])) return null;
    }

    return result;
}

function backwardSubstitution(L, b) {
    if (!Array.isArray(L) || !b || L.length !== b.length) {
        return null;
    }

    const n = L.length;
    const result = new Float64Array(n);

    for (let i = n - 1; i >= 0; i--) {
        if (!L[i] || L[i].length !== n) return null;
        if (!Number.isFinite(b[i])) return null;

        const diagonal = L[i][i];

        if (
            !Number.isFinite(diagonal) ||
            diagonal <= 1e-14
        ) {
            return null;
        }

        let sum = b[i];

        for (let j = i + 1; j < n; j++) {
            sum -= L[j][i] * result[j];
        }

        if (!Number.isFinite(sum)) return null;

        result[i] = sum / diagonal;

        if (!Number.isFinite(result[i])) return null;
    }

    return result;
}

function choleskySolve(L, b) {
    const y = forwardSubstitution(L, b);

    if (!y) return null;

    return backwardSubstitution(L, y);
}

function normalCDF(x) {
    if (Number.isNaN(x)) return NaN;

    if (x >= 8) return 1;
    if (x <= -8) return 0;

    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.39894228 * Math.exp(-x * x / 2);

    const p = d * t * (
        0.31938153 +
        t * (
            -0.356563782 +
            t * (
                1.781477937 +
                t * (
                    -1.821255978 +
                    t * 1.330274429
                )
            )
        )
    );

    return x >= 0 ? 1 - p : p;
}

function calculateConstrainedLogNormalEI(
    bestRawY,
    objectivePrediction,
    constraintProbFn,
    isMaximize = false
) {
    if (
        !Number.isFinite(bestRawY) ||
        bestRawY < 0 ||
        !objectivePrediction ||
        !Number.isFinite(objectivePrediction.meanLog) ||
        !Number.isFinite(objectivePrediction.sigmaLog) ||
        objectivePrediction.sigmaLog < 0
    ) {
        return 0;
    }

    const mu = objectivePrediction.meanLog;
    const sigma = objectivePrediction.sigmaLog;

    const target = 1 + bestRawY;
    const logTarget = Math.log(target);

    if (sigma < 1e-9) {
        const predictedValue = Math.exp(mu);
        const rawDiff = isMaximize ? (predictedValue - target) : (target - predictedValue);
        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, rawDiff / Math.max(1e-9, target))
            : 0;

        return improvement * constraintProbFn(0);
    }

    const thresholdZ = (logTarget - mu) / sigma;
    const lower = isMaximize ? Math.max(-8, thresholdZ) : -8;
    const upper = isMaximize ? 8 : Math.min(8, thresholdZ);

    if (!Number.isFinite(upper) || !Number.isFinite(lower) || upper <= lower) {
        return 0;
    }

    const intervals = 64;
    const step = (upper - lower) / intervals;
    const normalizer = 1 / Math.sqrt(2 * Math.PI);

    let integral = 0;

    for (let i = 0; i <= intervals; i++) {
        const z = lower + i * step;
        const predictedValue = Math.exp(mu + sigma * z);

        const rawDiff = isMaximize ? (predictedValue - target) : (target - predictedValue);
        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, rawDiff / Math.max(1e-9, target))
            : 0;

        const conditionalProbability = constraintProbFn(z);
        const density = normalizer * Math.exp(-0.5 * z * z);

        const weight =
            i === 0 || i === intervals
                ? 1
                : (i % 2 === 0 ? 2 : 4);

        integral += weight * improvement * conditionalProbability * density;
    }

    const result = integral * step / 3;

    return Number.isFinite(result)
        ? Math.max(0, result)
        : 0;
}

// ============================================================================
// 2. ГИПЕРПАРАМЕТРЫ GP: ОЦЕНКА И ОПТИМИЗАЦИЯ LENGTH SCALES
// ============================================================================

function estimateLengthScales(X, numParams) {
    if (
        !Array.isArray(X) ||
        !Number.isInteger(numParams) ||
        numParams < 1
    ) {
        return new Float64Array(0);
    }

    const scales = new Float64Array(numParams);

    if (X.length < 3) {
        scales.fill(0.55);
        return scales;
    }

    for (let d = 0; d < numParams; d++) {
        const differences = [];

        for (let i = 0; i < X.length; i++) {
            if (!X[i] || X[i].length !== numParams) {
                scales[d] = 0.55;
                continue;
            }

            for (let j = i + 1; j < X.length; j++) {
                if (!X[j] || X[j].length !== numParams) continue;

                const a = X[i][d];
                const b = X[j][d];

                if (!Number.isFinite(a) || !Number.isFinite(b)) {
                    continue;
                }

                const diff = Math.abs(a - b);

                if (diff > 1e-9) {
                    differences.push(diff);
                }
            }
        }

        if (!differences.length) {
            scales[d] = 0.55;
            continue;
        }

        differences.sort((a, b) => a - b);

        const median = differences[Math.floor(differences.length / 2)];

        scales[d] = Math.max(
            0.25,
            Math.min(1.15, median * 1.45)
        );
    }

    return scales;
}


// Детерминированная пространственно-разнообразная выборка.
// Не зависит от порядка, в котором симуляции были выполнены.
function selectDiverseIndices(X, maxSamples) {
    const n = X.length;

    if (n <= maxSamples) {
        return Array.from({ length: n }, (_, i) => i);
    }

    const dimensions = X[0]?.length || 0;

    if (dimensions < 1) {
        return Array.from(
            { length: maxSamples },
            (_, i) => Math.round(
                i * (n - 1) / (maxSamples - 1)
            )
        );
    }

    const centroid = new Float64Array(dimensions);

    for (const point of X) {
        for (let d = 0; d < dimensions; d++) {
            centroid[d] += point[d] / n;
        }
    }

    let firstIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < n; i++) {
        let distance = 0;

        for (let d = 0; d < dimensions; d++) {
            const diff = X[i][d] - centroid[d];
            distance += diff * diff;
        }

        if (distance < closestDistance) {
            closestDistance = distance;
            firstIndex = i;
        }
    }

    const selected = [firstIndex];
    const selectedSet = new Set(selected);

    const minDistances = new Float64Array(n);
    minDistances.fill(Infinity);

    while (selected.length < maxSamples) {
        const lastIndex = selected[selected.length - 1];
        const lastPoint = X[lastIndex];

        for (let i = 0; i < n; i++) {
            if (selectedSet.has(i)) continue;

            let distance = 0;

            for (let d = 0; d < dimensions; d++) {
                const diff = X[i][d] - lastPoint[d];
                distance += diff * diff;
            }

            minDistances[i] = Math.min(
                minDistances[i],
                distance
            );
        }

        let bestIndex = -1;
        let bestDistance = -Infinity;

        for (let i = 0; i < n; i++) {
            if (selectedSet.has(i)) continue;

            if (minDistances[i] > bestDistance) {
                bestDistance = minDistances[i];
                bestIndex = i;
            }
        }

        if (bestIndex < 0) break;

        selected.push(bestIndex);
        selectedSet.add(bestIndex);
    }

    return selected;
}

function optimizeLengthScales(
    X,
    Y,
    noise,
    numParams,
    progressFactor = 0.2,
    isComplete = [],
    prevScales = null,
    minAxisScales = null,
    isCoarseAxis = null
) {
    const totalObservations = Array.isArray(X) ? X.length : 0;

    const effectiveSamples = Math.max(4, Math.min(totalObservations, 60));
    const avgSpacing = Math.pow(effectiveSamples, -1 / numParams);
    const MIN_SCALE = Math.max(0.02, Math.min(0.25, 0.65 * avgSpacing * (1.0 - 0.35 * progressFactor)));
    const MAX_SCALE = Math.max(0.25, Math.min(1.40, 2.6 * avgSpacing));
    const MAX_SAMPLES = Math.min(60, 35 + Math.floor(progressFactor * 25));
    const MAX_PASSES = 4;
    if (
        !Array.isArray(X) ||
        !Array.isArray(Y) ||
        !Array.isArray(noise) ||
        !Array.isArray(isComplete) ||
        X.length === 0 ||
        Y.length !== X.length ||
        noise.length !== X.length ||
        isComplete.length !== X.length ||
        !Number.isInteger(numParams) ||
        numParams < 1
    ) {
        return estimateLengthScales(
            Array.isArray(X) ? X : [],
            Number.isInteger(numParams) && numParams > 0 ? numParams : 1
        );
    }

    let sampleX = X;
    let sampleY = Y;
    let sampleNoise = noise;
    let sampleIsComplete = isComplete;

    if (X.length > MAX_SAMPLES) {
        const completeIndices = [];
        const abortIndices = [];

        for (let i = 0; i < X.length; i++) {
            if (isComplete[i]) {
                completeIndices.push(i);
            } else {
                abortIndices.push(i);
            }
        }

        let selectedIndices;

        if (completeIndices.length >= MAX_SAMPLES) {
            const completeX = completeIndices.map(i => X[i]);
            const diverseSub = selectDiverseIndices(completeX, MAX_SAMPLES);
            selectedIndices = diverseSub.map(subIdx => completeIndices[subIdx]);
        } else {
            selectedIndices = [...completeIndices];
            const remainingSlots = MAX_SAMPLES - selectedIndices.length;

            if (remainingSlots > 0 && abortIndices.length > 0) {
                const abortX = abortIndices.map(i => X[i]);
                const diverseAborts = selectDiverseIndices(abortX, remainingSlots);
                for (const subIdx of diverseAborts) {
                    selectedIndices.push(abortIndices[subIdx]);
                }
            }
        }

        selectedIndices.sort((a, b) => a - b);

        sampleX = selectedIndices.map(i => X[i]);
        sampleY = selectedIndices.map(i => Y[i]);
        sampleNoise = selectedIndices.map(i => noise[i]);
        sampleIsComplete = selectedIndices.map(i => isComplete[i]);
    }

    const hasValidWarmStart =
        prevScales &&
        prevScales.length === numParams &&
        Array.from(prevScales).every(v => Number.isFinite(v) && v > 0);

    const baseScales = hasValidWarmStart
        ? prevScales
        : estimateLengthScales(sampleX, numParams);

    const scales = new Float64Array(numParams);
    const lowerBounds = new Float64Array(numParams);
    const upperBounds = new Float64Array(numParams);

    for (let d = 0; d < numParams; d++) {
        const axisMin = minAxisScales && Number.isFinite(minAxisScales[d])
            ? Math.max(MIN_SCALE, minAxisScales[d])
            : MIN_SCALE;
        const clamped = Math.max(axisMin, Math.min(MAX_SCALE, baseScales[d]));
        scales[d] = clamped;

        if (hasValidWarmStart) {
            lowerBounds[d] = Math.max(axisMin, clamped * 0.65);
            upperBounds[d] = Math.min(MAX_SCALE, clamped * 1.35);
        } else {
            lowerBounds[d] = axisMin;
            upperBounds[d] = MAX_SCALE;
        }
    }

    const evaluate = candidateScales => {
        const model = fitGaussianProcess(
            sampleX,
            sampleY,
            sampleNoise,
            candidateScales,
            sampleIsComplete,
            isCoarseAxis
        );

        if (!model?.valid || !Number.isFinite(model.logMarginalLikelihood)) {
            return -Infinity;
        }

        return model.logMarginalLikelihood;
    };

    let bestScore = evaluate(scales);

    if (!Number.isFinite(bestScore)) {
        return scales;
    }

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        let improved = false;

        for (let d = 0; d < numParams; d++) {
            const originalScale = scales[d];

            const candidates = [
                Math.max(lowerBounds[d], originalScale * 0.75),
                Math.min(upperBounds[d], originalScale * 1.33)
            ];

            for (const candidate of candidates) {
                if (Math.abs(candidate - scales[d]) < 1e-9) {
                    continue;
                }

                const testScales = new Float64Array(scales);
                testScales[d] = candidate;

                const score = evaluate(testScales);

                if (score > bestScore + 1e-8) {
                    scales[d] = candidate;
                    bestScore = score;
                    improved = true;
                }
            }
        }

        if (!improved) break;
    }

    return scales;
}

// ============================================================================
// 3. ЯДРО GAUSSIAN PROCESS: ОБУЧЕНИЕ И ПРОГНОЗ
// ============================================================================

function fitGaussianProcess(X, Y, noise, lengthScales, isComplete, isCoarseAxis = null) {
    const invalidModel = reason => ({
        valid: false,
        reason,
        jitter: null,
        jitterRetries: 0
    });

    if (
        !Array.isArray(X) ||
        !Array.isArray(Y) ||
        !Array.isArray(noise) ||
        !lengthScales ||
        X.length === 0 ||
        Y.length !== X.length ||
        noise.length !== X.length ||
        lengthScales.length === 0 ||
        !Array.isArray(isComplete) ||
        isComplete.length !== X.length
    ) {
        return invalidModel("INVALID_INPUT_DIMENSIONS");
    }

    // Контрактная защита. Все элементы isComplete обязаны быть строго boolean
    if (!isComplete.every(value => typeof value === "boolean")) {
        return invalidModel("INVALID_COMPLETENESS_FLAGS");
    }

    // Полная валидация входных данных до запуска дедупликации
    const dimensions = lengthScales.length;
    for (let i = 0; i < X.length; i++) {
        if (!X[i] || X[i].length !== dimensions) {
            return invalidModel("INVALID_INPUT_POINT");
        }
        for (let d = 0; d < dimensions; d++) {
            if (!Number.isFinite(X[i][d])) {
                return invalidModel("NON_FINITE_INPUT_POINT");
            }
        }
        if (!Number.isFinite(Y[i])) {
            return invalidModel("NON_FINITE_TARGET");
        }
        if (!Number.isFinite(noise[i]) || noise[i] < 0) {
            return invalidModel("INVALID_NOISE");
        }
    }

    // ========================================================================
    // ДВУХПРОХОДНАЯ СЕЛЕКЦИЯ ДУБЛИКАТОВ (ПРИОРИТЕТ УСПЕШНЫХ ТОЧЕК НАД ABORT)
    // ========================================================================
    const filteredIndices = [];
    const uniqueKeys = new Set();

    // Проход 1: Собираем только успешные симуляции на основе флага завершенности
    for (let i = 0; i < X.length; i++) {
        if (isComplete[i] === true) {
            const key = Array.from(X[i]).map(v => Number(v).toPrecision(15)).join(",");
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                filteredIndices.push(i);
            }
        }
    }

    // Проход 2: Заполняем оставшиеся пустые слоты абортированными наблюдениями
    for (let i = 0; i < X.length; i++) {
        if (isComplete[i] === false) {
            const key = Array.from(X[i]).map(v => Number(v).toPrecision(15)).join(",");
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                filteredIndices.push(i);
            }
        }
    }

    // Сохраняем хронологический порядок индексов, чтобы скользящие средние не искажали тренд
    filteredIndices.sort((a, b) => a - b);

    const N = filteredIndices.length;
    const filteredX = filteredIndices.map(i => X[i]);
    const filteredY = filteredIndices.map(i => Y[i]);
    const filteredNoise = filteredIndices.map(i => noise[i]);

    // Расчет среднего и дисперсии на отфильтрованной выборке
    let yMean = 0;
    for (let i = 0; i < N; i++) {
        yMean += (filteredY[i] - yMean) / (i + 1);
    }

    if (!Number.isFinite(yMean)) {
        return invalidModel("INVALID_TARGET_MEAN");
    }

    let yVariance = 0;
    for (let i = 0; i < N; i++) {
        const diff = filteredY[i] - yMean;
        yVariance += diff * diff;
    }
    yVariance /= N;

    if (!Number.isFinite(yVariance) || yVariance < 0) {
        return invalidModel("INVALID_TARGET_VARIANCE");
    }

    const yStd = Math.sqrt(yVariance);
    const MIN_Y_STD = 1e-6;
    const safeYStd = Math.max(yStd, MIN_Y_STD);

    const normalizedY = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        normalizedY[i] = (filteredY[i] - yMean) / safeYStd;
        if (!Number.isFinite(normalizedY[i])) {
            return invalidModel("INVALID_NORMALIZED_TARGET");
        }
    }


    const normalizedNoise = new Float64Array(N);
    const yVarianceScale = safeYStd * safeYStd;

    if (!Number.isFinite(yVarianceScale) || yVarianceScale <= 0) {
        return invalidModel("INVALID_TARGET_VARIANCE_SCALE");
    }

    for (let i = 0; i < N; i++) {
        const rawNoise = filteredNoise[i];

        if (!Number.isFinite(rawNoise) || rawNoise < 0) {
            return invalidModel("INVALID_OBSERVATION_NOISE");
        }

        normalizedNoise[i] = rawNoise > 0
            ? (rawNoise / yVarianceScale)
            : 1e-4;

        if (!Number.isFinite(normalizedNoise[i])) {
            return invalidModel("INVALID_NORMALIZED_NOISE");
        }
    }

    const K = Array.from(
        { length: N },
        () => new Float64Array(N)
    );

    for (let i = 0; i < N; i++) {
        for (let j = 0; j <= i; j++) {
            const value = matern52Kernel(
                filteredX[i],
                filteredX[j],
                lengthScales,
                isCoarseAxis
            );
            if (!Number.isFinite(value)) {
                return invalidModel("INVALID_KERNEL_VALUE");
            }

            K[i][j] = value;
            K[j][i] = value;
        }
    }

    let L = null;
    let jitter = 1e-6;
    let lastAttemptedJitter = jitter;
    let jitterRetries = 0;

    for (let attempt = 0; attempt < 7; attempt++) {
        lastAttemptedJitter = jitter;

        for (let i = 0; i < N; i++) {
            K[i][i] = 1 + normalizedNoise[i] + jitter;
        }

        L = choleskyDecomposition(K);
        if (L) break;

        jitterRetries++;
        jitter *= 10;
    }

    if (!L) {
        return {
            ...invalidModel("CHOLESKY_FAILED"),
            jitter: lastAttemptedJitter,
            jitterRetries
        };
    }

    // ВОССТАНОВЛЕНО: Расчет весов Гауссовского Процесса через разложение Чолесского
    const weights = choleskySolve(L, normalizedY);

    if (!weights || !weights.every(Number.isFinite)) {
        return {
            ...invalidModel("INVALID_WEIGHTS"),
            jitter: lastAttemptedJitter,
            jitterRetries
        };
    }

    let quadraticForm = 0;
    let logDeterminant = 0;

    for (let i = 0; i < N; i++) {
        quadraticForm += normalizedY[i] * weights[i];
        logDeterminant += Math.log(L[i][i]);
    }

    // ВОССТАНОВЛЕНО: Расчет предельного логарифмического правдоподобия модели
    const logMarginalLikelihood = -0.5 * (
        quadraticForm +
        2 * logDeterminant +
        N * Math.log(2 * Math.PI)
    );

    if (!Number.isFinite(logMarginalLikelihood)) {
        return {
            ...invalidModel("INVALID_LOG_MARGINAL_LIKELIHOOD"),
            jitter: lastAttemptedJitter,
            jitterRetries
        };
    }

    return {
        valid: true,
        X: filteredX,
        L,
        weights,
        lengthScales,
        isCoarseAxis,
        yMean,
        yStd: safeYStd,
        normalizedY,
        jitter: lastAttemptedJitter,
        jitterRetries,
        trainingCount: N,
        logMarginalLikelihood
    };
}

function predictGaussianProcess(model, x) {
    if (
        !model ||
        !model.valid ||
        !x ||
        x.length !== model.lengthScales.length
    ) {
        return null;
    }

    for (let d = 0; d < x.length; d++) {
        if (!Number.isFinite(x[d])) return null;
    }

    const N = model.trainingCount;
    const kStar = new Float64Array(N);

    let mean = 0;

    for (let i = 0; i < N; i++) {
        kStar[i] = matern52Kernel(
            x,
            model.X[i],
            model.lengthScales,
            model.isCoarseAxis
        );

        if (!Number.isFinite(kStar[i])) return null;

        mean += kStar[i] * model.weights[i];
    }

    if (!Number.isFinite(mean)) return null;

    const v = forwardSubstitution(model.L, kStar);

    if (!v) return null;

    let varianceReduction = 0;

    for (let i = 0; i < N; i++) {
        varianceReduction += v[i] * v[i];
    }

    const rawVariance = 1 - varianceReduction;

    if (
        !Number.isFinite(rawVariance) ||
        rawVariance < -1e-7
    ) {
        return null;
    }

    const variance = Math.max(1e-9, rawVariance);
    const sigmaNormalized = Math.sqrt(variance);

    const meanLog = mean * model.yStd + model.yMean;
    const sigmaLog = sigmaNormalized * model.yStd;

    if (
        !Number.isFinite(meanLog) ||
        !Number.isFinite(sigmaLog)
    ) {
        return null;
    }

    return {
        meanNormalized: mean,
        varianceNormalized: variance,
        sigmaNormalized,
        meanLog,
        sigmaLog
    };
}

function applySigmaCalibration(prediction, scale) {
    if (
        !prediction ||
        !Number.isFinite(prediction.sigmaLog) ||
        prediction.sigmaLog < 0 ||
        !Number.isFinite(prediction.varianceNormalized) ||
        prediction.varianceNormalized < 0
    ) {
        return null;
    }

    const factor = Number.isFinite(scale)
        ? Math.max(0.75, Math.min(3, scale))
        : 1;

    return {
        ...prediction,
        rawSigmaLog: prediction.sigmaLog,
        sigmaNormalized: prediction.sigmaNormalized * factor,
        varianceNormalized:
            prediction.varianceNormalized * factor * factor,
        sigmaLog: prediction.sigmaLog * factor,
        sigmaCalibration: factor
    };
}


// ============================================================================
// 5. КАЛИБРОВКА НЕОПРЕДЕЛЁННОСТИ И ВЕРОЯТНОСТНЫЕ ОГРАНИЧЕНИЯ
// ============================================================================

// Условие 1,2,3,4,5,6: Интеллектуальный расчет калибровки с ЕМА-сглаживанием и глобальным контролем осей
function estimateResidualSigmaScale(pairs, key, observedX = [], lastScaleValue = 1.0, progressFactor = 0.0) {
    const MIN_REQUIRED_SAMPLES = 20;
    const SMOOTHING_FACTOR = 0.15;

    // Санитарная нормализация входящего стейта ЕМА
    const MAX_SIGMA_SCALE = 1.25;
    const previousScale = Number.isFinite(lastScaleValue)
        ? Math.max(0.75, Math.min(MAX_SIGMA_SCALE, lastScaleValue))
        : 1.0;

    if (!Array.isArray(pairs) || pairs.length < MIN_REQUIRED_SAMPLES) return previousScale;

    let sumSquares = 0;
    let validCount = 0;
    for (const pair of pairs) {
        const value = pair?.[key];
        if (Number.isFinite(value)) {
            sumSquares += Math.min(4.0, value * value);
            validCount++;
        }
    }
    if (validCount < MIN_REQUIRED_SAMPLES) return previousScale;

    // Условие 6: Контроль разнообразия осей плавно адаптируется к финишу бюджета
    if (Array.isArray(observedX) && observedX.length > 5) {
        const numParams = observedX[0]?.length || 0; // Исправлено получение размерности параметров
        if (numParams > 0) {
            let totalAxisVariance = 0;
            for (let d = 0; d < numParams; d++) {
                let axisMean = 0;
                for (let i = 0; i < observedX.length; i++) axisMean += observedX[i][d] / observedX.length;
                let axisVar = 0;
                for (let i = 0; i < observedX.length; i++) { const diff = observedX[i][d] - axisMean; axisVar += diff * diff; }
                totalAxisVariance += (axisVar / observedX.length) / numParams;
            }

            // ИСПРАВЛЕНО: Порог кучности плавно зажимается к концу (с 0.02 до 0.005)
            const dynamicMinVariance = 0.02 * (1.0 - 0.75 * progressFactor);
            if (totalAxisVariance < dynamicMinVariance) return previousScale;
        }
    }

    const PRIOR_COUNT = 30;
    const instantScale = Math.sqrt((PRIOR_COUNT + sumSquares) / (PRIOR_COUNT + validCount));
    const clampedScale = Math.max(0.75, Math.min(MAX_SIGMA_SCALE, instantScale));

    // ИСПРАВЛЕНО: Настоящее ЕМА сглаживание рассчитывается от нормализованного previousScale
    const smoothedScale = (1.0 - SMOOTHING_FACTOR) * previousScale + SMOOTHING_FACTOR * clampedScale;

    return Number.isFinite(smoothedScale)
        ? Math.max(0.75, Math.min(MAX_SIGMA_SCALE, smoothedScale))
        : previousScale;
}


function probabilityBelow(prediction, rawLimit) {
    if (
        !prediction ||
        !Number.isFinite(rawLimit) ||
        rawLimit < 0 ||
        !Number.isFinite(prediction.meanLog) ||
        !Number.isFinite(prediction.sigmaLog) ||
        prediction.sigmaLog < 0
    ) {
        return 0;
    }

    const limitLog = Math.log1p(rawLimit);
    const sigma = prediction.sigmaLog;

    if (sigma < 1e-9) {
        return prediction.meanLog <= limitLog ? 1 : 0;
    }

    const probability = normalCDF(
        (limitLog - prediction.meanLog) / sigma
    );

    return Number.isFinite(probability)
        ? Math.max(0, Math.min(1, probability))
        : 0;
}

// Оценка корреляции стандартизированных out-of-sample остатков GP.
function estimateResidualCorrelation(pairs) {
    const MIN_SAMPLES = 12;
    const SHRINKAGE = 12;

    if (!Array.isArray(pairs)) {
        return { rho: 0, rawRho: 0, samples: 0 };
    }

    const validPairs = pairs.filter(pair =>
        Number.isFinite(pair?.load) &&
        Number.isFinite(pair?.error)
    );

    const n = validPairs.length;

    if (n < MIN_SAMPLES) {
        return { rho: 0, rawRho: 0, samples: n };
    }

    let meanLoad = 0;
    let meanError = 0;

    for (const pair of validPairs) {
        meanLoad += pair.load;
        meanError += pair.error;
    }

    meanLoad /= n;
    meanError /= n;

    let covariance = 0;
    let varianceLoad = 0;
    let varianceError = 0;

    for (const pair of validPairs) {
        const dl = pair.load - meanLoad;
        const de = pair.error - meanError;

        covariance += dl * de;
        varianceLoad += dl * dl;
        varianceError += de * de;
    }

    if (
        varianceLoad < 1e-12 ||
        varianceError < 1e-12
    ) {
        return { rho: 0, rawRho: 0, samples: n };
    }

    const rawRho = Math.max(
        -1,
        Math.min(
            1,
            covariance /
            Math.sqrt(varianceLoad * varianceError)
        )
    );

    const reliability = n / (n + SHRINKAGE);

    const rho = Math.max(
        -0.8,
        Math.min(0.8, rawRho * reliability)
    );

    return { rho, rawRho, samples: n };
}

const SOBOL_PARAMETERS = [
    null,
    { s: 1, a: 0, m: [1] },
    { s: 2, a: 1, m: [1, 3] },
    { s: 3, a: 1, m: [1, 3, 1] },
    { s: 3, a: 2, m: [1, 1, 1] },
    { s: 4, a: 1, m: [1, 3, 5, 13] },
    { s: 4, a: 4, m: [1, 1, 5, 5] },
    { s: 5, a: 2, m: [1, 3, 3, 9, 7] },
    { s: 5, a: 4, m: [1, 1, 3, 11, 13] },
    { s: 5, a: 7, m: [1, 1, 5, 1, 15] }
];

// ============================================================================
// 6. ГЕНЕРАТОР ГЛОБАЛЬНОГО ПРОСТРАНСТВЕННОГО ПОИСКА (SOBOL)
// ============================================================================

function createSobolGenerator(dimensions, digitalShift = null, initialDraws = 0) {
    if (
        !Number.isInteger(dimensions) ||
        dimensions < 1 ||
        dimensions > 10
    ) {
        throw new Error(
            "Sobol поддерживает от 1 до 10 параметров."
        );
    }

    const BITS = 32;

    const directions = Array.from(
        { length: dimensions },
        () => new Uint32Array(BITS)
    );

    for (let d = 0; d < dimensions; d++) {
        const V = directions[d];

        if (d === 0) {
            for (let j = 0; j < BITS; j++) {
                V[j] = (2 ** (31 - j)) >>> 0;
            }

            continue;
        }

        const params = SOBOL_PARAMETERS[d];

        if (!params) {
            throw new Error(
                "Отсутствуют параметры Sobol для измерения " + d
            );
        }

        const { s, a, m } = params;

        for (let j = 0; j < s; j++) {
            V[j] = (
                m[j] * (2 ** (31 - j))
            ) >>> 0;
        }

        for (let j = s; j < BITS; j++) {
            let value =
                V[j - s] ^ (V[j - s] >>> s);

            for (let k = 1; k < s; k++) {
                if (((a >>> (s - 1 - k)) & 1) !== 0) {
                    value ^= V[j - k];
                }
            }

            V[j] = value >>> 0;
        }
    }

    const state = new Uint32Array(dimensions);
    let index = 0;

    const draw = () => {
        index++;

        let bit = 0;
        let n = index;

        while ((n & 1) === 0 && bit < BITS - 1) {
            n >>>= 1;
            bit++;
        }

        const point = new Float64Array(dimensions);

        for (let d = 0; d < dimensions; d++) {
            state[d] ^= directions[d][bit];
            const shifted = digitalShift ? ((state[d] ^ digitalShift[d]) >>> 0) : state[d];
            point[d] = shifted / 4294967296;
        }

        return point;
    };

    for (let i = 0; i < initialDraws; i++) {
        draw();
    }

    return draw;
}


function roundByStep(val, step) {
    const str = step.toString();
    const precision = str.includes("e-")
        ? Math.min(8, Number(str.split("e-")[1]))
        : (str.includes(".") ? Math.min(6, str.length - str.indexOf(".") - 1) : 0);
    const rounded = Number(val.toFixed(precision));
    return Object.is(rounded, -0) ? 0 : rounded;
}

function generateDiscreteSobolPoints({
                                         count,
                                         bounds,
                                         sobolState = { drawsCount: 0, digitalShift: null },
                                         seenKeys = null
                                     }) {
    if (!Array.isArray(bounds) || bounds.length === 0) {
        throw new Error("Параметр bounds обязателен и должен быть непустым массивом.");
    }

    const numDims = bounds.length;
    if (!Number.isFinite(count) || count <= 0) {
        return { points: [], exhausted: false, remainingAvailable: 0 };
    }

    const externalSeen = seenKeys;
    const batchSeen = new Set();

    let shiftArray = null;
    if (sobolState.digitalShift) {
        shiftArray = sobolState.digitalShift instanceof Uint32Array
            ? sobolState.digitalShift
            : new Uint32Array(Object.values(sobolState.digitalShift));
    }

    if (typeof sobolState._draw !== "function") {
        const drawFn = createSobolGenerator(numDims, shiftArray, sobolState.drawsCount || 0);
        Object.defineProperty(sobolState, "_draw", {
            value: drawFn,
            enumerable: false,
            writable: true,
            configurable: true
        });
    }

    const axes = new Array(numDims);
    let totalCombinations = 1;
    let isDiscreteSpace = true;

    for (let d = 0; d < numDims; d++) {
        const b = bounds[d];

        if (Array.isArray(b.levels) && b.levels.length > 0) {
            const levels = b.levels;
            const lowLimit = Number.isFinite(b.min) ? b.min : levels[0];
            const highLimit = Number.isFinite(b.max) ? b.max : levels[levels.length - 1];

            let minIdx = 0;
            while (minIdx < levels.length - 1 && levels[minIdx] < lowLimit - 1e-12) minIdx++;

            let maxIdx = levels.length - 1;
            while (maxIdx > 0 && levels[maxIdx] > highLimit + 1e-12) maxIdx--;

            if (minIdx > maxIdx) {
                const mid = (lowLimit + highLimit) * 0.5;
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let i = 0; i < levels.length; i++) {
                    const dist = Math.abs(levels[i] - mid);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = i;
                    }
                }
                minIdx = maxIdx = bestIdx;
            }

            const nodesCount = maxIdx - minIdx + 1;
            const actualMin = levels[minIdx];
            const actualMax = levels[maxIdx];
            totalCombinations *= nodesCount;

            axes[d] = {
                mode: "LEVELS",
                levels,
                minIdx,
                nodesCount,
                min: actualMin,
                max: actualMax,
                span: actualMax - actualMin
            };
        } else if (Number.isFinite(b.min) && Number.isFinite(b.max) && Number.isFinite(b.step) && b.step > 0) {
            const low = Math.min(b.min, b.max);
            const high = Math.max(b.min, b.max);
            const span = high - low;
            const nodesCount = Math.max(1, Math.floor((span + 1e-12) / b.step) + 1);
            const actualMax = roundByStep(low + (nodesCount - 1) * b.step, b.step);

            totalCombinations *= nodesCount;

            axes[d] = {
                mode: "STEP",
                step: b.step,
                nodesCount,
                min: low,
                max: actualMax,
                span: actualMax - low
            };
        } else {
            const low = Math.min(b.min, b.max);
            const high = Math.max(b.min, b.max);
            isDiscreteSpace = false;
            totalCombinations = Infinity;

            axes[d] = {
                mode: "CONTINUOUS",
                nodesCount: Infinity,
                min: low,
                max: high,
                span: high - low
            };
        }
    }

    let occupiedInZone = 0;
    const totalOccupied = externalSeen ? externalSeen.size : 0;
    // Сканируем ключи только когда общее число комбинаций сопоставимо с числом занятых точек
    if (isDiscreteSpace && totalOccupied > 0 && (totalCombinations - totalOccupied) < count) {
        for (const key of externalSeen) {
            const parts = key.split("|");
            if (parts.length !== numDims) continue;

            let isInside = true;
            for (let d = 0; d < numDims; d++) {
                const val = Number(parts[d]);
                const ax = axes[d];
                if (!Number.isFinite(val) || val < ax.min - 1e-9 || val > ax.max + 1e-9) {
                    isInside = false;
                    break;
                }
            }
            if (isInside) occupiedInZone++;
        }
    }

    const remainingAvailable = isDiscreteSpace
        ? Math.max(0, totalCombinations - occupiedInZone)
        : Infinity;

    if (remainingAvailable === 0) {
        return { points: [], exhausted: true, remainingAvailable: 0 };
    }

    const getAxisValue = (ax, nodeIdx, uContinuous = 0.5) => {
        if (ax.mode === "LEVELS") return ax.levels[ax.minIdx + nodeIdx];
        if (ax.mode === "STEP") return roundByStep(ax.min + nodeIdx * ax.step, ax.step);
        return ax.min + uContinuous * ax.span;
    };

    const targetCount = Math.min(count, remainingAvailable);
    const results = [];
    let consecutiveMisses = 0;
    const MAX_CONSECUTIVE_MISSES = 25;
    let exhausted = false;

    while (results.length < targetCount) {
        if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
            exhausted = true;
            break;
        }

        const u = sobolState._draw();
        sobolState.drawsCount++;

        const values = new Array(numDims);
        const normalized = new Float64Array(numDims);

        for (let d = 0; d < numDims; d++) {
            const ax = axes[d];
            let val;

            if (ax.nodesCount <= 1) {
                val = getAxisValue(ax, 0, 0.5);
            } else {
                const uVal = Number.isFinite(u[d]) ? Math.max(0, Math.min(0.999999999999, u[d])) : 0.5;
                const nodeIdx = ax.mode === "CONTINUOUS" ? 0 : Math.floor(uVal * ax.nodesCount);
                val = getAxisValue(ax, nodeIdx, uVal);
            }

            values[d] = val;
            normalized[d] = ax.span > 0 ? (val - ax.min) / ax.span : 0;
        }

        const key = values.join("|");
        if ((externalSeen && externalSeen.has(key)) || batchSeen.has(key)) {
            consecutiveMisses++;
            continue;
        }

        consecutiveMisses = 0;
        batchSeen.add(key);
        results.push({ values, normalized, key });
    }

    const leftAfter = isDiscreteSpace
        ? Math.max(0, remainingAvailable - results.length)
        : Infinity;

    return {
        points: results,
        exhausted: exhausted || leftAfter === 0,
        remainingAvailable: leftAfter
    };
}


// ============================================================================
// 7. ГЛАВНЫЙ ОРКЕСТРАТОР ОПТИМИЗАЦИИ
// Внутренние блоки ниже разделены по ответственности; алгоритм не изменён.
// ============================================================================

function createProfileContext(res) {
    const prof = res?.temperatureProfile;
    const findYIndex = (yMm) => {
        const yCoords = prof?.yCoordinatesMm;
        if (!Array.isArray(yCoords) || yCoords.length === 0) return 0;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let j = 0; j < yCoords.length; j++) {
            const d = Math.abs(yCoords[j] - yMm);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = j;
            }
        }
        return bestIdx;
    };

    const makeAccessors = (field) => ({
        surfaceTop: (yMm = 0) => (field && prof ? field[findYIndex(yMm)] : NaN),
        surfaceBottom: (yMm = 0) => (field && prof ? field[(prof.Nx - 1) * prof.Ny + findYIndex(yMm)] : NaN),
        core: (yMm = 0) => (field && prof ? field[((prof.Nx - 1) >> 1) * prof.Ny + findYIndex(yMm)] : NaN)
    });

    return {
        ...makeAccessors(prof?.heating),
        afterCooling: makeAccessors(prof?.pause),
        rawProfile: prof
    };
}

function normalizeSingleConstraint(c) {
    const val = c?.value;
    if (!Number.isFinite(val)) {
        return { gpVal: NaN, gpLimit: 0, violation: Infinity, feasible: false };
    }

    const hasMax = Number.isFinite(c?.max);
    const hasMin = Number.isFinite(c?.min);

    if (hasMax && !hasMin) {
        const shift = c.max < 0 ? Math.abs(c.max) + 1 : 0;
        const gpVal = Math.max(0, val + shift);
        const gpLimit = Math.max(0, c.max + shift);
        const scale = Math.max(1e-6, Math.abs(c.max));
        const violation = Math.max(0, (val - c.max) / scale);
        return { gpVal, gpLimit, violation, feasible: val <= c.max };
    }

    if (hasMin && !hasMax) {
        const gpVal = Math.max(0, c.min * 2 - val);
        const gpLimit = Math.max(0, c.min);
        const scale = Math.max(1e-6, Math.abs(c.min));
        const violation = Math.max(0, (c.min - val) / scale);
        return { gpVal, gpLimit, violation, feasible: val >= c.min };
    }

    if (hasMin && hasMax) {
        const center = (c.min + c.max) * 0.5;
        const halfWidth = Math.max(1e-6, (c.max - c.min) * 0.5);
        const dist = Math.abs(val - center);
        const violation = Math.max(0, (dist - halfWidth) / halfWidth);
        return { gpVal: dist, gpLimit: halfWidth, violation, feasible: val >= c.min && val <= c.max };
    }

    return { gpVal: 0, gpLimit: 0, violation: 0, feasible: true };
}

export async function optimizeForMaxSpeed(baseParams, simulateFn, options = {}) {
    // -----------------------------------------------------------------------
    // 7.1. ВХОДНЫЕ ДАННЫЕ, ЗАДАЧА ОПТИМИЗАЦИИ И ПРОВЕРКА КОНФИГУРАЦИИ
    // -----------------------------------------------------------------------

    const state = options.resumeState || null;
    let currentExecutionCount = state ? state.currentExecutionCount : 0;

    if (
        !baseParams ||
        typeof baseParams !== "object" ||
        typeof simulateFn !== "function"
    ) {
        throw new Error(
            "Некорректные входные параметры оптимизатора."
        );
    }

    const task = options.task;

    if (
        !task ||
        typeof task !== "object" ||
        !task.parameters ||
        typeof task.parameters !== "object" ||
        Array.isArray(task.parameters) ||
        typeof task.evaluateResult !== "function"
    ) {
        throw new Error(
            "Конфигурация задачи (options.task) не передана или некорректна!"
        );
    }

    const config = task.parameters;
    const taskSettings = task.settings || {};

    const paramKeys = Object.keys(config);
    const numParams = paramKeys.length;

    if (!numParams) {
        throw new Error(
            "Нет параметров для оптимизации!"
        );
    }

    if (numParams > 10) {
        throw new Error(
            "Оптимизатор поддерживает не более 10 параметров."
        );
    }

    const minRegionRadius = Math.max(0.032, Math.min(0.05, 0.025 + numParams * 0.0035));

    const budgetCap = Number.isFinite(taskSettings.totalBudgetIterations)
        ? Math.max(6, Math.floor(taskSettings.totalBudgetIterations * 0.25))
        : 16;
    const requestedInitialPoints = Number.isFinite(taskSettings.randomInitPoints)
        ? taskSettings.randomInitPoints
        : Math.min(budgetCap, Math.max(8, numParams * 4 + 4));

    const requestedIterations = Number.isFinite(taskSettings.totalBudgetIterations)
        ? taskSettings.totalBudgetIterations
        : Math.max(80, numParams * 35 + 20);

    if (
        !Number.isFinite(requestedIterations) ||
        requestedIterations < 1 ||
        !Number.isFinite(requestedInitialPoints) ||
        requestedInitialPoints < 0
    ) {
        throw new Error(
            "Некорректный бюджет оптимизации."
        );
    }

    const extraIterations = Math.floor(requestedIterations);

    if (extraIterations < 1) {
        throw new Error("Бюджет оптимизации должен быть не менее 1.");
    }

    const totalIterations = currentExecutionCount + extraIterations;

    const initPointsCount = Math.min(
        totalIterations,
        Math.max(1, Math.floor(requestedInitialPoints))
    );

    for (const key of paramKeys) {
        const range = config[key];

        if (
            !range ||
            typeof range !== "object" ||
            !Number.isFinite(range.min) ||
            !Number.isFinite(range.max) ||
            range.max < range.min ||
            !Number.isFinite(range.max - range.min)
        ) {
            throw new Error(
                "Некорректный диапазон параметра: " + key
            );
        }
    }

    if (task.earlyAbort) {
        const ceiling = task.earlyAbort.ceiling;
        if (
            typeof task.earlyAbort.metric !== "function" ||
            !Number.isFinite(ceiling) ||
            ceiling <= 0 ||
            !Number.isFinite(ceiling * 3)
        ) {
            throw new Error(
                "Некорректная конфигурация раннего прерывания (task.earlyAbort)!"
            );
        }
    }

    // -----------------------------------------------------------------------
    // 7.2. ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ (RESUME STATE)
    // -----------------------------------------------------------------------

    self.lastEMAStorage = state?.lastEMAStorage
        ? {
            load: state.lastEMAStorage.load ?? 1.0,
            errors: Array.isArray(state.lastEMAStorage.errors)
                ? [...state.lastEMAStorage.errors]
                : (Number.isFinite(state.lastEMAStorage.error) ? [state.lastEMAStorage.error] : [])
        }
        : { load: 1.0, errors: [] };

    // Детерминированный PRNG (Mulberry32) для рулетки, ветвлений и направленных шагов
    let prngState = (state?.prngState ?? options.seed ?? 1337) >>> 0;
    const nextRandom = () => {
        prngState = (prngState + 0x6D2B79F5) | 0;
        let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const createDigitalShift = () => {
        const shift = new Uint32Array(numParams);
        for (let d = 0; d < numParams; d++) {
            shift[d] = (nextRandom() * 4294967296) >>> 0;
        }
        return shift;
    };

    const attachRegionSobol = (reg) => {
        const shift = reg.digitalShift
            ? (reg.digitalShift instanceof Uint32Array ? reg.digitalShift : new Uint32Array(Object.values(reg.digitalShift)))
            : createDigitalShift();
        const draws = Number.isInteger(reg.sobolDraws) ? reg.sobolDraws : 0;

        reg.sobolState = {
            drawsCount: draws,
            digitalShift: shift
        };
        return reg;
    };

    const searchRegions = Array.isArray(state?.searchRegions)
        ? state.searchRegions.map(r => attachRegionSobol({
            ...r,
            center: r.center instanceof Float64Array ? r.center : new Float64Array(Object.values(r.center || {})),
            bestX: r.bestX instanceof Float64Array ? r.bestX : new Float64Array(Object.values(r.bestX || {})),
            previousBestX: r.previousBestX ? (r.previousBestX instanceof Float64Array ? r.previousBestX : new Float64Array(Object.values(r.previousBestX))) : null,
            rawDirection: r.rawDirection ? (r.rawDirection instanceof Float64Array ? r.rawDirection : new Float64Array(Object.values(r.rawDirection))) : null,
            loadLengthScales: r.loadLengthScales ? (r.loadLengthScales instanceof Float64Array ? r.loadLengthScales : new Float64Array(Object.values(r.loadLengthScales))) : null,
            constraintLengthScales: Array.isArray(r.constraintLengthScales)
                ? r.constraintLengthScales.map(s => (s ? (s instanceof Float64Array ? s : new Float64Array(Object.values(s))) : null))
                : [],
            regionalModels: null
        }))
        : [];

    const globalGPState = state?.globalGPState
        ? {
            ...state.globalGPState,
            loadLengthScales: state.globalGPState.loadLengthScales ? new Float64Array(Object.values(state.globalGPState.loadLengthScales)) : null,
            constraintLengthScales: Array.isArray(state.globalGPState.constraintLengthScales)
                ? state.globalGPState.constraintLengthScales.map(s => (s ? new Float64Array(Object.values(s)) : null))
                : [],
            lastConstraintScaleCompleteCount: Array.isArray(state.globalGPState.lastConstraintScaleCompleteCount)
                ? [...state.globalGPState.lastConstraintScaleCompleteCount]
                : [],
            models: null
        }
        : {
            loadLengthScales: null,
            constraintLengthScales: [],
            lastLoadScaleCompleteCount: -Infinity,
            lastConstraintScaleCompleteCount: [],
            models: null
        };

    if (!state) {
        self.lastEvaluatedBestParams = null;
        self.lastEvaluatedBestMetrics = null;
        self.lastEvaluatedBestStepNumber = null;
    } else {
        self.lastEvaluatedBestParams = state.lastEvaluatedBestParams ?? state.gBestPhysical ?? null;
        self.lastEvaluatedBestMetrics = state.lastEvaluatedBestMetrics ?? state.gBestMetrics ?? null;
        self.lastEvaluatedBestStepNumber = state.lastEvaluatedBestStepNumber ?? null;
    }

    // -----------------------------------------------------------------------
    // 7.3. ПРЕОБРАЗОВАНИЕ ПАРАМЕТРОВ И КАНОНИЗАЦИЯ КАНДИДАТОВ
    // Нормализованные координаты <-> физические значения, округление и ключи.
    // -----------------------------------------------------------------------

    const applyParamsByPath = (base, paramsObj) => {
        const cloned = {
            ...base,
            simulation: {
                ...(base.simulation || {}),
                ...(task.simOverrides || {})
            }
        };

        for (const [key, val] of Object.entries(paramsObj)) {
            const path = config[key]?.path;
            if (!path) continue;

            const parts = path.split(".");
            let curr = cloned;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                const existing = curr[part];
                curr[part] = Array.isArray(existing)
                    ? [...existing]
                    : (existing && typeof existing === "object" ? { ...existing } : {});
                curr = curr[part];
            }

            curr[parts[parts.length - 1]] = val;
        }

        return cloned;
    };

    const getPhysicalKeyFromPhysical = physical =>
        paramKeys.map(key => String(physical[key])).join("|");

    const canonicalizeNormalized = xNorm => {
        if (!xNorm || xNorm.length !== numParams) {
            throw new Error(
                "Некорректная размерность нормализованной точки."
            );
        }

        const result = new Float64Array(numParams);

        for (let i = 0; i < numParams; i++) {
            const key = paramKeys[i];
            const range = config[key];

            const x = Number.isFinite(xNorm[i])
                ? Math.max(0, Math.min(1, xNorm[i]))
                : 0.5;

            if (range.max === range.min) {
                result[i] = 0;
                continue;
            }

            result[i] = x;
        }

        return result;
    };

    const getStepPrecision = (step) => {
        if (!Number.isFinite(step) || step <= 0) return null;
        const str = step.toString();
        if (str.includes("e-")) {
            return Math.min(8, Number(str.split("e-")[1]));
        }
        const dotIdx = str.indexOf(".");
        return dotIdx >= 0 ? Math.min(6, str.length - dotIdx - 1) : 0;
    };

    const roundByPrecision = (val, precision) =>
        Number.isInteger(precision) ? Number(val.toFixed(precision)) : val;

    // 1. Построение статического массива допустимых уровней из числового step
    const discreteLevels = Array.from({ length: numParams }, (_, d) => {
        const range = config[paramKeys[d]];
        const span = range.max - range.min;
        if (span <= 0) return [range.min];

        const MAX_INDEXED_LEVELS = 5000;
        const step = range.step;

        if (Number.isFinite(step) && step > 0) {
            const precision = getStepPrecision(step);
            const count = Math.floor((span + 1e-12) / step);
            if (count > 0 && count <= MAX_INDEXED_LEVELS) {
                const levels = [];
                for (let i = 0; i <= count; i++) {
                    const val = roundByPrecision(range.min + i * step, precision);
                    if (val <= range.max + 1e-12) {
                        levels.push(Math.min(range.max, val));
                    }
                }
                return levels.length > 0 ? levels : null;
            }
        }
        return null;
    });

    const findNearestLevelIndex = (levels, physVal) => {
        let low = 0;
        let high = levels.length - 1;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (levels[mid] < physVal) low = mid + 1;
            else high = mid;
        }
        if (low > 0 && Math.abs(levels[low - 1] - physVal) < Math.abs(levels[low] - physVal)) {
            return low - 1;
        }
        return low;
    };

    const toPhysical = xNorm => {
        const canonicalX = canonicalizeNormalized(xNorm);
        const result = {};

        paramKeys.forEach((key, idx) => {
            const range = config[key];
            const span = range.max - range.min;
            const rawPhys = range.min + canonicalX[idx] * span;
            const levels = discreteLevels[idx];

            if (levels && levels.length > 0) {
                result[key] = levels[findNearestLevelIndex(levels, rawPhys)];
            } else if (Number.isFinite(range.step) && range.step > 0) {
                const precision = getStepPrecision(range.step);
                const snapped = range.min + Math.round((rawPhys - range.min) / range.step) * range.step;
                result[key] = Math.max(range.min, Math.min(range.max, roundByPrecision(snapped, precision)));
            } else {
                result[key] = rawPhys;
            }
        });

        return result;
    };

    const isValidPhysical = physical => {
        if (!physical || typeof physical !== "object") return false;
        for (const key of paramKeys) {
            const val = physical[key];
            const range = config[key];
            if (!Number.isFinite(val) || val < range.min - 1e-12 || val > range.max + 1e-12) {
                return false;
            }
        }
        return true;
    };

    const quantizeCandidate = rawX => {
        const physical = toPhysical(rawX);
        if (!isValidPhysical(physical)) return null;

        const quantizedX = new Float64Array(numParams);
        for (let i = 0; i < numParams; i++) {
            const key = paramKeys[i];
            const range = config[key];
            quantizedX[i] = range.max !== range.min
                ? Math.max(0, Math.min(1, (physical[key] - range.min) / (range.max - range.min)))
                : 0;
        }
        return { x: quantizedX, physical, key: getPhysicalKeyFromPhysical(physical) };
    };

    const generateLatticeNeighbors = centerNormX => {
        const centerQ = quantizeCandidate(centerNormX);
        if (!centerQ) return [];
        const totalCombos = Math.pow(3, numParams);
        const neighbors = [];

        for (let mask = 0; mask < totalCombos; mask++) {
            let temp = mask;
            const normVec = new Float64Array(numParams);
            let isCenter = true;

            for (let d = 0; d < numParams; d++) {
                const shift = (temp % 3) - 1;
                temp = Math.floor(temp / 3);
                if (shift !== 0) isCenter = false;

                const key = paramKeys[d];
                const range = config[key];
                const span = range.max - range.min;
                const levels = discreteLevels[d];
                const baseVal = centerQ.physical[key];

                let nextVal = baseVal;
                if (shift !== 0) {
                    if (levels && levels.length > 0) {
                        const baseIdx = findNearestLevelIndex(levels, baseVal);
                        const nextIdx = Math.max(0, Math.min(levels.length - 1, baseIdx + shift));
                        nextVal = levels[nextIdx];
                    } else if (Number.isFinite(range.step) && range.step > 0) {
                        nextVal = baseVal + shift * range.step;
                    } else {
                        nextVal = baseVal + shift * (span * 0.025);
                    }
                }
                normVec[d] = span > 0 ? (nextVal - range.min) / span : 0;
            }

            if (isCenter) continue;
            const q = quantizeCandidate(normVec);
            if (q && q.key !== centerQ.key) neighbors.push(q);
        }
        return neighbors;
    };

    // Автоматическая оценка шага дискретизации каждой оси в нормализованных координатах [0, 1]
    const minAxisScales = new Float64Array(numParams);
    const isCoarseAxis = new Uint8Array(numParams);

    for (let d = 0; d < numParams; d++) {
        const key = paramKeys[d];
        const range = config[key];
        const span = range.max - range.min;

        if (span <= 0) {
            minAxisScales[d] = 0.25;
            isCoarseAxis[d] = 0;
            continue;
        }

        const levels = discreteLevels[d];
        let normStep = 0;

        if (levels && levels.length > 1) {
            normStep = 1 / (levels.length - 1);
        } else if (Number.isFinite(range.step) && range.step > 0) {
            normStep = range.step / span;
        }

        // Ось считается грубо-ступенчатой, если в диапазоне меньше ~65 ступенек (шаг > 0.015)
        isCoarseAxis[d] = normStep > 0.015 ? 1 : 0;
        // Запрещаем масштабу ядра сжиматься меньше 2.2 шагов дискретизации
        minAxisScales[d] = normStep > 0 ? Math.min(0.65, normStep * 2.2) : 0.08;
    }

    const normalizeParamObject = pObj => {
        if (
            !pObj ||
            typeof pObj !== "object" ||
            Array.isArray(pObj)
        ) {
            return null;
        }
        const normX = new Float64Array(numParams);
        for (let i = 0; i < numParams; i++) {
            const key = paramKeys[i];
            const value = pObj[key];
            const range = config[key];
            if (!Number.isFinite(value)) return null;
            normX[i] = range.max !== range.min
                ? Math.max(
                    0,
                    Math.min(
                        1,
                        (value - range.min) /
                        (range.max - range.min)
                    )
                )
                : 0;
        }
        const canonicalX = canonicalizeNormalized(normX);
        const physical = toPhysical(canonicalX);
        if (!isValidPhysical(physical)) return null;
        return canonicalX;
    };
    const evaluatedKeys = state?.evaluatedKeys instanceof Set
        ? state.evaluatedKeys
        : new Set(Array.isArray(state?.evaluatedKeys) ? state.evaluatedKeys : []);

    // Адаптеры границ для изолированного генератора Соболя
    const globalBounds = paramKeys.map((key, d) => {
        const range = config[key];
        const levels = discreteLevels[d];
        if (levels && levels.length > 0) {
            return { levels, min: range.min, max: range.max };
        }
        if (Number.isFinite(range.step) && range.step > 0) {
            return { min: range.min, max: range.max, step: range.step };
        }
        return { min: range.min, max: range.max };
    });

    const buildRegionBounds = (region) => {
        const regionScales = globalGPState.loadLengthScales;
        return paramKeys.map((key, d) => {
            const range = config[key];
            const span = range.max - range.min;
            const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
            const halfW = region.radius * scale;
            const minPhys = range.min + Math.max(0, region.bestX[d] - halfW) * span;
            const maxPhys = range.min + Math.min(1, region.bestX[d] + halfW) * span;

            const levels = discreteLevels[d];
            if (levels && levels.length > 0) {
                return { levels, min: minPhys, max: maxPhys };
            }
            if (Number.isFinite(range.step) && range.step > 0) {
                return { min: minPhys, max: maxPhys, step: range.step };
            }
            return { min: minPhys, max: maxPhys };
        });
    };

    const toCandidateFromSobolPoint = (pt) => {
        const physical = {};
        for (let d = 0; d < numParams; d++) {
            physical[paramKeys[d]] = pt.values[d];
        }
        const normX = normalizeParamObject(physical);
        return normX ? quantizeCandidate(normX) : null;
    };

    const globalSobolState = {
        drawsCount: state?.sobolDraws || 0,
        digitalShift: null
    };
// -----------------------------------------------------------------------
// 7.4. СОСТОЯНИЕ ПОИСКА, ГЕНЕРАЦИЯ ТОЧЕК И СЧЁТЧИКИ
// -----------------------------------------------------------------------
    const generateRandomPoint = (seenKeys = null) => {
        const { points } = generateDiscreteSobolPoints({
            count: 1,
            bounds: globalBounds,
            sobolState: globalSobolState,
            seenKeys
        });
        return points.length > 0 ? toCandidateFromSobolPoint(points[0]) : null;
    };
    const observedX = Array.isArray(state?.observedX)
        ? state.observedX.map(pt => pt instanceof Float64Array ? pt : new Float64Array(Object.values(pt)))
        : [];
    const observedLoad = state?.observedLoad || [];
    const observedLogLoad = state?.observedLogLoad || [];
    const observedLoadNoise = state?.observedLoadNoise || [];
// Динамические массивы по числу ограничений: observedLogConstraints[k][i]
    const observedLogConstraints = state?.observedLogConstraints || [];
    const observedConstraintNoise = state?.observedConstraintNoise || [];
    const constraintLimitsGP = state?.constraintLimitsGP || [];
    const constraintNames = state?.constraintNames || [];
    const observedAllFeasible = state?.observedAllFeasible || [];
    const observedRegionIds = state?.observedRegionIds || [];
    const observedIsComplete = state?.observedIsComplete || [];
    const residualPairsByConstraint = Array.isArray(state?.residualPairsByConstraint)
        ? state.residualPairsByConstraint
        : (Array.isArray(state?.residualPairs) ? [state.residualPairs] : []);
    const MAX_RESIDUAL_PAIRS = 45;
    const MIN_ABORT_TRAINING_PROGRESS = 5;
    const MAX_ABORT_PROGRESS_PERCENT = 50;
    let goalDirection = state?.goalDirection || task.goal || "min";
    const isMaximize = () => goalDirection === "max";
    const isBetterVal = (a, b) => (isMaximize() ? a > b : a < b);
    let objectiveShift = state?.objectiveShift ?? 0;
    const ensurePositiveObjective = (val) => {
        if (!Number.isFinite(val)) return;
        if (val + objectiveShift < 0) {
            const newShift = Math.abs(val) + 10;
            for (let i = 0; i < observedLoad.length; i++) {
                observedLogLoad[i] = Math.log1p(Math.max(0, observedLoad[i] + newShift));
            }
            objectiveShift = newShift;
            globalGPState.loadLengthScales = null;
        }
    };
    let gBestMetrics = state?.gBestMetrics || null;
    let gBestPhysical = state?.gBestPhysical || null;
    let gBestLoad = state?.gBestLoad ?? (isMaximize() ? -Infinity : Infinity);
    let gBestConstraints = state?.gBestConstraints || null;
    let fallbackMetrics = state?.fallbackMetrics || null;
    let fallbackPhysical = state?.fallbackPhysical || null;
    let fallbackLoad = state?.fallbackLoad ?? (isMaximize() ? -Infinity : Infinity);
    let fallbackConstraints = state?.fallbackConstraints || null;
    let fallbackViolation = state?.fallbackViolation ?? Infinity;
    let fallbackObjective = state?.fallbackObjective ?? (isMaximize() ? -Infinity : Infinity);
    let bestBoundaryX = state?.bestBoundaryX
        ? (state.bestBoundaryX instanceof Float64Array ? state.bestBoundaryX : new Float64Array(Object.values(state.bestBoundaryX)))
        : null;
    let bestBoundaryObjective = state?.bestBoundaryObjective ?? (isMaximize() ? -Infinity : Infinity);

    let pendingDecision = null;
// -----------------------------------------------------------------------
// 7.5. ЛОГИРОВАНИЕ, ДИАГНОСТИКА И ОБРАТНАЯ СВЯЗЬ С UI
// -----------------------------------------------------------------------
    const formatLogValues = (value, key = null) => {
        if (typeof value === "number") {
            if (!Number.isFinite(value)) return null;
            if (key === "linearResidual" || (value !== 0 && Math.abs(value) < 1e-6)) {
                return value;
            }
            const step = config[key]?.step;
            const digits = Number.isFinite(step) && step > 0
                ? Math.min(4, getStepPrecision(step))
                : 3;
            const rounded = Number(value.toFixed(digits));
            return Object.is(rounded, -0) ? 0 : rounded;
        }
        if (Array.isArray(value)) {
            return value.map(item => formatLogValues(item));
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(([childKey, item]) => [
                    childKey,
                    formatLogValues(item, childKey)
                ])
            );
        }
        return value;
    };
    const diag = createDiagnosticLogger();
    const emitStepLog = record => {
        try {
            diag.log(formatLogValues(record));
        } catch (e) {
            console.error("Optimizer log serialization failed:", e);
        }
    };
    const emitStructuredLog = (stepMode, message, snapshot) => {
        if (typeof self.optimizerStructuredLogger !== "function") {
            return;
        }
        try {
            self.optimizerStructuredLogger(
                stepMode,
                message,
                JSON.parse(JSON.stringify(formatLogValues(snapshot)))
            );
        } catch (e) {
            console.error("Structured logger failed:", e);
        }
    };
    const notifyProgress = (
        percent,
        technicalMetrics,
        message = null
    ) => {
        if (typeof options.onProgress !== "function") {
            return;
        }
        const snapshot = buildSimulationSnapshot(
            currentExecutionCount,
            "RUNNING",
            percent,
            self.currentStepPhysicalParams,
            technicalMetrics,
            message
        );
        try {
            options.onProgress(
                snapshot.percent,
                currentExecutionCount,
                totalIterations,
                snapshot
            );
        } catch (e) {
            console.error("Optimizer progress callback failed:", e);
        }
    };
// -----------------------------------------------------------------------
// 7.6. ЦЕЛЕВАЯ ФУНКЦИЯ И СНИМОК СОСТОЯНИЯ
// -----------------------------------------------------------------------
    const getObjectiveValue = (load) => load;
    function buildSimulationSnapshot(
        stepVisual,
        status,
        percent,
        currentParams,
        technicalMetrics,
        message = null
    ) {
        return {
            currentStepVisual: stepVisual,
            status,
            percent: Number(percent),
            candidateParams: currentParams ? { ...currentParams } : null,
            technicalMetrics: technicalMetrics || null,
            message,
            bestStepNumber: ["SUCCESS", "WARN"].includes(status)
                ? self.lastEvaluatedBestStepNumber
                : null
        };
    }

    // -----------------------------------------------------------------------
    // 7.7. TRUST REGIONS: ПРИОРИТЕТ, ПРИВЯЗКА ТОЧЕК И ОБНОВЛЕНИЕ РЕГИОНОВ
    // -----------------------------------------------------------------------

    const isGlobalLeaderRegion = region =>
        Boolean(gBestMetrics) &&
        region.bestViolation === 0 &&
        Math.abs(region.bestObjective - getObjectiveValue(gBestLoad)) <= 1e-6;

    if (state && searchRegions.length > 0) {
        for (const reg of searchRegions) {
            if (!reg.active) continue;
            if (isGlobalLeaderRegion(reg) || reg.radius <= 0.03) {
                reg.radius = Math.max(reg.radius, 0.075);
                reg.failures = Math.floor(reg.failures / 2);
                reg.lastImprovementStep = currentExecutionCount;
            }
        }
    }

    const getRegionPriority = region => {
        const successRate = (region.improvements + 1) / (region.attempts + 2);
        const explorationValue = Math.sqrt(region.radius / 0.15);
        const failurePenalty = Math.pow(0.85, region.failures);
        const idleSteps = Math.max(0, currentExecutionCount - region.lastImprovementStep);
        const idlePenalty = idleSteps > 12 ? Math.pow(0.96, idleSteps - 12) : 1.0;
        const noveltyBonus = 1.0 + 0.8 / Math.sqrt(Math.max(1, region.attempts));

        const basePriority = successRate * explorationValue * failurePenalty * idlePenalty * noveltyBonus;

        if (isGlobalLeaderRegion(region)) {
            const leaderFloor = (region.radius <= minRegionRadius * 1.1 && idleSteps >= 25) ? 0.06 : 0.25;
            return Math.max(leaderFloor, basePriority);
        }

        return basePriority;
    };

    const updateTrustRegions = (
        normX,
        load,
        violation,
        outcomeStatus,
        isGlobalCandidate = false,
        sourceRegionId = -1
    ) => {
        if (outcomeStatus === "ERROR") return;

        let associatedRegion = null;

        if (Number.isInteger(sourceRegionId) && sourceRegionId >= 0) {
            const originRegion = searchRegions.find(r => r.id === sourceRegionId && r.active);
            if (originRegion) {
                associatedRegion = originRegion;
            }
        }

        if (!associatedRegion) {
            const currentScales = globalGPState.loadLengthScales || new Float64Array(numParams).fill(0.55);
            let minDistance = Infinity;

            for (const region of searchRegions) {
                if (!region.active) continue;

                const dist = calculateKernelDistance(
                    normX,
                    region.center,
                    currentScales
                );

                const regionThreshold = Math.max(0.04, region.radius * 1.5);

                if (dist < regionThreshold && dist < minDistance) {
                    minDistance = dist;
                    associatedRegion = region;
                }
            }
        }

        const handleRegionFailure = region => {
            region.failures++;
            region.rawDirection = null;

            if (region.failures % 3 === 0) {
                region.radius = Math.max(minRegionRadius, region.radius * 0.72);
            }

            if (region.failures >= 25) {
                if (isGlobalLeaderRegion(region)) {
                    region.failures = 0;
                    region.radius = 0.03;
                } else {
                    region.active = false;
                }
            }
        };

        if (outcomeStatus === "ABORT") {
            if (associatedRegion) {
                associatedRegion.attempts++;
                handleRegionFailure(associatedRegion);
            }
            return;
        }

        if (!Number.isFinite(load) || !Number.isFinite(violation)) return;

        const currentObjective = getObjectiveValue(load);

        if (associatedRegion) {
            associatedRegion.attempts++;
            associatedRegion.completeObservationsCount =
                (associatedRegion.completeObservationsCount ?? 0) + 1;

            const isImprovement =
                violation < associatedRegion.bestViolation ||
                (violation === associatedRegion.bestViolation && isBetterVal(currentObjective, associatedRegion.bestObjective));

            if (isImprovement) {
                const prevBest = associatedRegion.bestX.slice();
                associatedRegion.previousBestX = prevBest;

                const rawDelta = new Float64Array(numParams);
                let hasMovement = false;
                for (let d = 0; d < numParams; d++) {
                    rawDelta[d] = normX[d] - prevBest[d];
                    if (Math.abs(rawDelta[d]) > 1e-12) hasMovement = true;
                }
                if (hasMovement) {
                    associatedRegion.rawDirection = rawDelta;
                }

                associatedRegion.bestX = new Float64Array(normX);
                associatedRegion.center = new Float64Array(normX);
                associatedRegion.sobolState = {
                    drawsCount: 0,
                    digitalShift: createDigitalShift()
                };
                associatedRegion.bestLoad = load;
                associatedRegion.bestObjective = currentObjective;
                associatedRegion.bestViolation = violation;
                associatedRegion.improvements++;
                associatedRegion.failures = 0;
                associatedRegion.lastImprovementStep = currentExecutionCount;
                associatedRegion.radius = Math.min(0.25, associatedRegion.radius * 1.12);

                const currentScales = globalGPState.loadLengthScales || new Float64Array(numParams).fill(0.55);

                for (const other of searchRegions) {
                    if (!other.active || other.id === associatedRegion.id) continue;

                    const distBetween = calculateKernelDistance(
                        associatedRegion.center,
                        other.center,
                        currentScales
                    );

                    const mergeThreshold = Math.max(
                        0.035,
                        Math.min(associatedRegion.radius, other.radius) * 0.9
                    );

                    if (distBetween < mergeThreshold) {
                        const otherIsBetter =
                            other.bestViolation < associatedRegion.bestViolation ||
                            (other.bestViolation === associatedRegion.bestViolation &&
                                isBetterVal(other.bestObjective, associatedRegion.bestObjective));

                        if (otherIsBetter) {
                            associatedRegion.active = false;
                        } else {
                            other.active = false;
                        }
                        break;
                    }
                }
            } else {
                handleRegionFailure(associatedRegion);
            }
            return;
        }

        const initialRegionRadius = 0.22 / Math.sqrt(numParams);

        const createNewRegionObject = id => attachRegionSobol({
            id,
            center: new Float64Array(normX),
            bestX: new Float64Array(normX),
            previousBestX: null,
            rawDirection: null,
            bestLoad: load,
            bestObjective: currentObjective,
            bestViolation: violation,
            radius: initialRegionRadius,
            attempts: 1,
            improvements: 1,
            failures: 0,
            lastImprovementStep: currentExecutionCount,
            active: true,
            completeObservationsCount: outcomeStatus === "SUCCESS" ? 1 : 0,
            lastScaleOptimizationCount: -Infinity,
            loadLengthScales: globalGPState.loadLengthScales
                ? new Float64Array(globalGPState.loadLengthScales)
                : null,
            constraintLengthScales: globalGPState.constraintLengthScales.map(s => (s ? new Float64Array(s) : null)),
            regionalModels: null,
            localTrainingStats: null
        });

        const inactiveIndex = searchRegions.findIndex(r => !r.active);
        if (inactiveIndex >= 0) {
            searchRegions[inactiveIndex] = createNewRegionObject(searchRegions[inactiveIndex].id);
            return;
        }

        const maxTrustRegions = Math.min(6, Math.max(2, numParams + 2));
        if (searchRegions.length < maxTrustRegions) {
            const nextId = searchRegions.length ? Math.max(...searchRegions.map(r => r.id)) + 1 : 0;
            searchRegions.push(createNewRegionObject(nextId));
            return;
        }

        let weakestIndex = -1;
        let lowestScore = Infinity;

        for (let i = 0; i < searchRegions.length; i++) {
            const reg = searchRegions[i];
            if (isGlobalLeaderRegion(reg)) continue;

            const idleSteps = currentExecutionCount - reg.lastImprovementStep;
            if (reg.attempts < 3 && idleSteps < 20) continue;

            const effectiveScore = getRegionPriority(reg);

            if (effectiveScore < lowestScore) {
                lowestScore = effectiveScore;
                weakestIndex = i;
            }
        }

        if (weakestIndex >= 0) {
            const weakest = searchRegions[weakestIndex];
            const idleSteps = currentExecutionCount - weakest.lastImprovementStep;

            const isStrictlyBetter =
                violation < weakest.bestViolation ||
                (violation === weakest.bestViolation && isBetterVal(currentObjective, weakest.bestObjective));

            const isIdleOrStagnant =
                idleSteps >= 25 ||
                (isGlobalCandidate && lowestScore < 0.12 && idleSteps >= 8);

            if (isStrictlyBetter || isIdleOrStagnant) {
                searchRegions[weakestIndex] = createNewRegionObject(weakest.id);
            }
        }
    };

    // -----------------------------------------------------------------------
    // 7.8. ВЫПОЛНЕНИЕ ОДНОЙ СИМУЛЯЦИИ И РЕГИСТРАЦИЯ НАБЛЮДЕНИЯ
    // -----------------------------------------------------------------------

    const evaluate = (
        paramsObj,
        normX,
        customTag = null
    ) => {
        const q = quantizeCandidate(normX);
        if (!q) return null;
        normX = q.x;
        paramsObj = q.physical;
        const physicalKey = q.key;
        if (evaluatedKeys.has(physicalKey)) {
            return null;
        }
        evaluatedKeys.add(physicalKey);
        currentExecutionCount++;
        let recordedAbortProgress = null;
        const decision = pendingDecision;
        pendingDecision = null;
        self.currentRunningStepNumber = currentExecutionCount;
        self.currentStepPhysicalParams = paramsObj;
        self.currentStepCustomTag = customTag;
        const stepType = customTag
            ? (customTag.startsWith("PRESET_") ? "PRESET" : customTag.startsWith("RANDOM_INIT_") ? "RANDOM_INIT" : customTag.startsWith("FALLBACK_") ? "FALLBACK_INIT" : "INIT")
            : (decision?.method || "BAYES_OPTIMIZATION");
        const progressHistory = [];
        const MAX_HISTORY = 10;
        const MIN_HISTORY = 6;
        const MIN_PREDICTION_PROGRESS = 15;
        const REQUIRED_PREDICTED_ABORTS = 3;
        let predictedAbortCount = 0;
        let lastProgress = -1;
        const preparedParams = applyParamsByPath(baseParams, paramsObj);
        const hasEarlyAbort = Boolean(task.earlyAbort && typeof task.earlyAbort.metric === "function");
        const absoluteCeiling = hasEarlyAbort ? task.earlyAbort.ceiling : Infinity;
        const massiveLoadLimit = absoluteCeiling * 3;
        const simArgs = {
            ...preparedParams,
            onProgress: (percent, technicalMetrics) => {
                if (
                    !Number.isFinite(percent) ||
                    percent < 0 ||
                    percent > 100 ||
                    !technicalMetrics
                ) {
                    return false;
                }
                const isNewProgressStep = percent > lastProgress;
                if (!hasEarlyAbort) {
                    if (isNewProgressStep) lastProgress = percent;
                    notifyProgress(percent, technicalMetrics);
                    return false;
                }
                const rawCurrentLoad = task.earlyAbort.metric(
                    percent,
                    technicalMetrics,
                    preparedParams
                );
                const currentLoad =
                    Number.isFinite(rawCurrentLoad) && rawCurrentLoad >= 0
                        ? rawCurrentLoad
                        : 0;
                const lastSample = progressHistory[progressHistory.length - 1];
                if (isNewProgressStep) {
                    progressHistory.push({ percent, load: currentLoad });
                    lastProgress = percent;
                    if (progressHistory.length > MAX_HISTORY) progressHistory.shift();
                } else if (percent === lastProgress && lastSample) {
                    lastSample.load = currentLoad;
                }
                let predictedFinalLoad = null;
                if (
                    percent >= MIN_PREDICTION_PROGRESS &&
                    progressHistory.length >= MIN_HISTORY
                ) {
                    const n = progressHistory.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    for (const point of progressHistory) {
                        sumX += point.percent;
                        sumY += point.load;
                        sumXY += point.percent * point.load;
                        sumXX += point.percent * point.percent;
                    }
                    const denominator = n * sumXX - sumX * sumX;
                    if (Number.isFinite(denominator) && denominator > 0) {
                        const slope = (n * sumXY - sumX * sumY) / denominator;
                        if (Number.isFinite(slope)) {
                            const prediction = currentLoad + Math.max(0, slope) * (100 - percent);
                            if (Number.isFinite(prediction)) {
                                predictedFinalLoad = Math.max(currentLoad, prediction);
                            }
                        }
                    }
                }
                const requestAbort = abortInfo => {
                    recordedAbortProgress = abortInfo;
                    notifyProgress(percent, technicalMetrics, abortInfo.reason);
                    return true;
                };
                if (percent < 10 && currentLoad > massiveLoadLimit) {
                    return requestAbort({
                        reason: "MASSIVE_INITIAL_METRIC",
                        percent,
                        currentLoad,
                        predictedFinalLoad,
                        absoluteCeiling
                    });
                }
                if (percent <= MAX_ABORT_PROGRESS_PERCENT && currentLoad >= absoluteCeiling) {
                    return requestAbort({
                        reason: "ABSOLUTE_CEILING_LIMIT",
                        percent,
                        currentLoad,
                        predictedFinalLoad,
                        absoluteCeiling
                    });
                }
                if (percent <= MAX_ABORT_PROGRESS_PERCENT && predictedFinalLoad !== null) {
                    if (isNewProgressStep) {
                        if (predictedFinalLoad > absoluteCeiling) predictedAbortCount++;
                        else predictedAbortCount = 0;
                    }
                    if (predictedAbortCount >= REQUIRED_PREDICTED_ABORTS) {
                        return requestAbort({
                            reason: "PREDICTED_METRIC_EXCEEDS_CEILING",
                            percent,
                            currentLoad,
                            predictedFinalLoad: Math.round(predictedFinalLoad),
                            absoluteCeiling,
                            predictedAbortCount
                        });
                    }
                } else {
                    predictedAbortCount = 0;
                }
                notifyProgress(percent, technicalMetrics);
                return false;
            },
            simulation: {
                ...preparedParams.simulation,
                stopAtMaxTemperature: false
            }
        };
        let res;
        try {
            res = simulateFn(simArgs);
        } catch (e) {
            const message = e?.message || String(e);

            const errorSnapshot = buildSimulationSnapshot(
                currentExecutionCount,
                "ERROR",
                lastProgress >= 0 ? lastProgress : 0,
                paramsObj,
                null,
                message
            );

            emitStructuredLog(
                "BAYES",
                `Exception: ${message}`,
                errorSnapshot
            );

            return null;
        }

        if (!res || !res.technicalMetrics) {
            const returnedStatus = typeof res?.status?.type === "string"
                ? res.status.type.trim().toLowerCase()
                : null;
            const wasAborted = returnedStatus === "abort" || Boolean(recordedAbortProgress);
            const finalStatus = wasAborted ? "ABORT" : "ERROR";
            const finalMessage = wasAborted
                ? recordedAbortProgress?.reason || "ABORT_WITHOUT_METRICS"
                : "MISSING_TECHNICAL_METRICS";
            const invalidSnapshot = buildSimulationSnapshot(
                currentExecutionCount,
                finalStatus,
                wasAborted
                    ? (recordedAbortProgress?.percent ?? Math.max(0, lastProgress))
                    : Math.max(0, lastProgress),
                paramsObj,
                null,
                finalMessage
            );
            emitStructuredLog(stepType, finalMessage, invalidSnapshot);
            if (wasAborted) {
                updateTrustRegions(
                    normX,
                    NaN,
                    Infinity,
                    "ABORT",
                    Boolean(decision?.isGlobalExploration),
                    decision?.sourceDiagnostics?.regionId ?? -1
                );
            }
            return null;
        }
        const statusTypeRaw = res.status?.type;
        const statusType = typeof statusTypeRaw === "string"
            ? statusTypeRaw.trim().toLowerCase()
            : null;
        const isAborted = statusType === "abort" || Boolean(recordedAbortProgress);
        const metrics = res.technicalMetrics;
        const evalOut = task.evaluateResult(res, preparedParams, createProfileContext(res));
        if (evalOut?.objective?.goal && evalOut.objective.goal !== goalDirection) {
            goalDirection = evalOut.objective.goal;
            if (!gBestMetrics) {
                gBestLoad = isMaximize() ? -Infinity : Infinity;
            }
            if (!fallbackMetrics) {
                fallbackLoad = isMaximize() ? -Infinity : Infinity;
                fallbackObjective = isMaximize() ? -Infinity : Infinity;
            }
        }
        const load = evalOut?.objective?.value;
        const rawConstraints = Array.isArray(evalOut?.constraints) ? evalOut.constraints : [];
        const normalizedConstraints = rawConstraints.map(normalizeSingleConstraint);
        let totalViolation = 0;
        let allConstraintsFeasible = true;
        for (const c of normalizedConstraints) {
            totalViolation = Math.max(totalViolation, c.violation);
            if (!c.feasible) allConstraintsFeasible = false;
        }
        const abortProgress = recordedAbortProgress?.percent;
        emitStepLog({
            stepNumber: currentExecutionCount,
            statusType,
            value: Number.isFinite(load) ? load : null,
            violation: Number.isFinite(totalViolation) ? totalViolation : null
        });
        const abortCurrentLoad = recordedAbortProgress?.currentLoad;
        const abortPredictedLoad = recordedAbortProgress?.predictedFinalLoad;
        const allConstraintsFinite = normalizedConstraints.every(c => Number.isFinite(c.gpVal) && c.gpVal >= 0);
        const isUsableAbortObservation =
            isAborted &&
            recordedAbortProgress &&
            Number.isFinite(abortProgress) &&
            abortProgress >= MIN_ABORT_TRAINING_PROGRESS &&
            abortProgress <= MAX_ABORT_PROGRESS_PERCENT &&
            Number.isFinite(abortCurrentLoad) &&
            abortCurrentLoad >= 0 &&
            allConstraintsFinite;
        if (isUsableAbortObservation) {
            while (observedLogConstraints.length < normalizedConstraints.length) {
                const idx = observedLogConstraints.length;

                observedLogConstraints.push([]);
                observedConstraintNoise.push([]);
                constraintLimitsGP.push(normalizedConstraints[idx].gpLimit);
                constraintNames.push(rawConstraints[idx]?.name || `c_${idx}`);
            }
            const hasPredictedLoad =
                Number.isFinite(abortPredictedLoad) &&
                abortPredictedLoad >= abortCurrentLoad;
            let abortExtrapolated = hasPredictedLoad ? abortPredictedLoad : abortCurrentLoad;
            if (abortProgress < MAX_ABORT_PROGRESS_PERCENT) {
                const penaltyFactor = 1 + (1 - abortProgress / MAX_ABORT_PROGRESS_PERCENT) * 0.5;
                abortExtrapolated *= penaltyFactor;
            }
            const progressRatio = Math.max(0, Math.min(1,
                (abortProgress - MIN_ABORT_TRAINING_PROGRESS) /
                (MAX_ABORT_PROGRESS_PERCENT - MIN_ABORT_TRAINING_PROGRESS)
            ));
            const loadNoise = 0.02 - 0.0199 * progressRatio;
            const cNoise = 0.01 - 0.0099 * progressRatio;
// Если цель совпадает с метрикой earlyAbort (например, cpuLoad), пишем экстраполяцию; иначе текущее value
            const objTrainingVal = (Number.isFinite(load) && Math.abs(load - abortCurrentLoad) <= 1)
                ? abortExtrapolated
                : (Number.isFinite(load) ? load : abortExtrapolated);
            ensurePositiveObjective(objTrainingVal);
            observedX.push(new Float64Array(normX));
            observedLoad.push(objTrainingVal);
            observedLogLoad.push(Math.log1p(Math.max(0, objTrainingVal + objectiveShift)));
            observedLoadNoise.push(loadNoise);
            for (let k = 0; k < normalizedConstraints.length; k++) {
                const rawVal = rawConstraints[k]?.value;
// Если k-й компас отслеживает ту же метрику, что вызвала ABORT (cpuLoad), подставляем экстраполированную величину!
                if (Number.isFinite(rawVal) && Math.abs(rawVal - abortCurrentLoad) <= 1) {
                    const extrapC = normalizeSingleConstraint({ ...rawConstraints[k], value: abortExtrapolated });
                    observedLogConstraints[k].push(Math.log1p(extrapC.gpVal));
                } else {
                    observedLogConstraints[k].push(Math.log1p(normalizedConstraints[k].gpVal));
                }
                observedConstraintNoise[k].push(cNoise);
                constraintLimitsGP[k] = normalizedConstraints[k].gpLimit;
            }
            observedAllFeasible.push(false);
            observedIsComplete.push(false);
            observedRegionIds.push(decision?.sourceDiagnostics?.regionId ?? -1);
        }
        const isError =
            statusType === "error" ||
            !Number.isFinite(load) ||
            !allConstraintsFinite;
        const isValidObservation =
            !isAborted &&
            !isError &&
            Number.isFinite(load) &&
            allConstraintsFinite;
        const isInitialPoint = customTag && (
            customTag.startsWith("PRESET_") ||
            customTag.startsWith("RANDOM_INIT_") ||
            customTag.startsWith("INIT")
        );
        if (!isInitialPoint) {
            const acc = metrics?.accuracy;
            const timeErr = acc?.timeIntegrationErrorC;
            const gridItemErr = acc?.spatialGridErrorC;
            const picardErr = Number.isFinite(acc?.picardConvergenceErrorC)
                ? Math.abs(acc.picardConvergenceErrorC)
                : NaN;

            emitStepLog({
                type: "SIMULATION_EVALUATION",
                stepNumber: currentExecutionCount,
                customTag,
                statusType,
                status: isAborted ? "ABORT" : (isError ? "ERROR" : "SUCCESS"),
                isValidObservation,
                observedMetrics: {
                    value: Number.isFinite(load) ? load : null,
                    violation: Number.isFinite(totalViolation) ? totalViolation : null,
                    constraints: normalizedConstraints.map((c, idx) => ({
                        name: rawConstraints[idx]?.name || `c_${idx}`,
                        value: Number.isFinite(rawConstraints[idx]?.value) ? rawConstraints[idx].value : null,
                        violation: Number.isFinite(c.violation) ? c.violation : null,
                        feasible: c.feasible
                    })),
                    timeErr: Number.isFinite(timeErr) ? timeErr : null,
                    gridItemErr: Number.isFinite(gridItemErr) ? gridItemErr : null,
                    picardErr: Number.isFinite(picardErr) ? picardErr : null,
                    linearResidual: Number.isFinite(acc?.linearResidual) ? acc.linearResidual : null,
                    abortProgress: abortProgress ?? null
                }
            });
        }
        if (isValidObservation) {
            while (observedLogConstraints.length < normalizedConstraints.length) {
                const idx = observedLogConstraints.length;
                observedLogConstraints.push([]);
                observedConstraintNoise.push([]);
                constraintLimitsGP.push(normalizedConstraints[idx].gpLimit);
                constraintNames.push(rawConstraints[idx]?.name || `c_${idx}`); // <-- Добавлены кавычки ` `
            }
            ensurePositiveObjective(load);
            const predicted = decision?.predictionForResidual;
            if (
                predicted &&
                Number.isFinite(predicted.loadMeanLog) &&
                Number.isFinite(predicted.loadSigmaLog) &&
                predicted.loadSigmaLog > 0 &&
                Array.isArray(predicted.constraints)
            ) {
                const shiftedLogLoad = Math.log1p(Math.max(0, load + objectiveShift));
                const loadResidual = (shiftedLogLoad - predicted.loadMeanLog) / Math.max(1e-9, predicted.loadSigmaLog);
                if (Number.isFinite(loadResidual)) {
                    const clampedLoadRes = Math.max(-5, Math.min(5, loadResidual));
                    if (normalizedConstraints.length === 0) {
                        if (!residualPairsByConstraint[0]) {
                            residualPairsByConstraint[0] = [];
                        }
                        residualPairsByConstraint[0].push({
                            load: clampedLoadRes,
                            error: 0
                        });
                        if (residualPairsByConstraint[0].length > MAX_RESIDUAL_PAIRS) {
                            residualPairsByConstraint[0].shift();
                        }
                    } else {
                        for (let k = 0; k < normalizedConstraints.length; k++) {
                            while (residualPairsByConstraint.length <= k) {
                                residualPairsByConstraint.push([]);
                            }
                            const cPred = predicted.constraints[k];
                            if (cPred && Number.isFinite(cPred.meanLog) && Number.isFinite(cPred.sigmaLog) && cPred.sigmaLog > 0) {
                                const errorResidual = (Math.log1p(normalizedConstraints[k].gpVal) - cPred.meanLog) / Math.max(1e-9, cPred.sigmaLog);
                                if (Number.isFinite(errorResidual)) {
                                    residualPairsByConstraint[k].push({
                                        load: clampedLoadRes,
                                        error: Math.max(-5, Math.min(5, errorResidual))
                                    });
                                    if (residualPairsByConstraint[k].length > MAX_RESIDUAL_PAIRS) {
                                        residualPairsByConstraint[k].shift();
                                    }
                                }
                            }
                        }
                    }
                }
            }
            observedX.push(new Float64Array(normX));
            observedLoad.push(load);
            observedLogLoad.push(Math.log1p(Math.max(0, load + objectiveShift)));
            observedLoadNoise.push(0);
            for (let k = 0; k < normalizedConstraints.length; k++) {
                observedLogConstraints[k].push(Math.log1p(normalizedConstraints[k].gpVal));
                observedConstraintNoise[k].push(0);
                constraintLimitsGP[k] = normalizedConstraints[k].gpLimit;
            }
            observedAllFeasible.push(allConstraintsFeasible);
            observedIsComplete.push(true);
            observedRegionIds.push(decision?.sourceDiagnostics?.regionId ?? -1);
            const currentConstraintsSummary = normalizedConstraints.map((c, idx) => ({
                name: rawConstraints[idx]?.name || `c_${idx}`,
                value: Number.isFinite(rawConstraints[idx]?.value) ? rawConstraints[idx].value : null,
                min: Number.isFinite(rawConstraints[idx]?.min) ? rawConstraints[idx].min : null,
                max: Number.isFinite(rawConstraints[idx]?.max) ? rawConstraints[idx].max : null,
                violation: Number.isFinite(c.violation) ? c.violation : null,
                feasible: c.feasible
            }));

            const currentObjective = getObjectiveValue(load);
            if (allConstraintsFeasible) {
                const previousObjective = gBestMetrics
                    ? getObjectiveValue(gBestLoad)
                    : (isMaximize() ? -Infinity : Infinity);
                if (!gBestMetrics || isBetterVal(currentObjective, previousObjective)) {
                    gBestMetrics = metrics;
                    gBestPhysical = paramsObj;
                    gBestLoad = load;
                    gBestConstraints = currentConstraintsSummary;
                    self.lastEvaluatedBestParams = paramsObj;
                    self.lastEvaluatedBestMetrics = metrics;
                    self.lastEvaluatedBestStepNumber = currentExecutionCount;
                }
            }
            if (
                !fallbackMetrics ||
                totalViolation < fallbackViolation ||
                (totalViolation === fallbackViolation && isBetterVal(currentObjective, fallbackObjective))
            ) {
                fallbackViolation = totalViolation;
                fallbackObjective = currentObjective;
                fallbackMetrics = metrics;
                fallbackPhysical = paramsObj;
                fallbackLoad = load;
                fallbackConstraints = currentConstraintsSummary;
            }
            if (
                !allConstraintsFeasible &&
                totalViolation <= 0.05 &&
                (!bestBoundaryX || isBetterVal(currentObjective, bestBoundaryObjective))
            ) {
                bestBoundaryX = new Float64Array(normX);
                bestBoundaryObjective = currentObjective;
            }
        }
        const stepMode = customTag
            ? (customTag.startsWith("PRESET_") ? customTag : stepType)
            : "BAYES";
        let finalStatus = "SUCCESS";
        if (isAborted) finalStatus = "ABORT";
        else if (isError) finalStatus = "ERROR";
        else if (statusType === "warning" || statusType === "warn") finalStatus = "WARN";
        const finalPercent = isAborted
            ? (Number.isFinite(abortProgress) ? abortProgress : Math.max(0, lastProgress))
            : 100;
        const stepEvaluationSummary = {
            objective: {
                value: Number.isFinite(load) ? load : null,
                goal: goalDirection,
                unit: evalOut?.objective?.unit || task.unit || ""
            },
            constraints: normalizedConstraints.map((c, idx) => ({
                name: rawConstraints[idx]?.name || `c_${idx}`,
                value: Number.isFinite(rawConstraints[idx]?.value) ? rawConstraints[idx].value : null,
                min: Number.isFinite(rawConstraints[idx]?.min) ? rawConstraints[idx].min : null,
                max: Number.isFinite(rawConstraints[idx]?.max) ? rawConstraints[idx].max : null,
                feasible: c.feasible
            }))
        };

        const finalSnapshot = {
            ...buildSimulationSnapshot(
                currentExecutionCount,
                finalStatus,
                finalPercent,
                paramsObj,
                metrics,
                recordedAbortProgress?.reason || null
            ),
            evaluationSummary: stepEvaluationSummary
        };

        emitStructuredLog(stepMode, res.status?.message || "Simulation completed", finalSnapshot);
        const outcomeStatus = isValidObservation ? "SUCCESS" : (isAborted ? "ABORT" : "ERROR");
        updateTrustRegions(
            normX,
            load,
            totalViolation,
            outcomeStatus,
            Boolean(decision?.isGlobalExploration),
            decision?.sourceDiagnostics?.regionId ?? -1
        );
        return isValidObservation
            ? { load, violation: totalViolation, feasible: allConstraintsFeasible }
            : null;
    };
// -----------------------------------------------------------------------
// 7.9. НАЧАЛЬНОЕ НАПОЛНЕНИЕ ВЫБОРКИ
// -----------------------------------------------------------------------
    if (!state) {
        const initBatch = generateDiscreteSobolPoints({
            count: initPointsCount,
            bounds: globalBounds,
            sobolState: globalSobolState,
            seenKeys: evaluatedKeys
        });

        for (const pt of initBatch.points) {
            if (currentExecutionCount >= initPointsCount) break;
            await new Promise(resolve => setTimeout(resolve, 0));
            if (typeof options.shouldStop === "function" && options.shouldStop()) {
                break;
            }
            const candidate = toCandidateFromSobolPoint(pt);
            if (!candidate) continue;
            evaluate(
                candidate.physical,
                candidate.x,
                "RANDOM_INIT_" + currentExecutionCount
            );
        }

        if (currentExecutionCount === 0) {
            throw new Error(
                "Не удалось сформировать ни одной допустимой начальной точки."
            );
        }
    }
// -----------------------------------------------------------------------
// 7.10. ОСНОВНОЙ ЦИКЛ BAYESIAN OPTIMIZATION
// -----------------------------------------------------------------------
    let bayesianDecisionCount = 0;
    let consecutiveMatrixFailures = 0;
    let stepsWithoutGlobalImprovement = 0;
    let lowEIConsecutiveCount = 0;
    const minStepsBeforeEarlyStop = Math.min(
        Math.floor(extraIterations * 0.45),
        initPointsCount + Math.max(6, numParams * 8)
    );
    const latticeCount = Math.pow(3, numParams) - 1;
    const basePatience = Math.max(8, Math.min(28, Math.round(latticeCount * 0.85) + numParams * 2));
    const earlyStopPatience = Math.min(
        Math.floor(extraIterations * 0.30),
        basePatience
    );
    while (currentExecutionCount < totalIterations) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (typeof options.shouldStop === "function" && options.shouldStop()) {
            break;
        }
        bayesianDecisionCount++;
        const N = observedX.length;
        if (N === 0) break;
        if (typeof options.onProgress === "function") {
            const nextStepNum = currentExecutionCount + 1;
            options.onProgress(0, nextStepNum, totalIterations, {
                currentStepVisual: nextStepNum,
                status: "THINKING",
                percent: 0,
                candidateParams: null,
                technicalMetrics: null,
                message: "Fitting Gaussian Processes & evaluating candidates..."
            });
        }
// 7.10.1. АДАПТАЦИЯ ПРОГРЕССА И ПЕРИОДИЧНОСТИ ПЕРЕОБУЧЕНИЯ
        const progressFactor = Math.min(1.0, currentExecutionCount / Math.max(1, totalIterations));
        const activeRegionsForSchedule = searchRegions.filter(r => r.active);
        const minActiveRadius = activeRegionsForSchedule.length > 0
            ? Math.min(...activeRegionsForSchedule.map(r => r.radius))
            : 0.15;
        let reoptimizeInterval = 10;
        if (minActiveRadius <= 0.02) reoptimizeInterval = 4;
        else if (minActiveRadius <= 0.05) reoptimizeInterval = 6;
        else if (minActiveRadius <= 0.15) reoptimizeInterval = 8;

        const currentCompleteCount = observedIsComplete.filter(Boolean).length;
        const numConstraints = observedLogConstraints.length;
        if (
            !globalGPState.loadLengthScales ||
            currentCompleteCount - globalGPState.lastLoadScaleCompleteCount >= reoptimizeInterval
        ) {
            globalGPState.loadLengthScales = optimizeLengthScales(
                observedX,
                observedLogLoad,
                observedLoadNoise,
                numParams,
                progressFactor,
                observedIsComplete,
                globalGPState.loadLengthScales,
                minAxisScales,
                isCoarseAxis
            );
            globalGPState.lastLoadScaleCompleteCount = currentCompleteCount;
        }
// Обучение масштабов для каждого компаса (с ленивым пропуском для "спящих" компасов)
        for (let k = 0; k < numConstraints; k++) {
            const lastCount = globalGPState.lastConstraintScaleCompleteCount[k] ?? -Infinity;
            if (!globalGPState.constraintLengthScales[k] || currentCompleteCount - lastCount >= reoptimizeInterval) {
                globalGPState.constraintLengthScales[k] = optimizeLengthScales(
                    observedX,
                    observedLogConstraints[k],
                    observedConstraintNoise[k],
                    numParams,
                    progressFactor,
                    observedIsComplete,
                    globalGPState.constraintLengthScales[k] || null,
                    minAxisScales,
                    isCoarseAxis
                );
                globalGPState.lastConstraintScaleCompleteCount[k] = currentCompleteCount;
            }
        }
// 7.10.2. ОБУЧЕНИЕ ГЛОБАЛЬНЫХ GP-МОДЕЛЕЙ (ЦЕЛЬ + ВСЕ КОМПАСЫ)
        const loadGP = fitGaussianProcess(
            observedX,
            observedLogLoad,
            observedLoadNoise,
            globalGPState.loadLengthScales,
            observedIsComplete,
            isCoarseAxis
        );
        const globalConstraintModels = [];
        let allConstraintsGPValid = true;
        for (let k = 0; k < numConstraints; k++) {
            const cGP = fitGaussianProcess(
                observedX,
                observedLogConstraints[k],
                observedConstraintNoise[k],
                globalGPState.constraintLengthScales[k],
                observedIsComplete,
                isCoarseAxis
            );
            if (!cGP?.valid) {
                allConstraintsGPValid = false;
                break;
            }
            globalConstraintModels.push(cGP);
        }
        if (!loadGP?.valid || !allConstraintsGPValid) {
            consecutiveMatrixFailures++;
            const fallback = generateRandomPoint(evaluatedKeys, 300);
            if (!fallback || consecutiveMatrixFailures >= 3) break;
            pendingDecision = {
                method: "RANDOM_FALLBACK",
                reason: "GP_FIT_FAILED",
                trainingCount: N
            };
            evaluate(fallback.physical, fallback.x, "FALLBACK_GP_FAILED");
            continue;
        }
        consecutiveMatrixFailures = 0;
        const hasFeasibleResult = Boolean(gBestMetrics);
        const bestObjectiveShifted = hasFeasibleResult
            ? Math.max(0, getObjectiveValue(gBestLoad) + objectiveShift)
            : (isMaximize() ? -Infinity : Infinity);
        const candidates = [];
        const candidateSources = [];
// 7.10.4. ФОРМИРОВАНИЕ ПУЛА ГЛОБАЛЬНЫХ И ЛОКАЛЬНЫХ КАНДИДАТОВ
        const basePool = 350 + numParams * 150 + numParams * numParams * 80;
        const maxPool = 750 + numParams * 250 + numParams * numParams * 110;

        const totalPoolTarget = Math.min(maxPool, basePool + currentExecutionCount * (numParams + 2));
        const hasActiveRegions = searchRegions.some(r => r.active);
        const candidatesCount = hasActiveRegions
            ? Math.round(totalPoolTarget * 0.35)
            : totalPoolTarget;
        const localExplorers = hasActiveRegions
            ? Math.round(totalPoolTarget * 0.65)
            : 0;
        let randomCandidatesGenerated = 0;
        let randomCandidatesRejected = 0;
        let localCandidatesGenerated = 0;
        let localCandidatesRejected = 0;
        const seenCandidateKeys = new Set(evaluatedKeys);
        const primaryPairs = residualPairsByConstraint[0] || [];
        self.lastEMAStorage.load = estimateResidualSigmaScale(primaryPairs, "load", observedX, self.lastEMAStorage.load, progressFactor);
        const loadSigmaCalibration = self.lastEMAStorage.load;

        const constraintCorrelations = [];
        const constraintSigmaCalibrations = [];
        for (let k = 0; k < numConstraints; k++) {
            const pairsK = residualPairsByConstraint[k] || [];
            constraintCorrelations[k] = estimateResidualCorrelation(pairsK);
            const prevScaleK = self.lastEMAStorage.errors[k] ?? 1.0;
            const newScaleK = estimateResidualSigmaScale(pairsK, "error", observedX, prevScaleK, progressFactor);
            self.lastEMAStorage.errors[k] = newScaleK;
            constraintSigmaCalibrations[k] = newScaleK;
        }

        const globalBatch = generateDiscreteSobolPoints({
            count: candidatesCount,
            bounds: globalBounds,
            sobolState: globalSobolState,
            seenKeys: seenCandidateKeys
        });

        for (const pt of globalBatch.points) {
            const q = toCandidateFromSobolPoint(pt);
            if (!q || seenCandidateKeys.has(q.key)) {
                randomCandidatesRejected++;
                continue;
            }
            const x = q.x;
            let isTooClose = false;
            for (let i = 0; i < observedX.length; i++) {
                let distSq = 0;
                for (let d = 0; d < numParams; d++) {
                    const diff = x[d] - observedX[i][d];
                    distSq += diff * diff;
                }
                if (distSq / numParams < 1e-8) {
                    isTooClose = true;
                    break;
                }
            }
            if (isTooClose) {
                randomCandidatesRejected++;
                continue;
            }
            seenCandidateKeys.add(q.key);
            candidates.push(x);
            candidateSources.push({ type: "GLOBAL", regionId: -1 });
            randomCandidatesGenerated++;
        }

        localCandidatesGenerated = 0;
        let localAttempts = 0;
        const maxLocalAttempts = localExplorers * 5;
        const activeRegions = searchRegions.filter(r => r.active);
        const regionConsecutiveMisses = new Map(activeRegions.map(r => [r.id, 0]));
        const sobolExhaustedIds = new Set();
        const dirExhaustedIds = new Set();
        const MAX_MISSES_PER_REGION = Math.min(60, Math.max(16, numParams * 8 + 2));
        const buildRegionWeights = (excludedSet) => {
            let total = 0;
            const list = [];
            for (const reg of activeRegions) {
                if (excludedSet.has(reg.id)) continue;
                const score = getRegionPriority(reg);
                total += score;
                list.push({ reg, score });
            }
            return { list, total };
        };
        let { list: regionWeights, total: totalRegionScore } = buildRegionWeights(sobolExhaustedIds);

        // 1. Гарантированно добавляем непроверенных дискретных соседей глобального лидера (gBestPhysical)
        if (gBestPhysical) {
            const leaderNormX = normalizeParamObject(gBestPhysical);
            if (leaderNormX) {
                const leaderRegion = activeRegions.find(r => isGlobalLeaderRegion(r));
                const leaderRegionId = leaderRegion ? leaderRegion.id : -1;
                const leaderLattice = generateLatticeNeighbors(leaderNormX);

                for (const q of leaderLattice) {
                    if (!seenCandidateKeys.has(q.key)) {
                        candidates.push(q.x);
                        candidateSources.push({ type: "LOCAL_LATTICE", regionId: leaderRegionId });
                        seenCandidateKeys.add(q.key);
                        localCandidatesGenerated++;
                    }
                }
            }
        }

        // 2. Добавляем дискретных соседей для остальных активных регионов
        for (const reg of activeRegions) {
            const latticeNeighbors = generateLatticeNeighbors(reg.bestX);
            for (const q of latticeNeighbors) {
                if (!seenCandidateKeys.has(q.key)) {
                    candidates.push(q.x);
                    candidateSources.push({ type: "LOCAL_LATTICE", regionId: reg.id });
                    seenCandidateKeys.add(q.key);
                    localCandidatesGenerated++;
                }
            }
        }

        // 2.1. Добавляем соседей лучшей пограничной точки, если её цель превосходит текущий допустимый рекорд
        if (bestBoundaryX && (!hasFeasibleResult || isBetterVal(bestBoundaryObjective, getObjectiveValue(gBestLoad)))) {
            const boundaryNeighbors = generateLatticeNeighbors(bestBoundaryX);
            for (const q of boundaryNeighbors) {
                if (!seenCandidateKeys.has(q.key)) {
                    candidates.push(q.x);
                    candidateSources.push({ type: "LOCAL_LATTICE", regionId: -1 });
                    seenCandidateKeys.add(q.key);
                    localCandidatesGenerated++;
                }
            }
        }

        // 3. Пакетная генерация локального Соболя с перераспределением квоты исчерпанных регионов
        let sobolTargetTotal = localCandidatesGenerated + Math.round(
            Math.max(0, localExplorers - localCandidatesGenerated) * 0.65
        );
        if (!activeRegions.some(reg => Boolean(reg.rawDirection))) {
            sobolTargetTotal = localExplorers;
        }

        let batchRounds = 0;
        while (localCandidatesGenerated < sobolTargetTotal && regionWeights.length > 0 && batchRounds < 4) {
            batchRounds++;
            const needed = sobolTargetTotal - localCandidatesGenerated;
            let generatedInRound = 0;

            for (const item of regionWeights) {
                const reg = item.reg;
                const share = totalRegionScore > 0
                    ? needed * (item.score / totalRegionScore)
                    : needed / regionWeights.length;
                const quota = Math.max(1, Math.ceil(share));

                localAttempts++;
                const localBatch = generateDiscreteSobolPoints({
                    count: quota,
                    bounds: buildRegionBounds(reg),
                    sobolState: reg.sobolState,
                    seenKeys: seenCandidateKeys
                });

                for (const pt of localBatch.points) {
                    if (localCandidatesGenerated >= sobolTargetTotal) break;
                    const q = toCandidateFromSobolPoint(pt);
                    if (q && !seenCandidateKeys.has(q.key)) {
                        seenCandidateKeys.add(q.key);
                        candidates.push(q.x);
                        candidateSources.push({ type: "LOCAL", regionId: reg.id });
                        localCandidatesGenerated++;
                        generatedInRound++;
                    }
                }

                if (localBatch.exhausted) {
                    sobolExhaustedIds.add(reg.id);
                }
            }

            ({ list: regionWeights, total: totalRegionScore } = buildRegionWeights(sobolExhaustedIds));
            if (generatedInRound === 0) break;
        }

        // 4. Остаток локального бюджета добираем направленными шагами (только для регионов с rawDirection)
        const buildDirectionalWeights = () => {
            const { list: activeDirPool } = buildRegionWeights(dirExhaustedIds);
            let total = 0;
            const list = [];
            for (const item of activeDirPool) {
                if (!item.reg.rawDirection) continue;
                total += item.score;
                list.push(item);
            }
            return { list, total };
        };
        let { list: dirWeights, total: totalDirScore } = buildDirectionalWeights();

        while (
            localCandidatesGenerated < localExplorers &&
            localAttempts < maxLocalAttempts &&
            dirWeights.length > 0
            ) {
            localAttempts++;
            let region = null;
            if (totalDirScore > 0) {
                let rouletteSlot = nextRandom() * totalDirScore;
                for (const item of dirWeights) {
                    rouletteSlot -= item.score;
                    if (rouletteSlot <= 0) { region = item.reg; break; }
                }
            }
            if (!region) {
                region = dirWeights[(localAttempts - 1) % dirWeights.length].reg;
            }

            // Направленный шаг вдоль вектора улучшения (LOCAL_DIRECTIONAL)
            const basePoint = region.bestX;
            const basePhysical = toPhysical(basePoint);
            const mutatedX = new Float64Array(numParams);
            const regionScales = globalGPState.loadLengthScales;

            const scaledDir = new Float64Array(numParams);
            let normSq = 0;
            for (let d = 0; d < numParams; d++) {
                const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
                const sDiff = region.rawDirection[d] / scale;
                scaledDir[d] = sDiff;
                normSq += sDiff * sDiff;
            }
            const rmsNormSq = normSq / numParams;
            if (rmsNormSq <= 1e-12) {
                region.rawDirection = null;
                continue;
            }
            const invRmsNorm = 1 / Math.sqrt(rmsNormSq);
            const dirStepRatio = region.radius * (0.12 + 0.38 * nextRandom());

            const deltaIndices = new Int32Array(numParams);
            const baseIndices = new Int32Array(numParams);
            const continuousShifts = new Float64Array(numParams);
            let hasDiscreteShift = false;

            for (let d = 0; d < numParams; d++) {
                const levels = discreteLevels[d];
                const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));

                if (levels && levels.length > 1) {
                    const maxIdx = levels.length - 1;
                    const baseIdx = findNearestLevelIndex(levels, basePhysical[paramKeys[d]]);
                    baseIndices[d] = baseIdx;

                    const rawShift = (scaledDir[d] * invRmsNorm) * dirStepRatio * scale * maxIdx;
                    continuousShifts[d] = rawShift;
                    const stepIdx = Math.round(rawShift);

                    const clampedIdx = Math.max(0, Math.min(maxIdx, baseIdx + stepIdx));
                    deltaIndices[d] = clampedIdx - baseIdx;
                    if (deltaIndices[d] !== 0) hasDiscreteShift = true;
                } else {
                    const offset = (scaledDir[d] * invRmsNorm) * dirStepRatio * scale;
                    mutatedX[d] = Math.max(0, Math.min(1, basePoint[d] + offset));
                }
            }

            if (!hasDiscreteShift) {
                const movableAxes = [];
                for (let d = 0; d < numParams; d++) {
                    if (discreteLevels[d] && discreteLevels[d].length > 1) movableAxes.push(d);
                }
                if (movableAxes.length > 0) {
                    let chosenAxis = movableAxes[0];
                    let preferredSign = 1;
                    let maxAbs = -1;
                    for (const d of movableAxes) {
                        if (Math.abs(continuousShifts[d]) > maxAbs) {
                            maxAbs = Math.abs(continuousShifts[d]);
                            chosenAxis = d;
                            preferredSign = continuousShifts[d] >= 0 ? 1 : -1;
                        }
                    }
                    const maxIdx = discreteLevels[chosenAxis].length - 1;
                    const baseIdx = baseIndices[chosenAxis];
                    let targetIdx = baseIdx + preferredSign;
                    if (targetIdx < 0 || targetIdx > maxIdx) targetIdx = baseIdx - preferredSign;
                    deltaIndices[chosenAxis] = Math.max(0, Math.min(maxIdx, targetIdx)) - baseIdx;
                }
            }

            for (let d = 0; d < numParams; d++) {
                const levels = discreteLevels[d];
                if (levels && levels.length > 1) {
                    const key = paramKeys[d];
                    const range = config[key];
                    const span = range.max - range.min;
                    const physVal = levels[baseIndices[d] + deltaIndices[d]];
                    mutatedX[d] = span > 0 ? (physVal - range.min) / span : 0;
                }
            }

            const q = quantizeCandidate(mutatedX);
            if (q && !seenCandidateKeys.has(q.key)) {
                candidates.push(q.x);
                candidateSources.push({ type: "LOCAL_DIRECTIONAL", regionId: region.id });
                seenCandidateKeys.add(q.key);
                localCandidatesGenerated++;
                regionConsecutiveMisses.set(region.id, 0);
            } else {
                localCandidatesRejected++;
                const misses = (regionConsecutiveMisses.get(region.id) || 0) + 1;
                regionConsecutiveMisses.set(region.id, misses);
                if (misses >= MAX_MISSES_PER_REGION) {
                    dirExhaustedIds.add(region.id);
                    ({ list: dirWeights, total: totalDirScore } = buildDirectionalWeights());
                }
            }
        }
// 7.10.5. ОЦЕНКА КАНДИДАТОВ И ACQUISITION FUNCTION
        let bestAcquisition = -Infinity;
        let nextBestX = null;
        let bestCandidateStats = null;
        let selectedIndexInPool = -1;
        let invalidPredictionCount = 0;
        let zeroSigmaCount = 0;
        let nonFiniteEICount = 0;
        let bestFeasibilityX = null;
        let bestFeasibilityStats = null;
        let bestFeasibilityScore = -Infinity;
        let bestFeasibilitySelectedScore = -Infinity;
        let selectedFeasibilityIndexInPool = -1;
        let globalFeasibilityIdx = -1;
        let bestGlobalFeasScore = -Infinity;
        let bestGlobalPred = null;
        const FEASIBILITY_TIE_EPSILON = 1e-9;
        const evaluateCandidatePredictions = (candX) => {
            const rawLoadPred = predictGaussianProcess(loadGP, candX);
            if (!rawLoadPred) return null;
            const loadPrediction = applySigmaCalibration(rawLoadPred, loadSigmaCalibration);
            const constraintPreds = [];
            const probs = [];
            for (let k = 0; k < numConstraints; k++) {
                const rawCPred = predictGaussianProcess(globalConstraintModels[k], candX);
                if (!rawCPred) return null;
                const scaleK = constraintSigmaCalibrations[k] ?? 1.0;
                const cPred = applySigmaCalibration(rawCPred, scaleK);
                constraintPreds.push(cPred);
                probs.push(probabilityBelow(cPred, constraintLimitsGP[k]));
            }
            let pFeasible = 1.0;
            if (numConstraints > 0) {
                pFeasible = probs.reduce((acc, v) => acc * v, 1.0);
            }
            return {
                loadPrediction,
                constraintPreds,
                probs,
                pFeasible
            };
        };
        for (let c = 0; c < candidates.length; c++) {
            const candX = candidates[c];
            const candSource = candidateSources[c];
            const evalPred = evaluateCandidatePredictions(candX);
            if (!evalPred) {
                invalidPredictionCount++;
                continue;
            }
            const { loadPrediction, constraintPreds, pFeasible } = evalPred;
            const sigmaObjective = loadPrediction.sigmaLog;
            const feasibilityScore = pFeasible;
            bestFeasibilityScore = Math.max(bestFeasibilityScore, feasibilityScore);

            // Кэшируем лучшего глобального кандидата для режима разведки (без повторного вызова GP)
            if (candSource?.type === "GLOBAL" && pFeasible >= 0.25) {
                const normObj = loadPrediction.meanLog;
                const feasBonus = pFeasible >= 0.5 ? (1.0 - Math.abs(pFeasible - 0.65)) : pFeasible;
                const exploreScore = feasBonus + 0.05 * Math.min(2.0, loadPrediction.sigmaLog) - 0.02 * normObj;
                if (exploreScore > bestGlobalFeasScore) {
                    bestGlobalFeasScore = exploreScore;
                    globalFeasibilityIdx = c;
                    bestGlobalPred = evalPred;
                }
            }
            const SAFE_FEASIBILITY_THRESHOLD = 0.45;
            const isCandSafe = feasibilityScore >= SAFE_FEASIBILITY_THRESHOLD;
            const isBestSafe = bestFeasibilitySelectedScore >= SAFE_FEASIBILITY_THRESHOLD;
            const candMetric = (Math.exp(loadPrediction.meanLog) - 1) - objectiveShift;
            const bestMetric = bestFeasibilityStats
                ? ((Math.exp(bestFeasibilityStats.loadPrediction.meanLog) - 1) - objectiveShift)
                : (isMaximize() ? -Infinity : Infinity);
            const isFirstCandidate = (bestFeasibilityX === null);
            const isStrictlyBetterFeasibility = (feasibilityScore > bestFeasibilitySelectedScore + FEASIBILITY_TIE_EPSILON);
            const isFeasibilityTie = Math.abs(feasibilityScore - bestFeasibilitySelectedScore) <= FEASIBILITY_TIE_EPSILON;
            let betterFeasibility = false;
            if (isFirstCandidate) {
                betterFeasibility = true;
            } else if (isCandSafe && isBestSafe) {
                betterFeasibility = isBetterVal(candMetric, bestMetric);
            } else if (isCandSafe !== isBestSafe) {
                betterFeasibility = isCandSafe;
            } else {
                betterFeasibility = isStrictlyBetterFeasibility || (isFeasibilityTie && isBetterVal(candMetric, bestMetric));
            }
            if (betterFeasibility) {
                bestFeasibilitySelectedScore = feasibilityScore;
                bestFeasibilityX = candX;
                selectedFeasibilityIndexInPool = c;
                bestFeasibilityStats = {
                    loadPrediction,
                    allConstraintPredictions: constraintPreds,
                    pFeasible,
                    ei: null,
                    acquisition: pFeasible,
                    sigmaObjective
                };
            }
            if (sigmaObjective <= 1e-9) {
                zeroSigmaCount++;
            }
            if (hasFeasibleResult) {
                const activeCondParams = [];
                let staticFeasibleProb = 1.0;

                for (let k = 0; k < numConstraints; k++) {
                    const cPred = constraintPreds[k];
                    const probK = evalPred.probs[k];

                    if (probK >= 0.999999) continue;

                    const corrInfo = constraintCorrelations[k];
                    const isSelfObjectiveConstraint =
                        !isMaximize() &&
                        corrInfo &&
                        corrInfo.samples >= 12 &&
                        corrInfo.rawRho > 0.92;

                    if (isSelfObjectiveConstraint) continue;

                    if (!cPred || cPred.sigmaLog <= 1e-9) {
                        staticFeasibleProb *= probK;
                        continue;
                    }

                    const rho = Math.max(-0.8, Math.min(0.8, corrInfo?.rho || 0));
                    const condSigma = Math.sqrt(Math.max(1e-12, 1 - rho * rho));
                    const limZ = (Math.log1p(constraintLimitsGP[k]) - cPred.meanLog) / cPred.sigmaLog;

                    activeCondParams.push({ limZ, rho, condSigma });
                }

                const condProbFn = (z) => {
                    if (staticFeasibleProb === 0) return 0;
                    let prob = staticFeasibleProb;
                    for (let i = 0; i < activeCondParams.length; i++) {
                        const p = activeCondParams[i];
                        prob *= normalCDF((p.limZ - p.rho * z) / p.condSigma);
                    }
                    return prob;
                };

                const ei = calculateConstrainedLogNormalEI(
                    bestObjectiveShifted,
                    loadPrediction,
                    condProbFn,
                    isMaximize()
                );

                if (!Number.isFinite(ei)) {
                    nonFiniteEICount++;
                    continue;
                }

                const invScales = new Float64Array(numParams);
                for (let d = 0; d < numParams; d++) {
                    const s = Number.isFinite(globalGPState.loadLengthScales[d]) && globalGPState.loadLengthScales[d] > 0
                        ? globalGPState.loadLengthScales[d]
                        : 0.55;
                    invScales[d] = 1 / s;
                }
                const crowdingThresholdSq = 0.0064 * numParams; // (0.08)^2 * numParams
                const invNumParams = 1 / numParams;
                let crowding = 0;

                for (let i = 0; i < observedX.length; i++) {
                    const obsPt = observedX[i];
                    let sumSq = 0;
                    for (let d = 0; d < numParams; d++) {
                        const diff = (candX[d] - obsPt[d]) * invScales[d];
                        sumSq += diff * diff;
                    }
                    if (sumSq < crowdingThresholdSq) {
                        const dKernel = Math.sqrt(sumSq * invNumParams);
                        crowding += (1.0 - dKernel * 12.5) * 0.12;
                    }
                }

                const clampedPenalty = Math.min(0.35, crowding);

                const balancedAcquisition = ei * (1.0 - clampedPenalty);
                if (balancedAcquisition > bestAcquisition) {
                    bestAcquisition = balancedAcquisition;
                    nextBestX = candX;
                    selectedIndexInPool = c;
                    bestCandidateStats = {
                        loadPrediction,
                        allConstraintPredictions: constraintPreds,
                        pFeasible,
                        ei,
                        acquisition: balancedAcquisition,
                        sigmaObjective
                    };
                }
            } else {
                const explorationBonus = 1e-4 * Math.min(10, sigmaObjective);
                const acquisition = pFeasible + explorationBonus;
                if (acquisition > bestAcquisition) {
                    bestAcquisition = acquisition;
                    nextBestX = candX;
                    selectedIndexInPool = c;
                    bestCandidateStats = {
                        loadPrediction,
                        allConstraintPredictions: constraintPreds,
                        pFeasible,
                        ei: null,
                        acquisition,
                        sigmaObjective
                    };
                }
            }
        }
// 7.10.6. ВЫБОР РЕЖИМА: УЛУЧШЕНИЕ ИЛИ ИССЛЕДОВАНИЕ ДОПУСТИМОЙ ОБЛАСТИ
        let selectionMethod = hasFeasibleResult
            ? "CONSTRAINED_EXPECTED_IMPROVEMENT"
            : "FEASIBILITY_SEARCH";
        let selectionFallbackReason = null;
        const bestPoolAcquisition = bestAcquisition;
        const MIN_SIGNIFICANT_EI = 1e-6;
        if (hasFeasibleResult && bestFeasibilityX) {
            const selectedFeasibility = bestCandidateStats?.pFeasible ?? 0;
            const dynamicFeasibilityInterval = Math.min(20, Math.floor(14 + (currentExecutionCount / 20)));
            const periodicExploration = bayesianDecisionCount % dynamicFeasibilityInterval === 0;
            const candidateSourceType = selectedIndexInPool >= 0
                ? candidateSources[selectedIndexInPool]?.type
                : null;
            const isLocalCandidate =
                candidateSourceType === "LOCAL" ||
                candidateSourceType === "LOCAL_DIRECTIONAL" ||
                candidateSourceType === "LOCAL_LATTICE";
            const minFeasibilityFloor = isLocalCandidate ? 0.0005 : 0.15;
            const hasMeaningfulEI = bestAcquisition >= 5e-4;
            const lowFeasibility =
                !hasMeaningfulEI &&
                selectedFeasibility < minFeasibilityFloor &&
                bestFeasibilityScore - selectedFeasibility >= 0.25;
            const noPositiveEI = bestAcquisition < MIN_SIGNIFICANT_EI;
            if (periodicExploration || lowFeasibility || noPositiveEI) {
                if ((noPositiveEI || periodicExploration) && globalFeasibilityIdx >= 0 && bestGlobalPred) {
                    nextBestX = candidates[globalFeasibilityIdx];
                    selectedIndexInPool = globalFeasibilityIdx;
                    bestAcquisition = bestGlobalPred.pFeasible;
                    bestCandidateStats = {
                        loadPrediction: bestGlobalPred.loadPrediction,
                        allConstraintPredictions: bestGlobalPred.constraintPreds,
                        pFeasible: bestGlobalPred.pFeasible,
                        ei: null,
                        acquisition: bestGlobalPred.pFeasible,
                        sigmaObjective: bestGlobalPred.loadPrediction.sigmaLog
                    };
                } else {
                    nextBestX = bestFeasibilityX;
                    bestCandidateStats = bestFeasibilityStats;
                    bestAcquisition = bestFeasibilitySelectedScore;
                    selectedIndexInPool = selectedFeasibilityIndexInPool;
                }
                selectionMethod = "FEASIBILITY_EXPLORATION";
                selectionFallbackReason = noPositiveEI
                    ? "NON_POSITIVE_CONSTRAINED_EI"
                    : periodicExploration
                        ? "PERIODIC_EXPLORATION"
                        : "LOW_SELECTED_FEASIBILITY";
            }
        }
        if (!nextBestX) {
            selectionMethod = "RANDOM_FALLBACK";
            selectionFallbackReason = "NO_VALID_CANDIDATE";
            const fallback = generateRandomPoint(evaluatedKeys, 500);
            if (!fallback) break;
            nextBestX = fallback.x;
            bestCandidateStats = null;
            selectedIndexInPool = -1;
        }
        const chosenSource = selectedIndexInPool >= 0
            ? candidateSources[selectedIndexInPool]
            : { type: "FALLBACK", regionId: -1 };
        const resolvedSelectedPhysical = quantizeCandidate(nextBestX)?.physical || toPhysical(nextBestX);
// 7.10.7. ФИКСАЦИЯ РЕШЕНИЯ И ДИАГНОСТИКА
        const stats = bestCandidateStats;
        const completeObservationCount = observedIsComplete.filter(Boolean).length;
        const abortObservationCount = observedIsComplete.length - completeObservationCount;
        pendingDecision = {
            method: selectionMethod,
            fallbackReason: selectionFallbackReason,
            objective: goalDirection,
            sourceDiagnostics: chosenSource,
            isGlobalExploration: chosenSource.type === "GLOBAL",
            training: {
                observations: N,
                completeObservations: completeObservationCount,
                abortObservations: abortObservationCount,
                feasibleObservations: observedAllFeasible.filter(Boolean).length,
                excludedFromElite: abortObservationCount,
                hasFeasibleResult
            },
            gaussianProcess: {
                kernel: "Matern5/2",
                objective: {
                    lengthScales: Array.from(loadGP.lengthScales),
                    yMean: loadGP.yMean,
                    yStd: loadGP.yStd,
                    jitter: loadGP.jitter,
                    jitterRetries: loadGP.jitterRetries
                },
                constraints: globalConstraintModels.map((cGP, idx) => ({
                    name: constraintNames[idx] || `c_${idx}`,
                    lengthScales: Array.from(cGP.lengthScales),
                    yMean: cGP.yMean,
                    yStd: cGP.yStd,
                    jitter: cGP.jitter,
                    jitterRetries: cGP.jitterRetries
                }))
            },
            candidates: {
                requestedRandom: candidatesCount,
                generatedRandom: randomCandidatesGenerated,
                rejectedRandom: randomCandidatesRejected,
                requestedLocal: localExplorers,
                generatedLocal: localCandidatesGenerated,
                rejectedLocal: localCandidatesRejected,
                localAttempts,
                total: candidates.length,
                invalidPredictionCount,
                zeroSigmaCount,
                nonFiniteEICount
            },
            constraintsDiagnostics: constraintNames.map((name, idx) => ({
                name,
                rho: constraintCorrelations[idx]?.rho ?? 0,
                rawRho: constraintCorrelations[idx]?.rawRho ?? 0,
                samples: constraintCorrelations[idx]?.samples ?? 0,
                sigmaCalibration: constraintSigmaCalibrations[idx] ?? 1.0
            })),
            sigmaCalibration: {
                objective: loadSigmaCalibration,
                constraints: constraintSigmaCalibrations,
                samples: primaryPairs.length
            },
            predictionForResidual: stats
                ? {
                    loadMeanLog: stats.loadPrediction.meanLog,
                    loadSigmaLog: stats.loadPrediction.rawSigmaLog,
                    constraints: (stats.allConstraintPredictions || []).map(c => ({
                        meanLog: c?.meanLog ?? NaN,
                        sigmaLog: c?.rawSigmaLog ?? NaN
                    }))
                }
                : null,
            prediction: stats
                ? {
                    objective: {
                        meanLog: stats.loadPrediction.meanLog,
                        sigmaLog: stats.loadPrediction.sigmaLog,
                        predictedMean: (Math.exp(stats.loadPrediction.meanLog) - 1) - objectiveShift
                    },
                    constraints: (stats.allConstraintPredictions || []).map((cPred, idx) => ({
                        name: constraintNames[idx] || `c_${idx}`,
                        meanLog: cPred?.meanLog ?? null,
                        sigmaLog: cPred?.sigmaLog ?? null,
                        predictedMean: cPred ? (Math.exp(cPred.meanLog) - 1) : null,
                        pFeasible: cPred ? probabilityBelow(cPred, constraintLimitsGP[idx]) : null
                    })),
                    pFeasible: stats.pFeasible,
                    eiObjective: stats.ei,
                    acquisition: stats.acquisition,
                    goal: goalDirection
                }
                : null,
            selectedCandidate: {
                normalized: Array.from(nextBestX),
                physical: resolvedSelectedPhysical,
                acquisition: stats?.acquisition ?? null
            }
        };
        const stepCountSnapshot = currentExecutionCount;
        emitStepLog({
            type: "CANDIDATE_SELECTION_EVALUATION",
            stepNumber: currentExecutionCount + 1,
            selectionMethod,
            fallbackReason: selectionFallbackReason,
            candidatesEvaluated: candidates.length,
            bestAcquisitionScore: bestAcquisition,
            bestFeasibilityScore,
            chosenSource: chosenSource.type,
            chosenRegionId: chosenSource.regionId,
            poolDiagnostics: {
                totalCandidatesInPool: candidates.length,
                randomGenerated: randomCandidatesGenerated,
                randomRejected: randomCandidatesRejected,
                localGenerated: localCandidatesGenerated,
                localRejected: localCandidatesRejected,
                localAttemptsUsed: localAttempts
            },
            constraintsCalibration: constraintNames.map((name, idx) => ({
                name,
                rho: constraintCorrelations[idx]?.rho ?? 0,
                rawRho: constraintCorrelations[idx]?.rawRho ?? 0,
                samples: constraintCorrelations[idx]?.samples ?? 0,
                sigmaScale: constraintSigmaCalibrations[idx] ?? 1.0
            })),
            objectiveSigmaCalibration: loadSigmaCalibration,
            metricsCounter: {
                invalidPredictions: invalidPredictionCount,
                zeroSigma: zeroSigmaCount,
                nonFiniteEI: nonFiniteEICount
            },
            selectedCandidatePrediction: stats
                ? {
                    predictedValue: (Math.exp(stats.loadPrediction.meanLog) - 1) - objectiveShift,
                    predictedConstraints: (stats.allConstraintPredictions || []).map((cPred, idx) => ({
                        name: constraintNames[idx] || `c_${idx}`,
                        predictedValue: cPred ? (Math.exp(cPred.meanLog) - 1) : null,
                        sigmaLog: cPred?.sigmaLog ?? null,
                        pFeasible: cPred ? probabilityBelow(cPred, constraintLimitsGP[idx]) : null
                    })),
                    jointFeasibility: stats.pFeasible,
                    expectedImprovement: stats.ei
                }
                : "No predictions available (Random Fallback)",
            selectedParams: resolvedSelectedPhysical,
            regionsDiagnostics: activeRegions.map(reg => ({
                id: reg.id,
                priority: getRegionPriority(reg),
                radius: reg.radius,
                attempts: reg.attempts,
                improvements: reg.improvements,
                failures: reg.failures,
                idleSteps: stepCountSnapshot - reg.lastImprovementStep
            }))
        });
        const stepBeforeEval = self.lastEvaluatedBestStepNumber;
        evaluate(resolvedSelectedPhysical, nextBestX);
// 7.10.8. КОНТРОЛЬ СХОДИМОСТИ И УСЛОВИЯ ДОСРОЧНОЙ ОСТАНОВКИ
        if (self.lastEvaluatedBestStepNumber && self.lastEvaluatedBestStepNumber > (stepBeforeEval || 0)) {
            stepsWithoutGlobalImprovement = 0;
        } else {
            stepsWithoutGlobalImprovement++;
        }
        const stagnationRatio = Math.min(
            1.0,
            stepsWithoutGlobalImprovement / Math.max(1, earlyStopPatience)
        );
        const EI_EXHAUSTION_THRESHOLD =
            0.0005 + 0.0015 * Math.max(progressFactor, stagnationRatio);
        if (Number.isFinite(bestPoolAcquisition) && bestPoolAcquisition < EI_EXHAUSTION_THRESHOLD) {
            lowEIConsecutiveCount++;
        } else {
            lowEIConsecutiveCount = 0;
        }
        const leaderNeighbors = gBestPhysical ? generateLatticeNeighbors(normalizeParamObject(gBestPhysical)) : [];
        const allLeaderNeighborsEvaluated =
            leaderNeighbors.length > 0 &&
            leaderNeighbors.every(q => evaluatedKeys.has(q.key));
        const hasOtherActiveRegions = searchRegions.some(
            r => r.active &&
                !isGlobalLeaderRegion(r) &&
                (r.attempts < 6 || r.radius > minRegionRadius * 1.5) &&
                getRegionPriority(r) > 0.2
        );
        if (
            gBestMetrics &&
            currentExecutionCount >= minStepsBeforeEarlyStop &&
            stepsWithoutGlobalImprovement >= Math.floor(earlyStopPatience * 0.65) &&
            allLeaderNeighborsEvaluated &&
            !hasOtherActiveRegions &&
            lowEIConsecutiveCount >= 12
        ) {
            emitStepLog({
                type: "EARLY_STOP_LATTICE_EXHAUSTED",
                stepNumber: currentExecutionCount,
                stepsWithoutGlobalImprovement
            });
            emitStructuredLog(
                "SYSTEM",
                `⚡ Early stop triggered at step #${currentExecutionCount}: Discrete neighborhood around leader exhausted.`, // <-- Добавлены кавычки ` `
                buildSimulationSnapshot(
                    currentExecutionCount,
                    "SUCCESS",
                    100,
                    gBestPhysical,
                    gBestMetrics,
                    "Discrete optimum reached"
                )
            );
            break;
        }
        if (
            gBestMetrics &&
            currentExecutionCount >= minStepsBeforeEarlyStop &&
            stepsWithoutGlobalImprovement >= earlyStopPatience
        ) {
            const leaderRegion = searchRegions.find(r => r.active && isGlobalLeaderRegion(r));
            const leaderConverged = !leaderRegion || leaderRegion.radius <= minRegionRadius * 1.15;
            const hasUnexploredRegions = searchRegions.some(
                r => r.active && !isGlobalLeaderRegion(r) && r.attempts <= 2
            );
            const hasCoarse = Array.from(isCoarseAxis).some(flag => flag === 1);
            const requiredLowEISteps = hasCoarse ? 18 : 12;
            const eiExhausted = lowEIConsecutiveCount >= requiredLowEISteps;
            const deepStagnation =
                stepsWithoutGlobalImprovement >= Math.floor(earlyStopPatience * 1.5) &&
                lowEIConsecutiveCount >= 8;
            if ((leaderConverged && eiExhausted && !hasUnexploredRegions) || deepStagnation) {
                emitStepLog({
                    type: "EARLY_STOP_CONVERGED",
                    stepNumber: currentExecutionCount,
                    stepsWithoutGlobalImprovement,
                    leaderRadius: leaderRegion?.radius ?? null,
                    lowEIConsecutiveCount
                });

                emitStructuredLog(
                    "SYSTEM",
                    `⚡ Early stop triggered at step #${currentExecutionCount}: Search converged (${stepsWithoutGlobalImprovement} steps without improvement, low EI for ${lowEIConsecutiveCount} steps).`,
                    buildSimulationSnapshot(
                        currentExecutionCount,
                        "SUCCESS",
                        100,
                        gBestPhysical,
                        gBestMetrics,
                        "Converged early"
                    )
                );
                break; // <-- Перенесено внутрь if ((leaderConverged && eiExhausted) || deepStagnation)
            }
        } // <-- Удалена лишняя закрывающая скобка
    }
// -----------------------------------------------------------------------
// 7.11. ФОРМИРОВАНИЕ И ВОЗВРАТ ФИНАЛЬНОГО РЕЗУЛЬТАТА
// -----------------------------------------------------------------------
    const finalPhysical = gBestPhysical || fallbackPhysical;
    const finalMetrics = gBestMetrics || fallbackMetrics;
    if (!finalPhysical || !finalMetrics) {
        throw new Error(
            "Оптимизация не получила ни одного корректного завершённого результата симуляции."
        );
    }
    const finalLoad = gBestMetrics ? gBestLoad : fallbackLoad;
    const finalConstraints = gBestMetrics ? gBestConstraints : fallbackConstraints;

    emitStepLog({
        type: "OPTIMIZER_FINISHED",
        totalSteps: currentExecutionCount,
        goal: goalDirection,
        result: {
            params: finalPhysical,
            achievedValue: finalLoad,
            constraints: finalConstraints || [],
            isFallbackActivated: !gBestMetrics,
            bestStep: self.lastEvaluatedBestStepNumber
        },
        training: {
            observations: observedX.length,
            completeObservations: observedIsComplete.filter(Boolean).length,
            abortObservations: observedIsComplete.filter(value => !value).length,
            objectiveObservations: observedLogLoad.length,
            constraintObservations: observedLogConstraints.map((arr, idx) => ({
                name: constraintNames[idx] || `c_${idx}`,
                count: arr.length
            }))
        }
    });
    return {
        optimalLimits: finalPhysical,
        metrics: {
            achievedValue: finalLoad ?? null,
            constraints: finalConstraints || [],
            searchStepsMade: currentExecutionCount,
            isFallbackActivated: !gBestMetrics,
            appliedObjective: goalDirection,
            bestStepNumber: self.lastEvaluatedBestStepNumber,
            technicalMetrics: finalMetrics
        },
        diagnosticLogText: diag.getText(),
        resumeState: {
            goalDirection,
            objectiveShift,
            currentExecutionCount,
            sobolDraws: globalSobolState.drawsCount,
            prngState,
            lastEMAStorage: self.lastEMAStorage,
            evaluatedKeys: Array.from(evaluatedKeys),
            observedX,
            observedLoad,
            observedLogLoad,
            observedLoadNoise,
            observedLogConstraints,
            observedConstraintNoise,
            constraintLimitsGP,
            constraintNames,
            observedAllFeasible,
            observedRegionIds,
            observedIsComplete,
            residualPairsByConstraint,
            searchRegions: searchRegions.map(({ sobolState, ...rest }) => ({
                ...rest,
                sobolDraws: sobolState?.drawsCount ?? 0,
                digitalShift: sobolState?.digitalShift ?? null
            })),
            globalGPState,
            gBestMetrics,
            gBestPhysical,
            gBestLoad,
            gBestConstraints,
            lastEvaluatedBestParams: self.lastEvaluatedBestParams,
            lastEvaluatedBestMetrics: self.lastEvaluatedBestMetrics,
            lastEvaluatedBestStepNumber: self.lastEvaluatedBestStepNumber,
            fallbackMetrics,
            fallbackPhysical,
            fallbackLoad,
            fallbackConstraints,
            fallbackViolation,
            fallbackObjective,
            bestBoundaryX,
            bestBoundaryObjective
        }
    };
}


