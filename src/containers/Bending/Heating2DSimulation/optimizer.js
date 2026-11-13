import { createDiagnosticLogger } from "./optimizerDiagnostics.js";

/* eslint-disable no-restricted-globals */

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

function matern52Kernel(x1, x2, lengthScales) {
    if (!x1 || !x2 || !lengthScales || x1.length !== x2.length || x1.length !== lengthScales.length) {
        return NaN;
    }
    let dSq = 0;
    for (let i = 0; i < x1.length; i++) {
        const scale = lengthScales[i];
        if (!Number.isFinite(x1[i]) || !Number.isFinite(x2[i]) || !Number.isFinite(scale) || scale <= 0) {
            return NaN;
        }
        const diff = (x1[i] - x2[i]) / scale;
        dSq += diff * diff;
    }
    if (!Number.isFinite(dSq)) return NaN;

    const d = Math.sqrt(dSq);
    const sqrt5 = Math.sqrt(5);
    const poly = 1 + sqrt5 * d + (5 / 3) * dSq;
    const value = poly * Math.exp(-sqrt5 * d);

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
    constraintPrediction,
    constraintLimit,
    rho
) {
    if (
        !Number.isFinite(bestRawY) ||
        bestRawY < 0 ||
        !objectivePrediction ||
        !constraintPrediction ||
        !Number.isFinite(objectivePrediction.meanLog) ||
        !Number.isFinite(objectivePrediction.sigmaLog) ||
        objectivePrediction.sigmaLog < 0 ||
        !Number.isFinite(constraintPrediction.meanLog) ||
        !Number.isFinite(constraintPrediction.sigmaLog) ||
        constraintPrediction.sigmaLog < 0 ||
        !Number.isFinite(constraintLimit) ||
        constraintLimit < 0
    ) {
        return 0;
    }

    const mu = objectivePrediction.meanLog;
    const sigma = objectivePrediction.sigmaLog;
    const constraintSigma = constraintPrediction.sigmaLog;

    const target = 1 + bestRawY;
    const logTarget = Math.log(target);
    const constraintZ = Math.log1p(constraintLimit);

    if (sigma < 1e-9) {
        const predictedValue = Math.exp(mu);

        // 🌟 Нормализованное относительное улучшение (в долях от target)
        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, (target - predictedValue) / Math.max(1e-9, target))
            : 0;

        return improvement * probabilityBelow(
            constraintPrediction,
            constraintLimit
        );
    }

    if (constraintSigma < 1e-9) {
        if (constraintPrediction.meanLog > constraintZ) {
            return 0;
        }

        rho = 0;
    }

    const correlation = constraintSigma < 1e-9
        ? 0
        : Math.max(
            -0.8,
            Math.min(
                0.8,
                Number.isFinite(rho) ? rho : 0
            )
        );

    const conditionalSigma = Math.sqrt(
        Math.max(1e-12, 1 - correlation * correlation)
    );

    const constraintLimitZ = constraintSigma < 1e-9
        ? 0
        : (
        constraintZ - constraintPrediction.meanLog
    ) / constraintSigma;

    const upper = Math.min(8, (logTarget - mu) / sigma);
    const lower = -8;

    if (!Number.isFinite(upper) || upper <= lower) {
        return 0;
    }

    const intervals = 64;
    const step = (upper - lower) / intervals;
    const normalizer = 1 / Math.sqrt(2 * Math.PI);

    let integral = 0;

    for (let i = 0; i <= intervals; i++) {
        const z = lower + i * step;
        const predictedValue = Math.exp(mu + sigma * z);

        // 🌟 Нормализованное относительное улучшение (в долях от target)
        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, (target - predictedValue) / Math.max(1e-9, target))
            : 0;

        const conditionalProbability = constraintSigma < 1e-9
            ? 1
            : normalCDF(
                (constraintLimitZ - correlation * z) /
                conditionalSigma
            );

        const density = normalizer * Math.exp(-0.5 * z * z);

        const weight =
            i === 0 || i === intervals
                ? 1
                : (i % 2 === 0 ? 2 : 4);

        integral += (
            weight *
            improvement *
            conditionalProbability *
            density
        );
    }

    const result = integral * step / 3;

    return Number.isFinite(result)
        ? Math.max(0, result)
        : 0;
}

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
    prevScales = null
) {
    const totalObservations = Array.isArray(X) ? X.length : 0;

    const MIN_SCALE = 0.25 - (0.17 * progressFactor);
    const MAX_SCALE = 3.5 - (2.0 * progressFactor);
    const MAX_SAMPLES = Math.min(60, 35 + Math.floor(progressFactor * 25));
    const MAX_PASSES = totalObservations > 60 ? 3 : 2;

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
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, baseScales[d]));
        scales[d] = clamped;

        // Ограничиваем изменение относительно предыдущего значения (±35%),
        // чтобы предотвратить резкие скачки гиперпараметров на узкой выборке
        if (hasValidWarmStart) {
            lowerBounds[d] = Math.max(MIN_SCALE, clamped * 0.65);
            upperBounds[d] = Math.min(MAX_SCALE, clamped * 1.35);
        } else {
            lowerBounds[d] = MIN_SCALE;
            upperBounds[d] = MAX_SCALE;
        }
    }

    const evaluate = candidateScales => {
        const model = fitGaussianProcess(
            sampleX,
            sampleY,
            sampleNoise,
            candidateScales,
            sampleIsComplete
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

function fitGaussianProcess(X, Y, noise, lengthScales, isComplete) {
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

        normalizedNoise[i] = rawNoise / yVarianceScale;

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
                lengthScales
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
            model.lengthScales
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

function fitDualGaussianProcess(
    X,
    logLoad,
    logError,
    loadNoise,
    errorNoise,
    loadLengthScales,
    errorLengthScales,
    isComplete
) {
    const loadModel = fitGaussianProcess(
        X,
        logLoad,
        loadNoise,
        loadLengthScales,
        isComplete
    );

    const errorModel = fitGaussianProcess(
        X,
        logError,
        errorNoise,
        errorLengthScales,
        isComplete
    );

    const valid = Boolean(loadModel?.valid && errorModel?.valid);

    return {
        valid,
        loadModel,
        errorModel,
        loadReason: loadModel?.reason || (loadModel?.valid ? null : "UNKNOWN"),
        errorReason: errorModel?.reason || (errorModel?.valid ? null : "UNKNOWN")
    };
}

function predictDualGaussianProcess(
    dualModel,
    x,
    loadSigmaCalibration = 1.0,
    errorSigmaCalibration = 1.0
) {
    if (!dualModel || !dualModel.valid) {
        return null;
    }

    const rawLoadPrediction = predictGaussianProcess(dualModel.loadModel, x);
    const rawErrorPrediction = predictGaussianProcess(dualModel.errorModel, x);

    if (!rawLoadPrediction || !rawErrorPrediction) {
        return null;
    }

    const loadPrediction = applySigmaCalibration(rawLoadPrediction, loadSigmaCalibration);
    const errorPrediction = applySigmaCalibration(rawErrorPrediction, errorSigmaCalibration);

    if (!loadPrediction || !errorPrediction) {
        return null;
    }

    return {
        loadPrediction,
        errorPrediction
    };
}

function buildRegionalTrainingDataset(
    region,
    observedX,
    observedLogLoad,
    observedLogError,
    observedLoadNoise,
    observedErrorNoise,
    observedIsComplete,
    observedRegionIds,
    referenceScales
) {
    const MAX_LOCAL_SAMPLES = 45;
    const MIN_REQUIRED_TO_FIT = 6;

    const total = observedX.length;
    if (total < MIN_REQUIRED_TO_FIT) return null;

    const coreRadius = Math.max(0.08, region.radius * 2.5);
    const items = [];

    for (let i = 0; i < total; i++) {
        const dist = calculateKernelDistance(
            observedX[i],
            region.center,
            referenceScales
        );

        if (!Number.isFinite(dist)) continue;

        const belongsToRegion = observedRegionIds[i] === region.id;
        const isNearCenter = dist <= coreRadius;
        const isCore = isNearCenter;
        const isOwnedContext = belongsToRegion && !isNearCenter;

        items.push({
            index: i,
            dist,
            isCore,
            isOwnedContext,
            isComplete: observedIsComplete[i] === true
        });
    }

    if (items.length < MIN_REQUIRED_TO_FIT) return null;

    // Разделяем актуальное ядро региона и внешний контекст
    const coreItems = items.filter(it => it.isCore);
    const contextItems = items.filter(it => !it.isCore);

    // Сортируем по близости к текущему центру (при равном расстоянии приоритет завершённым и родным точкам)
    const sortByProximity = (a, b) => {
        if (Math.abs(a.dist - b.dist) > 1e-6) return a.dist - b.dist;
        if (a.isOwnedContext !== b.isOwnedContext) return Number(b.isOwnedContext) - Number(a.isOwnedContext);
        return Number(b.isComplete) - Number(a.isComplete);
    };

    coreItems.sort(sortByProximity);
    contextItems.sort(sortByProximity);

    // Порог минимальной дистанции в ARD-шкалах ядра для защиты от вырождения матрицы
    const MIN_KERNEL_SEPARATION = Math.max(0.008, region.radius * 0.25);

    const isSpatiallyDistinct = (candidateIdx, chosenList) => {
        const candX = observedX[candidateIdx];
        for (const chosen of chosenList) {
            const d = calculateKernelDistance(candX, observedX[chosen.index], referenceScales);
            if (d < MIN_KERNEL_SEPARATION) {
                return false;
            }
        }
        return true;
    };

    const selected = [];
    // Оставляем минимум 10 слотов под внешний контекст, чтобы GP видел градиент вокруг региона
    const MAX_CORE_SLOTS = Math.min(35, MAX_LOCAL_SAMPLES - 10);

    // 1. Забираем пространственно-разнообразные точки ядра (не более MAX_CORE_SLOTS)
    for (let i = 0; i < coreItems.length && selected.length < MAX_CORE_SLOTS; i++) {
        // Самую первую (ближайшую к центру) точку берем всегда, остальные — с проверкой дистанции
        if (selected.length === 0 || isSpatiallyDistinct(coreItems[i].index, selected)) {
            selected.push(coreItems[i]);
        }
    }

    // 2. Обязательно добираем внешний контекст до MAX_LOCAL_SAMPLES (также без дубликатов)
    for (let i = 0; i < contextItems.length && selected.length < MAX_LOCAL_SAMPLES; i++) {
        if (isSpatiallyDistinct(contextItems[i].index, selected)) {
            selected.push(contextItems[i]);
        }
    }

    // 3. Fallback: если уникальных точек оказалось меньше MIN_REQUIRED_TO_FIT, добираем оставшиеся без фильтра дистанции
    if (selected.length < MIN_REQUIRED_TO_FIT) {
        const selectedSet = new Set(selected.map(it => it.index));
        const allSorted = [...coreItems, ...contextItems];
        for (let i = 0; i < allSorted.length && selected.length < MIN_REQUIRED_TO_FIT; i++) {
            if (!selectedSet.has(allSorted[i].index)) {
                selected.push(allSorted[i]);
                selectedSet.add(allSorted[i].index);
            }
        }
    }

    if (selected.length < MIN_REQUIRED_TO_FIT) return null;

    // Восстанавливаем хронологический порядок индексов
    selected.sort((a, b) => a.index - b.index);

    const localX = [];
    const localLogLoad = [];
    const localLogError = [];
    const localLoadNoise = [];
    const localErrorNoise = [];
    const localIsComplete = [];

    let coreCount = 0;
    let completeCount = 0;

    for (const item of selected) {
        const idx = item.index;
        localX.push(observedX[idx]);
        localLogLoad.push(observedLogLoad[idx]);
        localLogError.push(observedLogError[idx]);
        localIsComplete.push(observedIsComplete[idx]);

        if (item.isCore) coreCount++;
        if (observedIsComplete[idx]) completeCount++;

        // Плавное снижение веса контекстных точек через добавление дисперсии шума
        let contextNoisePenalty = 0;
        if (!item.isCore && item.dist > coreRadius) {
            const excessRatio = (item.dist / coreRadius) - 1;
            const slopeCoeff = item.isOwnedContext ? 0.025 : 0.05;
            contextNoisePenalty = Math.min(0.25, slopeCoeff * excessRatio * excessRatio);
        }

        const LOCAL_SMOOTHING_NOISE = 0.005;
        localLoadNoise.push(Math.max(LOCAL_SMOOTHING_NOISE, observedLoadNoise[idx]) + contextNoisePenalty);
        localErrorNoise.push(Math.max(LOCAL_SMOOTHING_NOISE, observedErrorNoise[idx]) + contextNoisePenalty);
    }

    if (completeCount < 4) return null;

    return {
        X: localX,
        logLoad: localLogLoad,
        logError: localLogError,
        loadNoise: localLoadNoise,
        errorNoise: localErrorNoise,
        isComplete: localIsComplete,
        totalCount: selected.length,
        coreCount,
        completeCount
    };
}

function inspectLocalGeometry(X, numParams) {
    if (
        !Array.isArray(X) ||
        X.length < 2 ||
        !Number.isInteger(numParams) ||
        numParams < 1
    ) {
        return { valid: false, reason: "INVALID_INPUT" };
    }

    const n = X.length;
    const means = new Float64Array(numParams);
    const stds = new Float64Array(numParams);

    // 1. Одномерная проверка размаха и дисперсии по каждой оси (по всей выборке X)
    for (let d = 0; d < numParams; d++) {
        let min = Infinity;
        let max = -Infinity;
        let mean = 0;

        for (let i = 0; i < n; i++) {
            const value = X[i]?.[d];

            if (!Number.isFinite(value)) {
                return {
                    valid: false,
                    reason: `NON_FINITE_AXIS_${d}`
                };
            }

            min = Math.min(min, value);
            max = Math.max(max, value);
            mean += value / n;
        }

        const range = max - min;

        if (!Number.isFinite(range) || range < 1e-3) {
            return {
                valid: false,
                reason: `COLLAPSED_AXIS_${d}`
            };
        }

        let variance = 0;

        for (let i = 0; i < n; i++) {
            const diff = X[i][d] - mean;
            variance += diff * diff;
        }

        variance /= n;

        if (!Number.isFinite(variance) || variance < 1e-6) {
            return {
                valid: false,
                reason: `LOW_VARIANCE_AXIS_${d}`
            };
        }

        means[d] = mean;
        stds[d] = Math.sqrt(variance);
    }

    // 2. Многомерная проверка через корреляционную матрицу и численный ранг
    if (numParams > 1) {
        if (n <= numParams) {
            return {
                valid: false,
                reason: "INSUFFICIENT_POINTS_FOR_RANK"
            };
        }

        const corr = Array.from(
            { length: numParams },
            () => new Float64Array(numParams)
        );

        const COLLINEARITY_LIMIT = 0.995;

        for (let i = 0; i < numParams; i++) {
            corr[i][i] = 1.0;

            for (let j = i + 1; j < numParams; j++) {
                let cov = 0;

                for (let k = 0; k < n; k++) {
                    cov += (X[k][i] - means[i]) * (X[k][j] - means[j]);
                }

                const r = (cov / n) / (stds[i] * stds[j]);

                if (!Number.isFinite(r)) {
                    return {
                        valid: false,
                        reason: `NON_FINITE_CORR_${i}_${j}`
                    };
                }

                if (Math.abs(r) >= COLLINEARITY_LIMIT) {
                    return {
                        valid: false,
                        reason: `COLLINEAR_AXES_${i}_${j}`
                    };
                }

                corr[i][j] = r;
                corr[j][i] = r;
            }
        }

        // Вычисление численного ранга методом Гаусса с полным выбором главного элемента
        const work = corr.map(row => new Float64Array(row));
        const RANK_EPSILON = 1e-3;
        let numericalRank = 0;

        for (let step = 0; step < numParams; step++) {
            let pivotRow = step;
            let pivotCol = step;
            let maxVal = 0;

            for (let r = step; r < numParams; r++) {
                for (let c = step; c < numParams; c++) {
                    const absVal = Math.abs(work[r][c]);
                    if (absVal > maxVal) {
                        maxVal = absVal;
                        pivotRow = r;
                        pivotCol = c;
                    }
                }
            }

            if (maxVal < RANK_EPSILON) {
                break;
            }

            numericalRank++;

            if (pivotRow !== step) {
                const tmpRow = work[step];
                work[step] = work[pivotRow];
                work[pivotRow] = tmpRow;
            }

            if (pivotCol !== step) {
                for (let r = 0; r < numParams; r++) {
                    const tmpVal = work[r][step];
                    work[r][step] = work[r][pivotCol];
                    work[r][pivotCol] = tmpVal;
                }
            }

            const pivot = work[step][step];

            for (let r = step + 1; r < numParams; r++) {
                const factor = work[r][step] / pivot;
                for (let c = step; c < numParams; c++) {
                    work[r][c] -= factor * work[step][c];
                }
            }
        }

        if (numericalRank < numParams) {
            return {
                valid: false,
                reason: `RANK_DEFICIENT_${numericalRank}_OF_${numParams}`
            };
        }
    }

    return { valid: true, reason: "OK" };
}

function optimizeRegionalLengthScales(
    localDataset,
    globalLoadScales,
    globalErrorScales,
    prevLoadScales,
    prevErrorScales,
    numParams,
    progressFactor
) {
    const MIN_COMPLETE_FOR_LOCAL_OPT = 16;
    const MIN_CORE_FOR_LOCAL_OPT = 12;

    const makeFallbackResult = reason => ({
        loadScales: new Float64Array(globalLoadScales),
        errorScales: new Float64Array(globalErrorScales),
        adapted: false,
        reason
    });

    if (
        !localDataset ||
        localDataset.completeCount < MIN_COMPLETE_FOR_LOCAL_OPT ||
        localDataset.coreCount < MIN_CORE_FOR_LOCAL_OPT
    ) {
        return makeFallbackResult("INSUFFICIENT_LOCAL_DIVERSITY");
    }

    const geometry = inspectLocalGeometry(localDataset.X, numParams);

    if (!geometry.valid) {
        return makeFallbackResult(
            `DEGENERATE_LOCAL_GEOMETRY_${geometry.reason}`
        );
    }

    const MIN_ABS_SCALE = Math.max(0.12, 0.22 - 0.08 * progressFactor);
    const MAX_ABS_SCALE = 3.0;

    const evaluateLocalLML = (targetY, targetNoise, candidateScales) => {
        const model = fitGaussianProcess(
            localDataset.X,
            targetY,
            targetNoise,
            candidateScales,
            localDataset.isComplete
        );
        return model?.valid && Number.isFinite(model.logMarginalLikelihood)
            ? model.logMarginalLikelihood
            : -Infinity;
    };

    const optimizeSingleTarget = (targetY, targetNoise, globalScales, prevScales) => {
        const fallback = new Float64Array(globalScales);
        const hasPrev =
            prevScales &&
            prevScales.length === numParams &&
            Array.from(prevScales).every(v => Number.isFinite(v) && v > 0);

        const current = new Float64Array(numParams);
        const lowerBounds = new Float64Array(numParams);
        const upperBounds = new Float64Array(numParams);

        for (let d = 0; d < numParams; d++) {
            const gScale = Math.max(MIN_ABS_SCALE, Math.min(MAX_ABS_SCALE, globalScales[d]));
            const globalMin = Math.max(MIN_ABS_SCALE, gScale * 0.65);
            const globalMax = Math.min(MAX_ABS_SCALE, gScale * 1.8);

            const startVal = hasPrev
                ? Math.max(globalMin, Math.min(globalMax, prevScales[d]))
                : gScale;

            current[d] = startVal;
            lowerBounds[d] = Math.max(globalMin, startVal * 0.70);
            upperBounds[d] = Math.min(globalMax, startVal * 1.30);
        }

        let bestScore = evaluateLocalLML(targetY, targetNoise, current);

        if (!Number.isFinite(bestScore)) {
            return { resultScales: fallback, improved: false };
        }

        let anyImproved = false;

        for (let pass = 0; pass < 2; pass++) {
            let passImproved = false;

            for (let d = 0; d < numParams; d++) {
                const orig = current[d];
                const candidates = [
                    Math.max(lowerBounds[d], orig * 0.78),
                    Math.min(upperBounds[d], orig * 1.28)
                ];

                for (const cand of candidates) {
                    if (Math.abs(cand - current[d]) < 1e-9) continue;

                    const testScales = new Float64Array(current);
                    testScales[d] = cand;

                    const score = evaluateLocalLML(targetY, targetNoise, testScales);
                    if (score > bestScore + 1e-6) {
                        current[d] = cand;
                        bestScore = score;
                        passImproved = true;
                        anyImproved = true;
                    }
                }
            }

            if (!passImproved) break;
        }

        return { resultScales: current, improved: anyImproved };
    };

    const loadRes = optimizeSingleTarget(
        localDataset.logLoad,
        localDataset.loadNoise,
        globalLoadScales,
        prevLoadScales
    );

    const errorRes = optimizeSingleTarget(
        localDataset.logError,
        localDataset.errorNoise,
        globalErrorScales,
        prevErrorScales
    );

    const adapted = loadRes.improved || errorRes.improved;

    return {
        loadScales: loadRes.resultScales,
        errorScales: errorRes.resultScales,
        adapted,
        reason: adapted ? "ADAPTED" : "KEPT_PREVIOUS"
    };
}


// Условие 1,2,3,4,5,6: Интеллектуальный расчет калибровки с ЕМА-сглаживанием и глобальным контролем осей
function estimateResidualSigmaScale(pairs, key, observedX = [], lastScaleValue = 1.0, progressFactor = 0.0) {
    const MIN_REQUIRED_SAMPLES = 20;
    const SMOOTHING_FACTOR = 0.15;

    // Санитарная нормализация входящего стейта ЕМА
    const MAX_SIGMA_SCALE = 1.5;
    const previousScale = Number.isFinite(lastScaleValue)
        ? Math.max(0.75, Math.min(MAX_SIGMA_SCALE, lastScaleValue))
        : 1.0;

    // ИСПРАВЛЕНО: Все ранние возвраты теперь строго отдают валидированный previousScale
    if (!Array.isArray(pairs) || pairs.length < MIN_REQUIRED_SAMPLES) return previousScale;

    let sumSquares = 0;
    let validCount = 0;
    for (const pair of pairs) {
        const value = pair?.[key];
        if (Number.isFinite(value)) { sumSquares += value * value; validCount++; }
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

function bivariateNormalCDF(h, k, rho) {
    if (Number.isNaN(h) || Number.isNaN(k)) return 0;

    if (h <= -8 || k <= -8) return 0;
    if (h >= 8) return normalCDF(k);
    if (k >= 8) return normalCDF(h);

    const r = Math.max(
        -0.8,
        Math.min(0.8, Number.isFinite(rho) ? rho : 0)
    );

    if (Math.abs(r) < 1e-10) {
        return normalCDF(h) * normalCDF(k);
    }

    const intervals = 64;
    const step = r / intervals;

    let integral = 0;

    for (let i = 0; i <= intervals; i++) {
        const t = i * step;
        const oneMinusT2 = Math.max(1e-12, 1 - t * t);

        const exponent = -(
            h * h -
            2 * h * k * t +
            k * k
        ) / (2 * oneMinusT2);

        const value = Math.exp(
            Math.max(-745, exponent)
        ) / Math.sqrt(oneMinusT2);

        const weight =
            i === 0 || i === intervals
                ? 1
                : (i % 2 === 0 ? 2 : 4);

        integral += weight * value;
    }

    integral *= step / 3 / (2 * Math.PI);

    const result =
        normalCDF(h) * normalCDF(k) + integral;

    return Number.isFinite(result)
        ? Math.max(0, Math.min(1, result))
        : 0;
}

function jointProbabilityBelow(
    loadPrediction,
    errorPrediction,
    loadLimit,
    errorLimit,
    rho
) {
    if (
        !loadPrediction ||
        !errorPrediction ||
        !Number.isFinite(loadLimit) ||
        loadLimit < 0 ||
        !Number.isFinite(errorLimit) ||
        errorLimit < 0 ||
        !Number.isFinite(loadPrediction.meanLog) ||
        !Number.isFinite(loadPrediction.sigmaLog) ||
        loadPrediction.sigmaLog < 0 ||
        !Number.isFinite(errorPrediction.meanLog) ||
        !Number.isFinite(errorPrediction.sigmaLog) ||
        errorPrediction.sigmaLog < 0
    ) {
        return 0;
    }

    const loadSigma = loadPrediction.sigmaLog;
    const errorSigma = errorPrediction.sigmaLog;

    const loadLimitLog = Math.log1p(loadLimit);
    const errorLimitLog = Math.log1p(errorLimit);

    const loadZ = loadSigma < 1e-9
        ? (
            loadPrediction.meanLog <= loadLimitLog
                ? 8
                : -8
        )
        : (
            (loadLimitLog - loadPrediction.meanLog) /
            loadSigma
        );

    const errorZ = errorSigma < 1e-9
        ? (
            errorPrediction.meanLog <= errorLimitLog
                ? 8
                : -8
        )
        : (
            (errorLimitLog - errorPrediction.meanLog) /
            errorSigma
        );

    return bivariateNormalCDF(loadZ, errorZ, rho);
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

function createSobolGenerator(dimensions) {
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

    return () => {
        index++;

        let bit = 0;
        let n = index;

        while (
            (n & 1) === 0 &&
            bit < BITS - 1
            ) {
            n >>>= 1;
            bit++;
        }

        const point = new Float64Array(dimensions);

        for (let d = 0; d < dimensions; d++) {
            state[d] ^= directions[d][bit];
            point[d] = state[d] / 4294967296;
        }

        return point;
    };
}

export async function optimizeForMaxSpeed(baseParams, simulateFn, options = {}) {
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

    const objective =
        options.optimizationObjective || "minimize_load";

    if (
        ![
            "minimize_load",
            "minimize_error"
        ].includes(objective)
    ) {
        throw new Error(
            "Неизвестная цель оптимизации: " + objective
        );
    }

    const maxAllowedErrorScore =
        options.maxErrorScore ?? 1;

    const maxAllowedLoad =
        options.maxAllowedLoad ?? 250000;

    const earlyAbortLoadMultiplier =
        options.earlyAbortLoadMultiplier ?? 1.2;

    const config = options.config;

    if (
        !config ||
        typeof config !== "object" ||
        Array.isArray(config)
    ) {
        throw new Error(
            "Конфигурация параметров не передана!"
        );
    }

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

    // ✅ Объявляем ПОСЛЕ numParams и ДО проверки if (!Number.isFinite(...))
    const requestedInitialPoints = Number.isFinite(options.randomInitPoints)
        ? options.randomInitPoints
        : Math.max(6, numParams * 4);

    const requestedIterations = Number.isFinite(options.totalBudgetIterations)
        ? options.totalBudgetIterations
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

    // Нужна хотя бы одна начальная точка для обучения GP.
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

    if (
        !Number.isFinite(maxAllowedLoad) ||
        maxAllowedLoad <= 0 ||
        !Number.isFinite(maxAllowedErrorScore) ||
        maxAllowedErrorScore < 0 ||
        !Number.isFinite(earlyAbortLoadMultiplier) ||
        earlyAbortLoadMultiplier <= 0
    ) {
        throw new Error(
            "Некорректные ограничения оптимизации!"
        );
    }


    const absoluteCeiling =
        maxAllowedLoad * earlyAbortLoadMultiplier;

    const errorViolationScale =
        maxAllowedErrorScore > 0
            ? maxAllowedErrorScore
            : (Number.isFinite(options.errorViolationScale) && options.errorViolationScale > 0
                ? options.errorViolationScale
                : 1.0);

    if (
        !Number.isFinite(errorViolationScale) ||
        errorViolationScale <= 0
    ) {
        throw new Error(
            "При maxErrorScore = 0 необходимо задать errorViolationScale > 0."
        );
    }

    const massiveLoadLimit =
        absoluteCeiling * 3;

    if (
        !Number.isFinite(absoluteCeiling) ||
        !Number.isFinite(massiveLoadLimit)
    ) {
        throw new Error(
            "Переполнение при расчёте ограничений нагрузки."
        );
    }

    // Глобальный контекст для сохранения истории ЕМА-калибровки остатков
    self.lastEMAStorage = state?.lastEMAStorage || { load: 1.0, error: 1.0 };

    // Память регионов доверия (Trust Regions State) с восстановлением Float64Array
    const searchRegions = Array.isArray(state?.searchRegions)
        ? state.searchRegions.map(r => ({
            ...r,
            center: r.center instanceof Float64Array ? r.center : new Float64Array(Object.values(r.center || {})),
            bestX: r.bestX instanceof Float64Array ? r.bestX : new Float64Array(Object.values(r.bestX || {})),
            previousBestX: r.previousBestX ? (r.previousBestX instanceof Float64Array ? r.previousBestX : new Float64Array(Object.values(r.previousBestX))) : null,
            rawDirection: r.rawDirection ? (r.rawDirection instanceof Float64Array ? r.rawDirection : new Float64Array(Object.values(r.rawDirection))) : null,
            loadLengthScales: r.loadLengthScales ? (r.loadLengthScales instanceof Float64Array ? r.loadLengthScales : new Float64Array(Object.values(r.loadLengthScales))) : null,
            errorLengthScales: r.errorLengthScales ? (r.errorLengthScales instanceof Float64Array ? r.errorLengthScales : new Float64Array(Object.values(r.errorLengthScales))) : null,
            dualGP: null // Переобучится автоматически на первом же шаге
        }))
        : [];

    // Единый стейт глобальной модели (Global GP)
    const globalGPState = state?.globalGPState
        ? {
            ...state.globalGPState,
            loadLengthScales: state.globalGPState.loadLengthScales ? new Float64Array(Object.values(state.globalGPState.loadLengthScales)) : null,
            errorLengthScales: state.globalGPState.errorLengthScales ? new Float64Array(Object.values(state.globalGPState.errorLengthScales)) : null,
            model: null
        }
        : {
            loadLengthScales: null,
            errorLengthScales: null,
            lastLoadScaleCompleteCount: -Infinity,
            lastErrorScaleCompleteCount: -Infinity,
            model: null
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

    const getPhysicalKeyFromPhysical = physical =>
        paramKeys.map(key => String(physical[key])).join("|");

    const getPhysicalKey = xNorm => {
        const physical = toPhysical(xNorm);

        paramKeys.forEach(key => {
            const digits = config[key]?.digits;
            if (Number.isInteger(digits) && Number.isFinite(physical[key])) {
                physical[key] = Number(physical[key].toFixed(digits));
            }
        });

        return getPhysicalKeyFromPhysical(physical);
    };

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

    const toPhysical = xNorm => {
        const canonicalX = canonicalizeNormalized(xNorm);
        const result = {};

        paramKeys.forEach((key, idx) => {
            const range = config[key];
            let val = range.min + canonicalX[idx] * (range.max - range.min);
            if (range.integer) {
                val = Math.round(val);
            } else if (Number.isInteger(range.digits)) {
                val = Number(val.toFixed(range.digits));
            }
            result[key] = Math.max(range.min, Math.min(range.max, val));
        });

        return result;
    };

    const isValidPhysical = physical => {
        if (!physical || typeof physical !== "object") return false;
        for (const key of paramKeys) {
            const val = physical[key];
            const range = config[key];
            if (!Number.isFinite(val) || val < range.min || val > range.max) {
                return false;
            }
        }
        return true;
    };

    // Единая функция канонизации: возвращает округленные физические параметры и синхронизированный normX
    const quantizeCandidate = rawX => {
        const physical = toPhysical(rawX);
        if (!isValidPhysical(physical)) return null;

        // Применяем кастомную функцию привязки (snap), если она задана для параметра
        for (const key of paramKeys) {
            const range = config[key];
            if (typeof range.snap === "function") {
                const snappedVal = range.snap(physical[key], baseParams);
                if (!Number.isFinite(snappedVal)) return null;

                const roundedVal = Number.isInteger(range.digits)
                    ? Number(snappedVal.toFixed(range.digits))
                    : snappedVal;

                physical[key] = Math.max(range.min, Math.min(range.max, roundedVal));
            }
        }

        if (!isValidPhysical(physical)) return null;

        // Обратная синхронизация нормализованного вектора normX с фактическими значениями
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

        const canonicalX =
            canonicalizeNormalized(normX);

        const physical = toPhysical(canonicalX);

        if (!isValidPhysical(physical)) return null;

        return canonicalX;
    };


    const evaluatedKeys = state?.evaluatedKeys instanceof Set
        ? state.evaluatedKeys
        : new Set(Array.isArray(state?.evaluatedKeys) ? state.evaluatedKeys : []);


    const rawNextSobolPoint = createSobolGenerator(numParams);
    let sobolDrawsCount = state?.sobolDraws || 0;

    // Если это продолжение — проматываем генератор Соболя до места остановки
    if (sobolDrawsCount > 0) {
        for (let i = 0; i < sobolDrawsCount; i++) {
            rawNextSobolPoint();
        }
    }

    // Обёртка, которая автоматически считает количество вызовов Соболя
    const nextSobolPoint = () => {
        sobolDrawsCount++;
        return rawNextSobolPoint();
    };

    const generateRandomPoint = (
        seenKeys = null,
        maxAttempts = 100
    ) => {
        for (
            let attempt = 0;
            attempt < maxAttempts;
            attempt++
        ) {
            const q = quantizeCandidate(nextSobolPoint());
            if (!q) continue;

            if (seenKeys && seenKeys.has(q.key)) {
                continue;
            }

            return q;
        }

        return null;
    };

    const observedX = Array.isArray(state?.observedX)
        ? state.observedX.map(pt => pt instanceof Float64Array ? pt : new Float64Array(Object.values(pt)))
        : [];
    const observedLoad = state?.observedLoad || [];
    const observedError = state?.observedError || [];
    const observedLogLoad = state?.observedLogLoad || [];
    const observedLogError = state?.observedLogError || [];
    const observedLoadNoise = state?.observedLoadNoise || [];
    const observedErrorNoise = state?.observedErrorNoise || [];
    const observedRegionIds = state?.observedRegionIds || []; // -1 = Global / Init, >= 0 = ID региона

    // false = частичное ABORT-наблюдение.
    // true = полностью завершённая симуляция.
    // ABORT остаётся в обучении GP, но не участвует в элитных точках.
    const observedIsComplete = state?.observedIsComplete || [];

    const residualPairs = state?.residualPairs || [];
    const MAX_RESIDUAL_PAIRS = 100;

    const MIN_ABORT_TRAINING_PROGRESS = 5;
    const MAX_ABORT_PROGRESS_PERCENT = 50;

    let gBestMetrics = state?.gBestMetrics || null;
    let gBestPhysical = state?.gBestPhysical || null;
    let gBestLoad = state?.gBestLoad ?? Infinity;
    let gBestError = state?.gBestError ?? Infinity;

    let fallbackMetrics = state?.fallbackMetrics || null;
    let fallbackPhysical = state?.fallbackPhysical || null;
    let fallbackLoad = state?.fallbackLoad ?? Infinity;
    let fallbackError = state?.fallbackError ?? Infinity;
    let fallbackViolation = state?.fallbackViolation ?? Infinity;
    let fallbackObjective = state?.fallbackObjective ?? Infinity;

    let pendingDecision = null;

    const formatLogValues = (value, key = null) => {
        if (typeof value === "number") {
            if (!Number.isFinite(value)) return null;

            const configuredDigits =
                config[key]?.digits;

            const digits = Number.isInteger(configuredDigits)
                ? Math.max(
                    0,
                    Math.min(12, configuredDigits)
                )
                : 3;

            const rounded = Number(
                value.toFixed(digits)
            );

            return Object.is(rounded, -0) ? 0 : rounded;
        }

        if (Array.isArray(value)) {
            return value.map(item =>
                formatLogValues(item)
            );
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value).map(
                    ([childKey, item]) => [
                        childKey,
                        formatLogValues(item, childKey)
                    ]
                )
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
            // Передаем копию объекта, чтобы избежать ссылочных завязок между потоками
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
            console.error(
                "Optimizer progress callback failed:",
                e
            );
        }
    };

    const getObjectiveValue = (load, error) => (
        objective === "minimize_load"
            ? load
            : error
    );

    const getConstraintViolation = (load, error) => {
        if (
            !Number.isFinite(load) ||
            !Number.isFinite(error) ||
            load < 0 ||
            error < 0
        ) {
            return Infinity;
        }

        const loadViolation = Math.max(
            0,
            (load - maxAllowedLoad) / maxAllowedLoad
        );

        const errorViolation = Math.max(
            0,
            (error - maxAllowedErrorScore) / errorViolationScale
        );

        return Math.max(
            loadViolation,
            errorViolation
        );
    };

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
            candidateParams: currentParams
                ? { ...currentParams }
                : null,
            technicalMetrics: technicalMetrics || null,
            message,
            bestStepNumber: [
                "SUCCESS",
                "WARN"
            ].includes(status)
                ? self.lastEvaluatedBestStepNumber
                : null
        };
    }

    const isGlobalLeaderRegion = region =>
        Boolean(gBestMetrics) &&
        region.bestViolation === 0 &&
        Math.abs(region.bestObjective - getObjectiveValue(gBestLoad, gBestError)) <= 1e-6;

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

    // Единая метрика приоритета региона для выбора и вытеснения
    const getRegionPriority = region => {
        const successRate = (region.improvements + 1) / (region.attempts + 2);
        const explorationValue = Math.sqrt(region.radius / 0.15);
        const failurePenalty = Math.pow(0.85, region.failures);
        const idleSteps = Math.max(0, currentExecutionCount - region.lastImprovementStep);
        const idlePenalty = idleSteps > 12 ? Math.pow(0.96, idleSteps - 12) : 1.0;

        // 🌟 Бонус за новизну (UCB): дает шанс новым регионам (attempts = 1..3) поучаствовать в отборе
        const noveltyBonus = 1.0 + 0.8 / Math.sqrt(Math.max(1, region.attempts));

        const basePriority = successRate * explorationValue * failurePenalty * idlePenalty * noveltyBonus;

        // Регион с текущим глобальным рекордом сохраняет приоритет 0.25,
        // но после 25 шагов без улучшений на минимальном радиусе уступает бюджет новым долинам
        if (isGlobalLeaderRegion(region)) {
            const leaderFloor = (region.radius <= 0.024 && idleSteps >= 25) ? 0.06 : 0.25;
            return Math.max(leaderFloor, basePriority);
        }
        return basePriority;
    };

    const updateTrustRegions = (
        normX,
        load,
        errorScore,
        outcomeStatus,
        isGlobalCandidate = false,
        sourceRegionId = -1
    ) => {
        if (outcomeStatus === "ERROR") return;

        let associatedRegion = null;

        // 1. Для локальных кандидатов приоритетно используем их исходный регион, если он активен
        if (Number.isInteger(sourceRegionId) && sourceRegionId >= 0) {
            const originRegion = searchRegions.find(r => r.id === sourceRegionId && r.active);
            if (originRegion) {
                associatedRegion = originRegion;
            }
        }

        // 2. Геометрический поиск используется для GLOBAL, INIT, FALLBACK или если исходный регион уже закрыт
        if (!associatedRegion) {
            const currentScales = objective === "minimize_load"
                ? (globalGPState.loadLengthScales || new Float64Array(numParams).fill(0.55))
                : (globalGPState.errorLengthScales || new Float64Array(numParams).fill(0.55));

            let minDistance = Infinity;

            for (const region of searchRegions) {
                if (!region.active) continue;

                const dist = calculateKernelDistance(
                    normX,
                    region.center,
                    currentScales
                );

                const regionThreshold = Math.max(
                    0.04,
                    region.radius * 1.5
                );

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
                region.radius = Math.max(0.022, region.radius * 0.72);
            }

            if (region.failures >= 25) {
                if (isGlobalLeaderRegion(region)) {
                    // Никогда не удаляем регион с глобальным рекордом — перезапускаем микро-поиск
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

        if (!Number.isFinite(load) || !Number.isFinite(errorScore)) return;

        const currentObjective = getObjectiveValue(load, errorScore);
        const violation = getConstraintViolation(load, errorScore);

        if (associatedRegion) {
            associatedRegion.attempts++;
            associatedRegion.completeObservationsCount =
                (associatedRegion.completeObservationsCount ?? 0) + 1;

            const isImprovement =
                violation < associatedRegion.bestViolation ||
                (violation === associatedRegion.bestViolation && currentObjective < associatedRegion.bestObjective);

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
                associatedRegion.bestLoad = load;
                associatedRegion.bestError = errorScore;
                associatedRegion.bestObjective = currentObjective;
                associatedRegion.bestViolation = violation;
                associatedRegion.improvements++;
                associatedRegion.failures = 0;
                associatedRegion.lastImprovementStep = currentExecutionCount;
                associatedRegion.radius = Math.min(0.25, associatedRegion.radius * 1.12);

                // 🌟 Слияние регионов (Merge), если два региона сошлись в одну точку
                const currentScales = objective === "minimize_load"
                    ? (globalGPState.loadLengthScales || new Float64Array(numParams).fill(0.55))
                    : (globalGPState.errorLengthScales || new Float64Array(numParams).fill(0.55));

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
                                other.bestObjective < associatedRegion.bestObjective);

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

        const createNewRegionObject = id => ({
            id,
            center: new Float64Array(normX),
            bestX: new Float64Array(normX),
            previousBestX: null,
            rawDirection: null,
            bestLoad: load,
            bestError: errorScore,
            bestObjective: currentObjective,
            bestViolation: violation,
            radius: 0.12,
            attempts: 1,
            improvements: 1,
            failures: 0,
            lastImprovementStep: currentExecutionCount,
            active: true,

            // Неограниченный счётчик завершённых наблюдений региона
            completeObservationsCount: outcomeStatus === "SUCCESS" ? 1 : 0,
            lastScaleOptimizationCount: -Infinity,

            // Локальные масштабы
            loadLengthScales: globalGPState.loadLengthScales
                ? new Float64Array(globalGPState.loadLengthScales)
                : null,
            errorLengthScales: globalGPState.errorLengthScales
                ? new Float64Array(globalGPState.errorLengthScales)
                : null,

            // Самостоятельная локальная пара моделей (Regional GP)
            dualGP: null,
            localTrainingStats: null
        });

        const inactiveIndex = searchRegions.findIndex(r => !r.active);
        if (inactiveIndex >= 0) {
            searchRegions[inactiveIndex] = createNewRegionObject(searchRegions[inactiveIndex].id);
            return;
        }

        if (searchRegions.length < 5) {
            const nextId = searchRegions.length ? Math.max(...searchRegions.map(r => r.id)) + 1 : 0;
            searchRegions.push(createNewRegionObject(nextId));
            return;
        }

        // Ищем самый слабый или давно заброшенный регион для замены
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
                (violation === weakest.bestViolation && currentObjective < weakest.bestObjective);

            const isComparableFeasible =
                violation === 0 &&
                weakest.bestViolation === 0 &&
                currentObjective <= weakest.bestObjective * 1.25;

            const isIdleOrStagnant =
                idleSteps >= 25 ||
                (isGlobalCandidate && lowestScore < 0.12 && idleSteps >= 8 && isComparableFeasible);

            if (isStrictlyBetter || isIdleOrStagnant) {
                searchRegions[weakestIndex] = createNewRegionObject(weakest.id);
            }
        }
    };


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
            return null; // Защита от повторного вызова одной и той же сетки после округления
        }

        // Сохраняем ключ и для успешной, и для ошибочной,
        // и для прерванной симуляции.
        // Повторная оценка той же комбинации не допускается.
        evaluatedKeys.add(physicalKey);

        currentExecutionCount++;

        let recordedAbortProgress = null;

        const decision = pendingDecision;
        pendingDecision = null;

        self.currentRunningStepNumber =
            currentExecutionCount;

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

        const simArgs = {
            ...baseParams,

            onProgress: (percent, technicalMetrics) => {
                if (
                    !Number.isFinite(percent) ||
                    percent < 0 ||
                    percent > 100 ||
                    !technicalMetrics
                ) {
                    return false;
                }

                const rawCurrentLoad =
                    technicalMetrics.iterations
                        ?.totalGridPointsProcessed;

                const currentLoad =
                    Number.isFinite(rawCurrentLoad) &&
                    rawCurrentLoad >= 0
                        ? rawCurrentLoad
                        : 0;

                const lastSample =
                    progressHistory[
                    progressHistory.length - 1
                        ];

                const isNewProgressStep = percent > lastProgress;

                if (isNewProgressStep) {
                    progressHistory.push({
                        percent,
                        load: currentLoad
                    });

                    lastProgress = percent;

                    if (
                        progressHistory.length > MAX_HISTORY
                    ) {
                        progressHistory.shift();
                    }
                } else if (
                    percent === lastProgress &&
                    lastSample
                ) {
                    lastSample.load = currentLoad;
                }

                let predictedFinalLoad = null;

                if (
                    percent >= MIN_PREDICTION_PROGRESS &&
                    progressHistory.length >= MIN_HISTORY
                ) {
                    const n = progressHistory.length;

                    let sumX = 0;
                    let sumY = 0;
                    let sumXY = 0;
                    let sumXX = 0;

                    for (const point of progressHistory) {
                        sumX += point.percent;
                        sumY += point.load;
                        sumXY += point.percent * point.load;
                        sumXX += point.percent * point.percent;
                    }

                    const denominator =
                        n * sumXX - sumX * sumX;

                    if (
                        Number.isFinite(denominator) &&
                        denominator > 0
                    ) {
                        const slope =
                            (n * sumXY - sumX * sumY) /
                            denominator;

                        if (Number.isFinite(slope)) {
                            const prediction =
                                currentLoad +
                                Math.max(0, slope) *
                                (100 - percent);

                            if (Number.isFinite(prediction)) {
                                predictedFinalLoad = Math.max(
                                    currentLoad,
                                    prediction
                                );
                            }
                        }
                    }
                }

                const requestAbort = abortInfo => {
                    recordedAbortProgress = abortInfo;
                    notifyProgress(percent, technicalMetrics, abortInfo.reason);
                    return true;
                };

                // Условие 1: Сначала ловим аномальный взрыв нагрузки на старте (до 10% прогресса)
                if (
                    percent < 10 &&
                    currentLoad > massiveLoadLimit
                ) {
                    return requestAbort({
                        reason: "MASSIVE_INITIAL_LOAD",
                        percent,
                        currentLoad,
                        predictedFinalLoad,
                        absoluteCeiling
                    });
                }

                // Шаг 2: Проверяем стандартное превышение физического потолка на дистанции
                if (
                    percent <= MAX_ABORT_PROGRESS_PERCENT &&
                    currentLoad >= absoluteCeiling
                ) {
                    return requestAbort({
                        reason: "ABSOLUTE_LOAD_LIMIT",
                        percent,
                        currentLoad,
                        predictedFinalLoad,
                        absoluteCeiling
                    });
                }

                // Шаг 3: Проверяем экстраполированный прогноз тренда нагрузки
// Шаг 3: Проверяем экстраполированный прогноз тренда нагрузки
                if (
                    percent <= MAX_ABORT_PROGRESS_PERCENT &&
                    predictedFinalLoad !== null
                ) {
                    if (isNewProgressStep) {
                        if (predictedFinalLoad > absoluteCeiling) {
                            predictedAbortCount++;
                        } else {
                            predictedAbortCount = 0;
                        }
                    }

                    if (predictedAbortCount >= REQUIRED_PREDICTED_ABORTS) {
                        return requestAbort({
                            reason: "PREDICTED_LOAD_EXCEEDS_CEILING",
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
                ...baseParams.simulation,
                accuracyMode: paramsObj,
                calculateAccuracyError: true,
                stopAtMaxTemperature: false
            }
        };

        let res;

        try {
            res = simulateFn(simArgs);
        } catch (e) {
            const message =
                e?.message || String(e);

            const errorSnapshot =
                buildSimulationSnapshot(
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
            const returnedStatus =
                typeof res?.status?.type === "string"
                    ? res.status.type.trim().toLowerCase()
                    : null;

            const wasAborted =
                returnedStatus === "abort" ||
                Boolean(recordedAbortProgress);

            const finalStatus = wasAborted
                ? "ABORT"
                : "ERROR";

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

            console.error("[OPTIMIZER INVALID RESULT]", {
                step: currentExecutionCount,
                returnedStatus,
                wasAborted,
                result: res
            });

            emitStructuredLog(
                stepType,
                finalMessage,
                invalidSnapshot
            );

            if (wasAborted) {
                updateTrustRegions(
                    normX,
                    NaN,
                    NaN,
                    "ABORT",
                    Boolean(decision?.isGlobalExploration),
                    decision?.sourceDiagnostics?.regionId ?? -1
                );
            }

            return null;
        }

        const statusTypeRaw = res.status?.type;

        const statusType =
            typeof statusTypeRaw === "string"
                ? statusTypeRaw.trim().toLowerCase()
                : null;

        const isAborted =
            statusType === "abort" ||
            Boolean(recordedAbortProgress);

        const metrics = res.technicalMetrics;
        const acc = metrics?.accuracy;

        const rawLoad =
            metrics?.iterations?.totalGridPointsProcessed;

        const timeErr = acc?.timeIntegrationErrorC;
        const gridItemErr = acc?.spatialGridErrorC;

        const solvErr = Number.isFinite(acc?.solverErrorC)
            ? Math.abs(acc.solverErrorC)
            : NaN;

        const errorScore = (
            Number.isFinite(timeErr) &&
            timeErr >= 0 &&
            Number.isFinite(gridItemErr) &&
            gridItemErr >= 0 &&
            Number.isFinite(solvErr) &&
            solvErr >= 0
        )
            ? Math.hypot(
                timeErr,
                gridItemErr,
                solvErr
            )
            : NaN;

        const load = Number.isFinite(rawLoad)
            ? rawLoad
            : NaN;

        const abortProgress =
            recordedAbortProgress?.percent;

        emitStepLog({
            stepNumber: currentExecutionCount,
            statusType,
            load: Number.isFinite(load) ? load : null,
            errorScore: Number.isFinite(errorScore) ? errorScore : null,
        });

        const abortCurrentLoad =
            recordedAbortProgress?.currentLoad;

        const abortPredictedLoad =
            recordedAbortProgress?.predictedFinalLoad;

        const isUsableAbortObservation =
            isAborted &&
            recordedAbortProgress &&
            Number.isFinite(abortProgress) &&
            abortProgress >= MIN_ABORT_TRAINING_PROGRESS &&
            abortProgress <= MAX_ABORT_PROGRESS_PERCENT &&
            Number.isFinite(abortCurrentLoad) &&
            abortCurrentLoad >= 0 &&
            Number.isFinite(errorScore) &&
            errorScore >= 0;

        if (isUsableAbortObservation) {
            const hasPredictedLoad =
                Number.isFinite(abortPredictedLoad) &&
                abortPredictedLoad >= abortCurrentLoad;

            // ИСПРАВЛЕНО: Базируем обучение регрессии нагрузки исключительно на честной экстраполяции,
            // полностью вырезав искусственный massiveLoadLimit. Это сохраняет идеальную гладкость поверхности GP.
            let abortTrainingLoad = hasPredictedLoad
                ? abortPredictedLoad
                : abortCurrentLoad;

            if (abortProgress < MAX_ABORT_PROGRESS_PERCENT) {
                // Плавное масштабирование мягкого penalty-штрафа в зависимости от фазы отсечки
                const penaltyFactor = 1 + (1 - abortProgress / MAX_ABORT_PROGRESS_PERCENT) * 0.5;
                abortTrainingLoad *= penaltyFactor;
            }

            // ДИНАМИЧЕСКИЙ ШТРАФ ЗА ШУМ (Инвертируем логику):
            // Чем меньше прогресс, тем меньше должен быть шум (высокая уверенность GP в провале)!
            // Раньше функция возвращала большой шум для маленького процента.
            const progressRatio = Math.max(0, Math.min(1,
                (abortProgress - MIN_ABORT_TRAINING_PROGRESS) /
                (MAX_ABORT_PROGRESS_PERCENT - MIN_ABORT_TRAINING_PROGRESS)
            ));

            const loadNoise = 0.02 - 0.0199 * progressRatio;
            const errorNoise = 0.01 - 0.0099 * progressRatio;

            // Запись в массивы обучения GP
            observedX.push(new Float64Array(normX));
            observedLoad.push(abortTrainingLoad);
            observedError.push(errorScore);

            observedLogLoad.push(
                Math.log1p(abortTrainingLoad)
            );

            observedLogError.push(
                Math.log1p(errorScore)
            );

            observedLoadNoise.push(loadNoise);
            observedErrorNoise.push(errorNoise);

            observedIsComplete.push(false);
            observedRegionIds.push(decision?.sourceDiagnostics?.regionId ?? -1);
        }

        const isError =
            statusType === "error" ||
            !Number.isFinite(load) ||
            load < 0 ||
            !Number.isFinite(errorScore);

        const isValidObservation =
            !isAborted &&
            !isError &&
            Number.isFinite(load) &&
            load >= 0 &&
            Number.isFinite(errorScore);

        const isInitialPoint = customTag && (
            customTag.startsWith("PRESET_") ||
            customTag.startsWith("RANDOM_INIT_") ||
            customTag.startsWith("INIT")
        );

        if (!isInitialPoint) {
            emitStepLog({
                type: "SIMULATION_EVALUATION",
                stepNumber: currentExecutionCount,
                customTag,
                statusType,

                status: isAborted
                    ? "ABORT"
                    : (isError ? "ERROR" : "SUCCESS"),

                isValidObservation,

                observedMetrics: {
                    load: Number.isFinite(load) ? load : null,
                    errorScore: Number.isFinite(errorScore) ? errorScore : null,
                    timeErr: Number.isFinite(timeErr) ? timeErr : null,
                    gridItemErr: Number.isFinite(gridItemErr) ? gridItemErr : null,
                    solvErr: Number.isFinite(solvErr) ? solvErr : null,
                    abortProgress: abortProgress ?? null
                }
            });
        }

        let currentIsFeasible = false;

        if (isValidObservation) {
            currentIsFeasible =
                load <= maxAllowedLoad &&
                errorScore <= maxAllowedErrorScore;

            // Остатки только для завершённых симуляций.
            const predicted =
                decision?.predictionForResidual;

            if (
                predicted &&
                Number.isFinite(predicted.loadMeanLog) &&
                Number.isFinite(predicted.loadSigmaLog) &&
                predicted.loadSigmaLog > 0 &&
                Number.isFinite(predicted.errorMeanLog) &&
                Number.isFinite(predicted.errorSigmaLog) &&
                predicted.errorSigmaLog > 0
            ) {
                const loadResidual = (
                    Math.log1p(load) -
                    predicted.loadMeanLog
                ) / Math.max(
                    1e-9,
                    predicted.loadSigmaLog
                );

                const errorResidual = (
                    Math.log1p(errorScore) -
                    predicted.errorMeanLog
                ) / Math.max(
                    1e-9,
                    predicted.errorSigmaLog
                );

                if (
                    Number.isFinite(loadResidual) &&
                    Number.isFinite(errorResidual)
                ) {
                    residualPairs.push({
                        load: Math.max(
                            -5,
                            Math.min(5, loadResidual)
                        ),

                        error: Math.max(
                            -5,
                            Math.min(5, errorResidual)
                        )
                    });

                    if (
                        residualPairs.length >
                        MAX_RESIDUAL_PAIRS
                    ) {
                        residualPairs.shift();
                    }
                }
            }

            observedX.push(new Float64Array(normX));
            observedLoad.push(load);
            observedError.push(errorScore);

            observedLogLoad.push(Math.log1p(load));
            observedLogError.push(Math.log1p(errorScore));

            observedLoadNoise.push(0.0001);
            observedErrorNoise.push(0.0001);

            // Полностью завершённая симуляция.
            observedIsComplete.push(true);
            observedRegionIds.push(decision?.sourceDiagnostics?.regionId ?? -1);

            const currentObjective =
                getObjectiveValue(load, errorScore);

            if (currentIsFeasible) {
                const previousObjective = gBestMetrics
                    ? getObjectiveValue(
                        gBestLoad,
                        gBestError
                    )
                    : Infinity;

                if (
                    !gBestMetrics ||
                    currentObjective < previousObjective
                ) {

                    gBestMetrics = metrics;
                    gBestPhysical = paramsObj;
                    gBestLoad = load;
                    gBestError = errorScore;

                    self.lastEvaluatedBestParams =
                        paramsObj;

                    self.lastEvaluatedBestMetrics =
                        metrics;

                    self.lastEvaluatedBestStepNumber =
                        currentExecutionCount;
                }
            }

            const violation =
                getConstraintViolation(load, errorScore);

            if (
                !fallbackMetrics ||
                violation < fallbackViolation ||
                (
                    violation === fallbackViolation &&
                    currentObjective < fallbackObjective
                )
            ) {
                fallbackViolation = violation;
                fallbackObjective = currentObjective;

                fallbackMetrics = metrics;
                fallbackPhysical = paramsObj;
                fallbackLoad = load;
                fallbackError = errorScore;
            }
        }

        const stepMode = customTag
            ? customTag.startsWith("PRESET_")
                ? customTag
                : stepType
            : "BAYES";

        let finalStatus = "SUCCESS";

        if (isAborted) {
            finalStatus = "ABORT";
        } else if (isError) {
            finalStatus = "ERROR";
        } else if (
            statusType === "warning" ||
            statusType === "warn"
        ) {
            finalStatus = "WARN";
        }

        let finalMessage =
            recordedAbortProgress?.reason || null;

        const finalPercent = isAborted
            ? (
                Number.isFinite(abortProgress)
                    ? abortProgress
                    : Math.max(0, lastProgress)
            )
            : 100;

        const finalSnapshot =
            buildSimulationSnapshot(
                currentExecutionCount,
                finalStatus,
                finalPercent,
                paramsObj,
                metrics,
                finalMessage
            );

        emitStructuredLog(
            stepMode,
            res.status?.message || "Simulation completed",
            finalSnapshot
        );

        // Обновляем статистику регионов доверия на основе исхода шага
        const outcomeStatus = isValidObservation ? "SUCCESS" : (isAborted ? "ABORT" : "ERROR");
        updateTrustRegions(
            normX,
            load,
            errorScore,
            outcomeStatus,
            Boolean(decision?.isGlobalExploration),
            decision?.sourceDiagnostics?.regionId ?? -1
        );

        return isValidObservation
            ? { load, errorScore, feasible: load <= maxAllowedLoad && errorScore <= maxAllowedErrorScore }
            : null;
    };


    if (!state) {
        // ------------------------------------------------------------
        // INITIAL PRESETS
        // ------------------------------------------------------------

        if (options.modelPresets) {
            const modesToLoad =
                Array.isArray(options.accuracyModes)
                    ? options.accuracyModes
                    : Object.keys(options.modelPresets);

            for (const presetKey of modesToLoad) {
                if (typeof options.shouldStop === "function" && options.shouldStop()) {
                    break;
                }

                // Presets не должны превышать начальный бюджет.
                if (currentExecutionCount >= initPointsCount) {
                    break;
                }

                if (!options.modelPresets[presetKey]) {
                    continue;
                }

                const vec = normalizeParamObject(
                    options.modelPresets[presetKey]
                );

                if (!vec) continue;

                const key = getPhysicalKey(vec);

                if (evaluatedKeys.has(key)) {
                    continue;
                }

                evaluate(
                    toPhysical(vec),
                    vec,
                    "PRESET_" + String(presetKey).toUpperCase()
                );
            }
        }

        // ------------------------------------------------------------
        // RANDOM INITIALIZATION
        // ------------------------------------------------------------

        let initialAttempts = 0;

        const maxInitialAttempts = Math.max(
            100,
            initPointsCount * 100
        );

        while (
            currentExecutionCount < initPointsCount &&
            initialAttempts < maxInitialAttempts
            ) {
            await new Promise(resolve => setTimeout(resolve, 0));

            if (typeof options.shouldStop === "function" && options.shouldStop()) {
                break;
            }

            initialAttempts++;

            const candidate = generateRandomPoint(
                evaluatedKeys,
                1
            );

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

    // ------------------------------------------------------------
    // BAYESIAN OPTIMIZATION
    // ------------------------------------------------------------

    let bayesianDecisionCount = 0;
    let consecutiveMatrixFailures = 0;

    let stepsWithoutGlobalImprovement = 0;
    let lowEIConsecutiveCount = 0;
    const minStepsBeforeEarlyStop = initPointsCount + Math.max(15, numParams * 10);
    const earlyStopPatience = Math.max(24, numParams * 12); // 36 шагов для 3 параметров

    while (currentExecutionCount < totalIterations) {
        await new Promise(resolve => setTimeout(resolve, 0));

        if (typeof options.shouldStop === "function" && options.shouldStop()) {
            break;
        }

        bayesianDecisionCount++;

        const N = observedX.length;
        if (N === 0) break;

        // Сигнализируем UI, что началась фаза математического подбора следующей точки
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

        // ========================================================================
        // ГЛОБАЛЬНЫЙ ДИНАМИЧЕСКИЙ ДРЕЙФ ПРОГРЕССА (СВЯЗАНО С КОНФИГОМ ИНТЕРФЕЙСА)
        // ========================================================================
        // Чистый прогресс-фактор, который честно дорастает ровно до 1.0 на 200-м шаге
        const progressFactor = Math.min(1.0, currentExecutionCount / Math.max(1, totalIterations));

        // Определяем минимальный радиус среди активных регионов доверия
        const activeRegionsForSchedule = searchRegions.filter(r => r.active);
        const minActiveRadius = activeRegionsForSchedule.length > 0
            ? Math.min(...activeRegionsForSchedule.map(r => r.radius))
            : 0.15;

        // Адаптивный интервал: 16 -> 12 -> 8 -> 5 по мере сужения области поиска
        let reoptimizeInterval = 16;
        if (minActiveRadius <= 0.02) {
            reoptimizeInterval = 5;
        } else if (minActiveRadius <= 0.05) {
            reoptimizeInterval = 8;
        } else if (minActiveRadius <= 0.15) {
            reoptimizeInterval = 12;
        }

        // Считаем только новые полностью завершённые симуляции (ABORT не приближает переобучение)
        const currentCompleteCount = observedIsComplete.filter(Boolean).length;

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
                globalGPState.loadLengthScales
            );
            globalGPState.lastLoadScaleCompleteCount = currentCompleteCount;
        }

        if (
            !globalGPState.errorLengthScales ||
            currentCompleteCount - globalGPState.lastErrorScaleCompleteCount >= reoptimizeInterval
        ) {
            globalGPState.errorLengthScales = optimizeLengthScales(
                observedX,
                observedLogError,
                observedErrorNoise,
                numParams,
                progressFactor,
                observedIsComplete,
                globalGPState.errorLengthScales
            );
            globalGPState.lastErrorScaleCompleteCount = currentCompleteCount;
        }

        const globalDualGP = fitDualGaussianProcess(
            observedX,
            observedLogLoad,
            observedLogError,
            observedLoadNoise,
            observedErrorNoise,
            globalGPState.loadLengthScales,
            globalGPState.errorLengthScales,
            observedIsComplete
        );

        globalGPState.model = globalDualGP;

        if (!globalDualGP.valid) {
            consecutiveMatrixFailures++;
            const fallback = generateRandomPoint(evaluatedKeys, 300);
            if (!fallback || consecutiveMatrixFailures >= 3) break;
            pendingDecision = {
                method: "RANDOM_FALLBACK",
                reason: "GP_FIT_FAILED",
                loadGP: globalDualGP.loadReason,
                errorGP: globalDualGP.errorReason,
                trainingCount: N
            };
            evaluate(fallback.physical, fallback.x, "FALLBACK_GP_FAILED");
            continue;
        }

        // ========================================================================
        // ЭТАП 4: ОБУЧЕНИЕ ЛОКАЛЬНЫХ МОДЕЛЕЙ (REGIONAL GP) С АДАПТАЦИЕЙ МАСШТАБОВ
        // ========================================================================
        const activeRegionsForFit = searchRegions.filter(r => r.active);

        for (const reg of activeRegionsForFit) {
            if (!reg.loadLengthScales) {
                reg.loadLengthScales = new Float64Array(globalGPState.loadLengthScales);
            }
            if (!reg.errorLengthScales) {
                reg.errorLengthScales = new Float64Array(globalGPState.errorLengthScales);
            }

            // Пункт 5: Комбинированная метрика расстояния, учитывающая оба набора масштабов
            const combinedRefScales = new Float64Array(numParams);
            for (let d = 0; d < numParams; d++) {
                const sLoad = Math.max(1e-6, reg.loadLengthScales[d]);
                const sError = Math.max(1e-6, reg.errorLengthScales[d]);
                combinedRefScales[d] = Math.sqrt(2 / (1 / (sLoad * sLoad) + 1 / (sError * sError)));
            }

            const localDataset = buildRegionalTrainingDataset(
                reg,
                observedX,
                observedLogLoad,
                observedLogError,
                observedLoadNoise,
                observedErrorNoise,
                observedIsComplete,
                observedRegionIds,
                combinedRefScales
            );

            if (!localDataset) {
                reg.dualGP = null;
                reg.localTrainingStats = {
                    usingFallback: true,
                    reason: "INSUFFICIENT_LOCAL_DATA"
                };
                continue;
            }

            const localGeometry = inspectLocalGeometry(
                localDataset.X,
                numParams
            );

            if (!localGeometry.valid) {
                reg.dualGP = null;

                reg.localTrainingStats = {
                    usingFallback: true,
                    reason: `DEGENERATE_LOCAL_GEOMETRY_${localGeometry.reason}`,
                    totalPoints: localDataset.totalCount,
                    corePoints: localDataset.coreCount,
                    completePoints: localDataset.completeCount
                };

                continue;
            }

            // Пункт 4: Отслеживаем реальный прирост завершённых наблюдений региона (не ограниченный 45 точками)
            const regionCompleteCount = reg.completeObservationsCount ?? localDataset.completeCount;
            const localReoptInterval = reg.radius <= 0.05 ? 6 : 12;
            const shouldAdaptLocalScales =
                (regionCompleteCount - (reg.lastScaleOptimizationCount ?? -Infinity)) >= localReoptInterval;

            let localScaleStatus = "REUSED";

            if (shouldAdaptLocalScales) {
                // Пункты 1 и 3: Единый вызов с полным контрактом для load и error
                const adaptation = optimizeRegionalLengthScales(
                    localDataset,
                    globalGPState.loadLengthScales,
                    globalGPState.errorLengthScales,
                    reg.loadLengthScales,
                    reg.errorLengthScales,
                    numParams,
                    progressFactor
                );

                reg.loadLengthScales = adaptation.loadScales;
                reg.errorLengthScales = adaptation.errorScales;
                reg.lastScaleOptimizationCount = regionCompleteCount;
                localScaleStatus = adaptation.reason;
            } else if (localDataset.completeCount < 16) {
                reg.loadLengthScales = new Float64Array(globalGPState.loadLengthScales);
                reg.errorLengthScales = new Float64Array(globalGPState.errorLengthScales);
                localScaleStatus = "SYNCED_GLOBAL";
            }

            const fittedRegional = fitDualGaussianProcess(
                localDataset.X,
                localDataset.logLoad,
                localDataset.logError,
                localDataset.loadNoise,
                localDataset.errorNoise,
                reg.loadLengthScales,
                reg.errorLengthScales,
                localDataset.isComplete
            );

            if (fittedRegional.valid) {
                reg.dualGP = fittedRegional;
                reg.localTrainingStats = {
                    usingFallback: false,
                    totalPoints: localDataset.totalCount,
                    corePoints: localDataset.coreCount,
                    completePoints: localDataset.completeCount,
                    regionTotalComplete: regionCompleteCount,
                    scaleStatus: localScaleStatus
                };
            } else {
                reg.dualGP = null;

                reg.localTrainingStats = {
                    usingFallback: true,
                    reason: `FIT_FAILED_${fittedRegional.loadReason ?? "UNKNOWN"}_${fittedRegional.errorReason ?? "UNKNOWN"}`,
                    totalPoints: localDataset.totalCount,
                    corePoints: localDataset.coreCount,
                    completePoints: localDataset.completeCount,
                    regionTotalComplete: regionCompleteCount,
                    scaleStatus: localScaleStatus
                };
            }
        }


        const loadGP = globalDualGP.loadModel;
        const errorGP = globalDualGP.errorModel;

        if (!loadGP?.valid || !errorGP?.valid) {
            consecutiveMatrixFailures++; const fallback = generateRandomPoint(evaluatedKeys, 300);
            if (!fallback || consecutiveMatrixFailures >= 3) break;
            pendingDecision = { method: "RANDOM_FALLBACK", reason: "GP_FIT_FAILED", loadGP: loadGP?.reason || "UNKNOWN", errorGP: errorGP?.reason || "UNKNOWN", trainingCount: N };
            evaluate(fallback.physical, fallback.x, "FALLBACK_GP_FAILED"); continue;
        }
        consecutiveMatrixFailures = 0;
        const hasFeasibleResult = Boolean(gBestMetrics);
        const bestObjective = hasFeasibleResult ? getObjectiveValue(gBestLoad, gBestError) : Infinity;

        const candidates = [];
        const candidateSources = []; // Диагностический трекер источника точки

        // Этап 5: Баланс 35% Global GP / 65% Regional GP (при наличии активных регионов)
        const totalPoolTarget = Math.min(2400, 1400 + currentExecutionCount * 5);
        const hasActiveRegions = searchRegions.some(r => r.active);
        const candidatesCount = hasActiveRegions
            ? Math.round(totalPoolTarget * 0.35)
            : totalPoolTarget;
        const localExplorers = hasActiveRegions
            ? Math.round(totalPoolTarget * 0.65)
            : 0;

        let randomCandidatesGenerated = 0; let randomCandidatesRejected = 0;
        let localCandidatesGenerated = 0; let localCandidatesRejected = 0;
        const seenCandidateKeys = new Set(evaluatedKeys);
        const maxSobolAttempts = candidatesCount * 10; let sobolAttempts = 0;

        const residualCorrelation = estimateResidualCorrelation(residualPairs);

        // Передаем progressFactor в ЕМА калибратор (для динамического Novelty контроля осей)
        self.lastEMAStorage.load = estimateResidualSigmaScale(residualPairs, "load", observedX, self.lastEMAStorage.load, progressFactor);
        self.lastEMAStorage.error = estimateResidualSigmaScale(residualPairs, "error", observedX, self.lastEMAStorage.error, progressFactor);
        const loadSigmaCalibration = self.lastEMAStorage.load;
        const errorSigmaCalibration = self.lastEMAStorage.error;

        while (
            randomCandidatesGenerated < candidatesCount &&
            sobolAttempts < maxSobolAttempts
            ) {
            sobolAttempts++;

            const q = quantizeCandidate(nextSobolPoint());
            if (!q || seenCandidateKeys.has(q.key)) {
                randomCandidatesRejected++;
                continue;
            }

            const x = q.x;
            const key = q.key;

            let isTooClose = false;
            for (let i = 0; i < observedX.length; i++) {
                let distSq = 0;
                for (let d = 0; d < numParams; d++) {
                    const diff = x[d] - observedX[i][d];
                    distSq += diff * diff;
                }
                if (distSq < 1e-8) {
                    isTooClose = true;
                    break;
                }
            }
            if (isTooClose) {
                randomCandidatesRejected++;
                continue;
            }

            seenCandidateKeys.add(key);
            candidates.push(x);
            candidateSources.push({ type: "GLOBAL", regionId: -1 }); // Фикс 1: Пишем источник сразу
            randomCandidatesGenerated++;
        }

        localCandidatesGenerated = 0;
        let localAttempts = 0;
        const maxLocalAttempts = localExplorers * 5;
        const minimizeLoad = objective === "minimize_load";
        const activeRegions = searchRegions.filter(r => r.active);

        // Отслеживаем последовательные промахи (дубликаты) для каждого региона
        const regionConsecutiveMisses = new Map(activeRegions.map(r => [r.id, 0]));
        const exhaustedRegionIds = new Set();
        const MAX_MISSES_PER_REGION = 45;

        const buildRegionWeights = () => {
            let total = 0;
            const list = [];
            for (const reg of activeRegions) {
                if (exhaustedRegionIds.has(reg.id)) continue;
                const score = getRegionPriority(reg);
                total += score;
                list.push({ reg, score });
            }
            return { list, total };
        };

        let { list: regionWeights, total: totalRegionScore } = buildRegionWeights();

        while (
            localCandidatesGenerated < localExplorers &&
            localAttempts < maxLocalAttempts &&
            regionWeights.length > 0
            ) {
            localAttempts++;

            let region = null;
            if (totalRegionScore > 0) {
                let rouletteSlot = Math.random() * totalRegionScore;
                for (const item of regionWeights) {
                    rouletteSlot -= item.score;
                    if (rouletteSlot <= 0) { region = item.reg; break; }
                }
            }
            if (!region) {
                region = regionWeights[(localAttempts - 1) % regionWeights.length].reg;
            }

            const basePoint = region.bestX;
            const mutatedX = new Float64Array(numParams);
            const regionScales = objective === "minimize_load"
                ? (region.loadLengthScales || globalGPState.loadLengthScales)
                : (region.errorLengthScales || globalGPState.errorLengthScales);

            const useDirectional = Boolean(region.rawDirection) && Math.random() < 0.35;

            if (useDirectional) {
                const scaledDir = new Float64Array(numParams);
                let normSq = 0;

                for (let d = 0; d < numParams; d++) {
                    const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
                    const sDiff = region.rawDirection[d] / scale;
                    scaledDir[d] = sDiff;
                    normSq += sDiff * sDiff;
                }

                const rmsNormSq = normSq / numParams;

                if (rmsNormSq > 1e-12) {
                    const invRmsNorm = 1 / Math.sqrt(rmsNormSq);
                    const step = region.radius * (0.3 + 0.9 * Math.random());

                    for (let d = 0; d < numParams; d++) {
                        const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
                        const offset = (scaledDir[d] * invRmsNorm) * step * scale;
                        mutatedX[d] = Math.max(0, Math.min(1, basePoint[d] + offset));
                    }
                } else {
                    for (let d = 0; d < numParams; d++) {
                        const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
                        mutatedX[d] = Math.max(0, Math.min(1, basePoint[d] + (Math.random() * 2 - 1) * region.radius * scale));
                    }
                }
            } else {
                for (let d = 0; d < numParams; d++) {
                    const scale = Math.max(0.05, Math.min(1.5, regionScales?.[d] ?? 0.55));
                    const offset = (Math.random() * 2 - 1) * region.radius * scale;
                    mutatedX[d] = Math.max(0, Math.min(1, basePoint[d] + offset));
                }
            }

            const q = quantizeCandidate(mutatedX);

            if (q && !seenCandidateKeys.has(q.key)) {
                candidates.push(q.x);
                candidateSources.push({
                    type: useDirectional ? "LOCAL_DIRECTIONAL" : "LOCAL",
                    regionId: region.id
                });
                seenCandidateKeys.add(q.key);
                localCandidatesGenerated++;
                regionConsecutiveMisses.set(region.id, 0);
            } else {
                localCandidatesRejected++;
                const misses = (regionConsecutiveMisses.get(region.id) || 0) + 1;
                regionConsecutiveMisses.set(region.id, misses);

                // Если вокруг региона 45 раз подряд попадаем в уже проверенные узлы сетки — исключаем его на этом шаге
                if (misses >= MAX_MISSES_PER_REGION) {
                    exhaustedRegionIds.add(region.id);
                    ({ list: regionWeights, total: totalRegionScore } = buildRegionWeights());
                }
            }
        }


        // --------------------------------------------------------
        // ACQUISITION FUNCTION
        // --------------------------------------------------------

        let bestAcquisition = -Infinity;
        let nextBestX = null;
        let bestCandidateStats = null;
        let selectedIndexInPool = -1; // Фикс 2: Объявляем переменную трекинга индекса

        let invalidPredictionCount = 0;
        let zeroSigmaCount = 0;
        let nonFiniteEICount = 0;

        const constraintLoadTarget = maxAllowedLoad;
        const constraintErrorTarget = maxAllowedErrorScore;

        let bestFeasibilityX = null;
        let bestFeasibilityStats = null;
        let bestFeasibilityScore = -Infinity;
        let bestFeasibilitySelectedScore = -Infinity;
        let selectedFeasibilityIndexInPool = -1;

        const FEASIBILITY_TIE_EPSILON = 1e-9;

        const activeRegionMap = new Map(activeRegions.map(r => [r.id, r]));

        if (!globalDualGP?.valid) {
            throw new Error("GLOBAL_GP_INVALID: Cannot predict candidates");
        }

        for (let c = 0; c < candidates.length; c++) {
            const candX = candidates[c];
            const candSource = candidateSources[c];

            // Выбираем модель: Regional GP для кандидатов региона (с fallback на Global GP)
            let activeDualModel = globalDualGP;
            let ownerRegion = null;

            if (candSource && candSource.regionId >= 0) {
                ownerRegion = activeRegionMap.get(candSource.regionId) || null;
                if (ownerRegion?.dualGP?.valid) {
                    activeDualModel = ownerRegion.dualGP;
                }
            }

            const predictionPair = predictDualGaussianProcess(
                activeDualModel,
                candX,
                loadSigmaCalibration,
                errorSigmaCalibration
            );

            if (!predictionPair) {
                invalidPredictionCount++;
                continue;
            }

            const { loadPrediction, errorPrediction } = predictionPair;

            const pLoad = probabilityBelow(loadPrediction, constraintLoadTarget);
            const pError = probabilityBelow(errorPrediction, constraintErrorTarget);
            const pFeasible = jointProbabilityBelow(
                loadPrediction,
                errorPrediction,
                constraintLoadTarget,
                constraintErrorTarget,
                residualCorrelation.rho
            );

            const objectivePrediction = minimizeLoad ? loadPrediction : errorPrediction;
            const sigmaObjective = objectivePrediction.sigmaLog;

            const feasibilityScore = pFeasible;
            bestFeasibilityScore = Math.max(bestFeasibilityScore, feasibilityScore);

            const SAFE_FEASIBILITY_THRESHOLD = 0.45;
            const isCandSafe = feasibilityScore >= SAFE_FEASIBILITY_THRESHOLD;
            const isBestSafe = bestFeasibilitySelectedScore >= SAFE_FEASIBILITY_THRESHOLD;

            const candMetric = minimizeLoad ? (Math.exp(loadPrediction.meanLog) - 1) : (Math.exp(errorPrediction.meanLog) - 1);
            const bestMetric = bestFeasibilityStats ? (minimizeLoad ? (Math.exp(bestFeasibilityStats.loadPrediction.meanLog) - 1) : (Math.exp(bestFeasibilityStats.errorPrediction.meanLog) - 1)) : Infinity;

            const isFirstCandidate = (bestFeasibilityX === null);
            const isStrictlyBetterFeasibility = (feasibilityScore > bestFeasibilitySelectedScore + FEASIBILITY_TIE_EPSILON);
            const isFeasibilityTie = Math.abs(feasibilityScore - bestFeasibilitySelectedScore) <= FEASIBILITY_TIE_EPSILON;

            let betterFeasibility = false;
            if (isFirstCandidate) {
                betterFeasibility = true;
            } else if (isCandSafe && isBestSafe) {
                betterFeasibility = candMetric < bestMetric;
            } else if (isCandSafe !== isBestSafe) {
                betterFeasibility = isCandSafe;
            } else {
                betterFeasibility = isStrictlyBetterFeasibility || (isFeasibilityTie && candMetric < bestMetric);
            }

            if (betterFeasibility) {
                bestFeasibilitySelectedScore = feasibilityScore;
                bestFeasibilityX = candX;
                selectedFeasibilityIndexInPool = c;
                bestFeasibilityStats = {
                    loadPrediction,
                    errorPrediction,
                    pLoad,
                    pError,
                    pFeasible,
                    constraintProbability: pFeasible,
                    ei: null,
                    acquisition: pFeasible,
                    objectivePrediction,
                    sigmaObjective
                };
            }

            if (sigmaObjective <= 1e-9) {
                zeroSigmaCount++;
            }

            if (hasFeasibleResult) {
                const constraintPrediction = minimizeLoad ? errorPrediction : loadPrediction;
                const constraintLimit = minimizeLoad ? constraintErrorTarget : constraintLoadTarget;

                const ei = calculateConstrainedLogNormalEI(
                    bestObjective,
                    objectivePrediction,
                    constraintPrediction,
                    constraintLimit,
                    residualCorrelation.rho
                );

                if (!Number.isFinite(ei)) {
                    nonFiniteEICount++;
                    continue;
                }

                const acquisition = ei;

                // Для crowding используем актуальные масштабы той модели, которая оценивает кандидата
                const activeScales = (ownerRegion && activeDualModel === ownerRegion.dualGP)
                    ? (minimizeLoad ? ownerRegion.loadLengthScales : ownerRegion.errorLengthScales)
                    : (minimizeLoad ? globalGPState.loadLengthScales : globalGPState.errorLengthScales);

                let crowding = 0;
                for (let i = 0; i < observedX.length; i++) {
                    const dKernel = calculateKernelDistance(candX, observedX[i], activeScales);
                    if (dKernel < 0.25) {
                        crowding += (1.0 - dKernel / 0.25) * 0.25;
                    }
                }

                const clampedPenalty = Math.min(0.85, crowding);
                const balancedAcquisition = acquisition * (1.0 - clampedPenalty);

                if (balancedAcquisition > bestAcquisition) {
                    bestAcquisition = balancedAcquisition;
                    nextBestX = candX;
                    selectedIndexInPool = c;

                    bestCandidateStats = {
                        loadPrediction,
                        errorPrediction,
                        pLoad,
                        pError,
                        pFeasible,
                        constraintProbability: minimizeLoad ? pError : pLoad,
                        ei,
                        acquisition: balancedAcquisition,
                        objectivePrediction,
                        sigmaObjective,
                        bestLogTarget: Math.log1p(bestObjective)
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
                        errorPrediction,
                        pLoad,
                        pError,
                        pFeasible,
                        ei: null,
                        acquisition,
                        objectivePrediction,
                        sigmaObjective
                    };
                }
            }
        }


        // Фиксируем максимальный EI до возможного переключения в режим разведки
        const maxPoolEI = bestCandidateStats?.ei ?? 0;

        // --------------------------------------------------------
        // CONTROLLED FEASIBILITY EXPLORATION
        // --------------------------------------------------------

        let selectionMethod = hasFeasibleResult
            ? "CONSTRAINED_EXPECTED_IMPROVEMENT"
            : "FEASIBILITY_SEARCH";

        let selectionFallbackReason = null;

        // Минимальный порог относительного улучшения (0.01% от текущего рекорда)
        const MIN_SIGNIFICANT_EI = 1e-4;

        if (
            hasFeasibleResult &&
            bestFeasibilityX
        ) {
            const selectedFeasibility = bestCandidateStats?.pFeasible ?? 0;
            const dynamicFeasibilityInterval = Math.min(20, Math.floor(14 + (currentExecutionCount / 20)));
            const periodicExploration = bayesianDecisionCount % dynamicFeasibilityInterval === 0;

            const candidateSourceType = selectedIndexInPool >= 0
                ? candidateSources[selectedIndexInPool]?.type
                : null;
            const isLocalCandidate =
                candidateSourceType === "LOCAL" ||
                candidateSourceType === "LOCAL_DIRECTIONAL";

            const minFeasibilityFloor = isLocalCandidate ? 0.0005 : 0.015;

            const lowFeasibility =
                selectedFeasibility < minFeasibilityFloor &&
                bestFeasibilityScore - selectedFeasibility >= 0.25;

            const noPositiveEI =
                bestAcquisition < MIN_SIGNIFICANT_EI;

            if (
                periodicExploration ||
                lowFeasibility ||
                noPositiveEI
            ) {
                // Если EI исчерпан или идет плановая разведка, ищем лучшую допустимую точку среди GLOBAL кандидатов
                let globalFeasibilityIdx = -1;
                let bestGlobalFeasScore = -Infinity;

                for (let c = 0; c < candidates.length; c++) {
                    if (candidateSources[c]?.type === "GLOBAL") {
                        const pred = predictDualGaussianProcess(
                            globalDualGP,
                            candidates[c],
                            loadSigmaCalibration,
                            errorSigmaCalibration
                        );
                        if (!pred) continue;

                        const pFeas = jointProbabilityBelow(
                            pred.loadPrediction,
                            pred.errorPrediction,
                            constraintLoadTarget,
                            constraintErrorTarget,
                            residualCorrelation.rho
                        );

                        // Добавляем бонус за неопределенность (sigma), чтобы исследовать белые пятна
                        const objSigma = minimizeLoad
                            ? pred.loadPrediction.sigmaLog
                            : pred.errorPrediction.sigmaLog;
                        const exploreScore = pFeas + 0.05 * Math.min(2.0, objSigma);

                        if (exploreScore > bestGlobalFeasScore) {
                            bestGlobalFeasScore = exploreScore;
                            globalFeasibilityIdx = c;
                        }
                    }
                }

                // Используем глобального кандидата для разведки, если нашли подходящего; иначе — общий bestFeasibilityX
                if ((noPositiveEI || periodicExploration) && globalFeasibilityIdx >= 0) {
                    const gPred = predictDualGaussianProcess(
                        globalDualGP,
                        candidates[globalFeasibilityIdx],
                        loadSigmaCalibration,
                        errorSigmaCalibration
                    );
                    const pLoad = probabilityBelow(gPred.loadPrediction, constraintLoadTarget);
                    const pError = probabilityBelow(gPred.errorPrediction, constraintErrorTarget);
                    const pFeasible = jointProbabilityBelow(
                        gPred.loadPrediction,
                        gPred.errorPrediction,
                        constraintLoadTarget,
                        constraintErrorTarget,
                        residualCorrelation.rho
                    );

                    nextBestX = candidates[globalFeasibilityIdx];
                    selectedIndexInPool = globalFeasibilityIdx;
                    bestAcquisition = pFeasible;
                    bestCandidateStats = {
                        loadPrediction: gPred.loadPrediction,
                        errorPrediction: gPred.errorPrediction,
                        pLoad,
                        pError,
                        pFeasible,
                        constraintProbability: pFeasible,
                        ei: null,
                        acquisition: pFeasible,
                        objectivePrediction: minimizeLoad ? gPred.loadPrediction : gPred.errorPrediction,
                        sigmaObjective: minimizeLoad ? gPred.loadPrediction.sigmaLog : gPred.errorPrediction.sigmaLog
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


        // --------------------------------------------------------
        // LOGGING / PENDING DECISION
        // --------------------------------------------------------

        const stats = bestCandidateStats;


        const completeObservationCount =
            observedIsComplete.filter(Boolean).length;

        const abortObservationCount =
            observedIsComplete.length -
            completeObservationCount;

        pendingDecision = {
            method: selectionMethod,
            fallbackReason: selectionFallbackReason,
            objective: objective,
            sourceDiagnostics: chosenSource,
            isGlobalExploration: chosenSource.type === "GLOBAL", // Флаг для updateTrustRegions

            training: {
                observations: N,

                completeObservations:
                completeObservationCount,

                abortObservations:
                abortObservationCount,

                feasibleObservations:
                observedLoad.filter(
                    (load, i) =>
                        observedIsComplete[i] &&
                        load <= maxAllowedLoad &&
                        observedError[i] <=
                        maxAllowedErrorScore
                ).length,

                excludedFromElite:
                abortObservationCount,

                hasFeasibleResult
            },

            gaussianProcess: {
                kernel: "Matern5/2",

                load: {
                    lengthScales:
                        Array.from(loadGP.lengthScales),

                    yMean: loadGP.yMean,
                    yStd: loadGP.yStd,

                    jitter: loadGP.jitter,
                    jitterRetries: loadGP.jitterRetries
                },

                error: {
                    lengthScales:
                        Array.from(errorGP.lengthScales),

                    yMean: errorGP.yMean,
                    yStd: errorGP.yStd,

                    jitter: errorGP.jitter,
                    jitterRetries: errorGP.jitterRetries
                }
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

            residualCorrelation: {
                rho: residualCorrelation.rho,
                rawRho: residualCorrelation.rawRho,
                samples: residualCorrelation.samples
            },

            sigmaCalibration: {
                load: loadSigmaCalibration,
                error: errorSigmaCalibration,
                samples: residualPairs.length
            },

            // Используем именно тот прогноз, на основании
            // которого выбрана точка.
            predictionForResidual: stats
                ? {
                    loadMeanLog:
                    stats.loadPrediction.meanLog,

                    loadSigmaLog:
                    stats.loadPrediction.rawSigmaLog,

                    errorMeanLog:
                    stats.errorPrediction.meanLog,

                    errorSigmaLog:
                    stats.errorPrediction.rawSigmaLog
                }
                : null,

            // ЗАМЕНИТЬ ВНУТРИ pendingDecision.prediction
            // ИСПРАВЛЕНО: Чистая физическая медиана распределения GP без паники
            prediction: stats
                ? {
                    load: {
                        meanLog: stats.loadPrediction.meanLog,
                        sigmaLog: stats.loadPrediction.sigmaLog,
                        predictedMean: Math.exp(stats.loadPrediction.meanLog) - 1
                    },
                    error: {
                        meanLog: stats.errorPrediction.meanLog,
                        sigmaLog: stats.errorPrediction.sigmaLog,
                        predictedMean: Math.exp(stats.errorPrediction.meanLog) - 1 // Исправлен вызов stats.
                    },
                    pLoad: stats.pLoad,
                    pError: stats.pError,
                    pFeasible: stats.pFeasible,
                    eiObjective: stats.ei,
                    acquisition: stats.acquisition,
                    objective: minimizeLoad ? "load" : "error"
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

            stepNumber:
                currentExecutionCount + 1,

            selectionMethod,
            fallbackReason:
            selectionFallbackReason,

            candidatesEvaluated:
            candidates.length,

            bestAcquisitionScore:
            bestAcquisition,

            bestFeasibilityScore,

            chosenSource: chosenSource.type,
            chosenRegionId: chosenSource.regionId,


            // ГЛУБОКАЯ ДИАГНОСТИКА: Показывает, сколько кандидатов отсеялось на этапе генерации
            poolDiagnostics: {
                totalCandidatesInPool: candidates.length,
                randomGenerated: (pendingDecision?.candidates?.generatedRandom ?? 0),
                randomRejected: (pendingDecision?.candidates?.rejectedRandom ?? 0),
                localGenerated: (pendingDecision?.candidates?.generatedLocal ?? 0),
                localRejected: (pendingDecision?.candidates?.rejectedLocal ?? 0),
                localAttemptsUsed: (pendingDecision?.candidates?.localAttempts ?? 0)
            },

            residualCorrelation: {
                rho: residualCorrelation.rho,
                rawRho: residualCorrelation.rawRho,
                samples: residualCorrelation.samples
            },

            sigmaCalibration: {
                load: loadSigmaCalibration,
                error: errorSigmaCalibration,
                samples: residualPairs.length
            },

            metricsCounter: {
                invalidPredictions:
                invalidPredictionCount,

                zeroSigma:
                zeroSigmaCount,

                nonFiniteEI:
                nonFiniteEICount
            },

            // ИСПРАВЛЕНО: Выводим в лог честную медиану без математического взрыва
            selectedCandidatePrediction: stats
                ? {
                    predictedLoad: Math.exp(stats.loadPrediction.meanLog) - 1,
                    predictedError: Math.exp(stats.errorPrediction.meanLog) - 1,

                    probabilityLoadFeasible: stats.pLoad,
                    probabilityErrorFeasible: stats.pError,
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
                idleSteps: stepCountSnapshot - reg.lastImprovementStep,
                modelStatus: reg.localTrainingStats || { usingFallback: true },
                ...(reg.attempts > 1 && reg.errorLengthScales ? {
                    localErrorScales: Array.from(reg.errorLengthScales),
                    localErrorLML: reg.dualGP?.errorModel?.logMarginalLikelihood ?? null
                } : {})
            })),        });

        const stepBeforeEval = self.lastEvaluatedBestStepNumber;

        evaluate(
            resolvedSelectedPhysical,
            nextBestX
        );

        // 1. Обновляем счетчик стагнации глобального рекорда
        if (self.lastEvaluatedBestStepNumber && self.lastEvaluatedBestStepNumber > (stepBeforeEval || 0)) {
            stepsWithoutGlobalImprovement = 0;
        } else {
            stepsWithoutGlobalImprovement++;
        }

        // 2. Отслеживаем исчерпание ожидаемого улучшения (EI < 0.25%)
        const EI_EXHAUSTION_THRESHOLD = 0.0025;
        if (selectionMethod === "CONSTRAINED_EXPECTED_IMPROVEMENT") {
            if (Number.isFinite(maxPoolEI) && maxPoolEI < EI_EXHAUSTION_THRESHOLD) {
                lowEIConsecutiveCount++;
            } else {
                lowEIConsecutiveCount = 0;
            }
        } else if (selectionFallbackReason === "NON_POSITIVE_CONSTRAINED_EI") {
            lowEIConsecutiveCount++;
        }

        // 3. Проверяем условия автоматической досрочной остановки по сходимости
        if (
            gBestMetrics &&
            currentExecutionCount >= minStepsBeforeEarlyStop &&
            stepsWithoutGlobalImprovement >= earlyStopPatience
        ) {
            const leaderRegion = searchRegions.find(r => r.active && isGlobalLeaderRegion(r));
            const leaderConverged = !leaderRegion || leaderRegion.radius <= 0.025;
            const eiExhausted = lowEIConsecutiveCount >= 12;
            // Защита от бесконечных циклов разведки: если рекорд не бьется 1.5x от patience при низком EI
            const deepStagnation =
                stepsWithoutGlobalImprovement >= Math.floor(earlyStopPatience * 1.5) &&
                lowEIConsecutiveCount >= 6;

            if ((leaderConverged && eiExhausted) || deepStagnation) {
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

                break;
            }
        }
    }

    // ------------------------------------------------------------
    // FINAL RESULT
    // ------------------------------------------------------------

    const finalPhysical =
        gBestPhysical || fallbackPhysical;

    const finalMetrics =
        gBestMetrics || fallbackMetrics;

    if (!finalPhysical || !finalMetrics) {
        throw new Error(
            "Оптимизация не получила ни одного корректного завершённого результата симуляции."
        );
    }

    const finalLoad = gBestMetrics
        ? gBestLoad
        : fallbackLoad;

    const finalError = gBestMetrics
        ? gBestError
        : fallbackError;

    emitStepLog({
        type: "OPTIMIZER_FINISHED",
        totalSteps: currentExecutionCount,
        objective,

        result: {
            params: finalPhysical,
            achievedLoad: finalLoad,
            resultingErrorScore: finalError,
            isFallbackActivated: !gBestMetrics,

            bestStep:
            self.lastEvaluatedBestStepNumber
        },

        training: {
            observations: observedX.length,

            completeObservations:
            observedIsComplete.filter(Boolean).length,

            abortObservations:
            observedIsComplete.filter(
                value => !value
            ).length,

            loadObservations:
            observedLogLoad.length,

            errorObservations:
            observedLogError.length
        }
    });

    return {
        optimalLimits: finalPhysical,

        metrics: {
            achievedLoad:
                finalLoad ?? maxAllowedLoad,

            resultingErrorScore:
                finalError ?? 1e10,

            searchStepsMade:
            currentExecutionCount,

            isFallbackActivated:
                !gBestMetrics,

            appliedObjective:
            objective,

            bestStepNumber:
            self.lastEvaluatedBestStepNumber,

            technicalMetrics:
            finalMetrics
        },

        diagnosticLogText: diag.getText(),

        resumeState: {
            currentExecutionCount,
            sobolDraws: sobolDrawsCount,
            lastEMAStorage: self.lastEMAStorage,
            evaluatedKeys: Array.from(evaluatedKeys),
            observedX,
            observedLoad,
            observedError,
            observedLogLoad,
            observedLogError,
            observedLoadNoise,
            observedErrorNoise,
            observedRegionIds,
            observedIsComplete,
            residualPairs,
            searchRegions,
            globalGPState,
            gBestMetrics,
            gBestPhysical,
            gBestLoad,
            gBestError,
            lastEvaluatedBestParams: self.lastEvaluatedBestParams,
            lastEvaluatedBestMetrics: self.lastEvaluatedBestMetrics,
            lastEvaluatedBestStepNumber: self.lastEvaluatedBestStepNumber,
            fallbackMetrics,
            fallbackPhysical,
            fallbackLoad,
            fallbackError,
            fallbackViolation,
            fallbackObjective
        }
    };
}

