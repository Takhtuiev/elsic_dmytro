/* eslint-disable no-restricted-globals */

function rbfKernel(x1, x2, lengthScales) {
    if (
        !x1 ||
        !x2 ||
        !lengthScales ||
        x1.length !== x2.length ||
        x1.length !== lengthScales.length
    ) {
        return NaN;
    }

    let distance = 0;

    for (let i = 0; i < x1.length; i++) {
        const scale = lengthScales[i];

        if (
            !Number.isFinite(x1[i]) ||
            !Number.isFinite(x2[i]) ||
            !Number.isFinite(scale) ||
            scale <= 0
        ) {
            return NaN;
        }

        const diff = (x1[i] - x2[i]) / scale;
        distance += diff * diff;
    }

    return Number.isFinite(distance)
        ? Math.exp(-0.5 * distance)
        : NaN;
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

        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, target - predictedValue)
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

        const improvement = Number.isFinite(predictedValue)
            ? Math.max(0, target - predictedValue)
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
        scales.fill(0.65);
        return scales;
    }

    for (let d = 0; d < numParams; d++) {
        const differences = [];

        for (let i = 0; i < X.length; i++) {
            if (!X[i] || X[i].length !== numParams) {
                scales[d] = 0.65;
                continue;
            }

            for (let j = i + 1; j < X.length; j++) {
                if (!X[j] || X[j].length !== numParams) continue;

                const a = X[i][d];
                const b = X[j][d];

                if (
                    !Number.isFinite(a) ||
                    !Number.isFinite(b)
                ) {
                    continue;
                }

                const diff = Math.abs(a - b);

                if (diff > 1e-9) {
                    differences.push(diff);
                }
            }
        }

        if (!differences.length) {
            scales[d] = 0.65;
            continue;
        }

        differences.sort((a, b) => a - b);

        const median = differences[
            Math.floor(differences.length / 2)
            ];

        scales[d] = Math.max(
            0.35,
            Math.min(1.25, median * 2)
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

function optimizeLengthScales(X, Y, noise, numParams) {
    const MIN_SCALE = 0.10;
    const MAX_SCALE = 2.0;
    const MAX_SAMPLES = 80;
    const MAX_PASSES = 2;

    if (
        !Array.isArray(X) ||
        !Array.isArray(Y) ||
        !Array.isArray(noise) ||
        X.length === 0 ||
        X.length !== Y.length ||
        X.length !== noise.length ||
        !Number.isInteger(numParams) ||
        numParams < 1
    ) {
        return estimateLengthScales(
            Array.isArray(X) ? X : [],
            Number.isInteger(numParams) && numParams > 0
                ? numParams
                : 1
        );
    }

    let sampleX = X;
    let sampleY = Y;
    let sampleNoise = noise;

    if (X.length > MAX_SAMPLES) {
        const indices = selectDiverseIndices(X, MAX_SAMPLES);

        sampleX = indices.map(i => X[i]);
        sampleY = indices.map(i => Y[i]);
        sampleNoise = indices.map(i => noise[i]);
    }

    const initialScales = estimateLengthScales(
        sampleX,
        numParams
    );

    const scales = new Float64Array(numParams);

    for (let d = 0; d < numParams; d++) {
        scales[d] = Math.max(
            MIN_SCALE,
            Math.min(MAX_SCALE, initialScales[d])
        );
    }

    const evaluate = candidateScales => {
        const model = fitGaussianProcess(
            sampleX,
            sampleY,
            sampleNoise,
            candidateScales
        );

        if (
            !model?.valid ||
            !Number.isFinite(model.logMarginalLikelihood)
        ) {
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
                Math.max(MIN_SCALE, originalScale * 0.65),
                Math.min(MAX_SCALE, originalScale * 1.5)
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

function fitGaussianProcess(X, Y, noise, lengthScales) {
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
        lengthScales.length === 0
    ) {
        return invalidModel("INVALID_INPUT_DIMENSIONS");
    }

    const N = X.length;
    const dimensions = lengthScales.length;

    for (let d = 0; d < dimensions; d++) {
        if (
            !Number.isFinite(lengthScales[d]) ||
            lengthScales[d] <= 0
        ) {
            return invalidModel("INVALID_LENGTH_SCALE");
        }
    }

    for (let i = 0; i < N; i++) {
        if (
            !X[i] ||
            X[i].length !== dimensions
        ) {
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

        if (
            !Number.isFinite(noise[i]) ||
            noise[i] < 0
        ) {
            return invalidModel("INVALID_NOISE");
        }
    }

    let yMean = 0;

    for (let i = 0; i < N; i++) {
        yMean += (Y[i] - yMean) / (i + 1);
    }

    if (!Number.isFinite(yMean)) {
        return invalidModel("INVALID_TARGET_MEAN");
    }

    let yVariance = 0;

    for (let i = 0; i < N; i++) {
        const diff = Y[i] - yMean;
        yVariance += diff * diff;
    }

    yVariance /= N;

    if (!Number.isFinite(yVariance) || yVariance < 0) {
        return invalidModel("INVALID_TARGET_VARIANCE");
    }

    const yStd = Math.sqrt(yVariance);

    // Нижний предел масштаба не позволяет почти постоянным Y
    // искусственно получать sigma порядка единицы.
    const MIN_Y_STD = 1e-6;
    const safeYStd = Math.max(yStd, MIN_Y_STD);

    const normalizedY = new Float64Array(N);

    for (let i = 0; i < N; i++) {
        normalizedY[i] = (Y[i] - yMean) / safeYStd;

        if (!Number.isFinite(normalizedY[i])) {
            return invalidModel("INVALID_NORMALIZED_TARGET");
        }
    }

    const K = Array.from(
        { length: N },
        () => new Float64Array(N)
    );

    for (let i = 0; i < N; i++) {
        for (let j = 0; j <= i; j++) {
            const value = rbfKernel(
                X[i],
                X[j],
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
            // noise задаётся как дисперсия наблюдения
            // в нормализованном пространстве GP.
            K[i][i] = 1 + noise[i] + jitter;
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
        X,
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
        kStar[i] = rbfKernel(
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

function estimateResidualSigmaScale(pairs, key) {
    const PRIOR_COUNT = 20;

    if (!Array.isArray(pairs) || pairs.length === 0) {
        return 1;
    }

    let sumSquares = 0;
    let validCount = 0;

    for (const pair of pairs) {
        const value = pair?.[key];

        if (Number.isFinite(value)) {
            sumSquares += value * value;
            validCount++;
        }
    }

    if (!validCount || !Number.isFinite(sumSquares)) {
        return 1;
    }

    const scale = Math.sqrt(
        (PRIOR_COUNT + sumSquares) /
        (PRIOR_COUNT + validCount)
    );

    return Number.isFinite(scale)
        ? Math.max(0.75, Math.min(3, scale))
        : 1;
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
                if ((a >>> (s - 1 - k)) && 1) {
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

export function optimizeForMaxSpeed(
    baseParams,
    simulateFn,
    options = {}
) {
    let currentExecutionCount = 0;

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

    const requestedIterations =
        options.totalBudgetIterations ?? 40;

    const requestedInitialPoints =
        options.randomInitPoints ?? 12;

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

    const totalIterations = Math.floor(requestedIterations);

    // Нужна хотя бы одна начальная точка для обучения GP.
    const initPointsCount = Math.min(
        totalIterations,
        Math.max(1, Math.floor(requestedInitialPoints))
    );

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

    const integerParamKeys = new Set(["maxIter"]);

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

        if (integerParamKeys.has(key)) {
            const minInteger = Math.ceil(range.min);
            const maxInteger = Math.floor(range.max);

            if (minInteger > maxInteger) {
                throw new Error(
                    "Для целочисленного параметра " +
                    key +
                    " нет допустимых целых значений."
                );
            }
        }
    }

    if (
        !Object.prototype.hasOwnProperty.call(config, "gridX") ||
        !Object.prototype.hasOwnProperty.call(config, "minGrid")
    ) {
        throw new Error(
            "Для проверки сетки необходимы параметры gridX и minGrid."
        );
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

    self.lastEvaluatedBestParams = null;
    self.lastEvaluatedBestMetrics = null;
    self.lastEvaluatedBestStepNumber = null;

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

            if (integerParamKeys.has(key)) {
                const minInteger = Math.ceil(range.min);
                const maxInteger = Math.floor(range.max);

                const physicalValue =
                    range.min + x * (range.max - range.min);

                const integerValue = Math.max(
                    minInteger,
                    Math.min(
                        maxInteger,
                        Math.round(physicalValue)
                    )
                );

                result[i] = Math.max(
                    0,
                    Math.min(
                        1,
                        (integerValue - range.min) /
                        (range.max - range.min)
                    )
                );
            } else {
                result[i] = x;
            }
        }

        return result;
    };

    const toPhysical = xNorm => {
        const canonicalX = canonicalizeNormalized(xNorm);
        const result = {};

        paramKeys.forEach((key, idx) => {
            const range = config[key];

            let value =
                range.min +
                canonicalX[idx] * (range.max - range.min);

            if (integerParamKeys.has(key)) {
                value = Math.round(value);
            }

            result[key] = value;
        });

        return result;
    };

    const isValidPhysical = physical => (
        Number.isFinite(physical?.gridX) &&
        Number.isFinite(physical?.minGrid) &&
        physical.minGrid < physical.gridX
    );

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

    const getPhysicalKey = xNorm => {
        const physical = toPhysical(xNorm);

        return paramKeys
            .map(key => String(physical[key]))
            .join("|");
    };

    const evaluatedKeys = new Set();

    const nextSobolPoint =
        createSobolGenerator(numParams);

    const generateRandomPoint = (
        seenKeys = null,
        maxAttempts = 100
    ) => {
        for (
            let attempt = 0;
            attempt < maxAttempts;
            attempt++
        ) {
            const rawX = new Float64Array(numParams);

            for (let i = 0; i < numParams; i++) {
                rawX[i] = Math.random();
            }

            const x = canonicalizeNormalized(rawX);
            const physical = toPhysical(x);

            if (!isValidPhysical(physical)) continue;

            const key = getPhysicalKey(x);

            if (seenKeys && seenKeys.has(key)) {
                continue;
            }

            if (seenKeys) {
                seenKeys.add(key);
            }

            return { x, physical, key };
        }

        return null;
    };

    const observedX = [];
    const observedLoad = [];
    const observedError = [];
    const observedLogLoad = [];
    const observedLogError = [];
    const observedLoadNoise = [];
    const observedErrorNoise = [];

    // false = частичное ABORT-наблюдение.
    // true = полностью завершённая симуляция.
    // ABORT остаётся в обучении GP, но не участвует в элитных точках.
    const observedIsComplete = [];

    const residualPairs = [];
    const MAX_RESIDUAL_PAIRS = 100;

    const MIN_ABORT_TRAINING_PROGRESS = 5;
    const MAX_ABORT_PROGRESS_PERCENT = 50;

    const MIN_ABORT_NOISE = 0.0005;
    const ABORT_NOISE_START_PROGRESS = 5;
    const ABORT_NOISE_END_PROGRESS = 100;

    function getAbortNoiseByProgress(percent, maxNoise) {
        if (!Number.isFinite(percent)) {
            return maxNoise;
        }

        const p = Math.max(
            ABORT_NOISE_START_PROGRESS,
            Math.min(ABORT_NOISE_END_PROGRESS, percent)
        );

        const t = (
            ABORT_NOISE_END_PROGRESS - p
        ) / (
            ABORT_NOISE_END_PROGRESS - ABORT_NOISE_START_PROGRESS
        );

        return MIN_ABORT_NOISE +
            (maxNoise - MIN_ABORT_NOISE) * t * t;
    }

    function getAbortErrorNoise(percent) {
        return getAbortNoiseByProgress(percent, 0.015);
    }

    function getAbortLoadNoise(isPredicted, percent) {
        return getAbortNoiseByProgress(
            percent,
            isPredicted ? 0.10 : 0.05
        );
    }


    let gBestMetrics = null;
    let gBestPhysical = null;
    let gBestLoad = Infinity;
    let gBestError = Infinity;

    let fallbackMetrics = null;
    let fallbackPhysical = null;
    let fallbackLoad = Infinity;
    let fallbackError = Infinity;
    let fallbackViolation = Infinity;
    let fallbackObjective = Infinity;

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

    const emitStepLog = record => {
        try {
            console.log(
                JSON.stringify(formatLogValues(record))
            );
        } catch (e) {
            console.error(
                "Optimizer log serialization failed:",
                e
            );
        }
    };

    const emitStructuredLog = (
        stepMode,
        message,
        snapshot
    ) => {
        if (
            typeof self.optimizerStructuredLogger !== "function"
        ) {
            return;
        }

        try {
            self.optimizerStructuredLogger(
                stepMode,
                message,
                snapshot
            );
        } catch (e) {
            console.error(
                "Structured logger failed:",
                e
            );
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

        // При нулевом допустимом error используем абсолютное
        // нарушение, чтобы не делить на искусственные 1e-12.
        const errorViolation = maxAllowedErrorScore === 0
            ? Math.max(0, error)
            : Math.max(
                0,
                (error - maxAllowedErrorScore) /
                maxAllowedErrorScore
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

    const evaluate = (
        paramsObj,
        normX,
        customTag = null
    ) => {
        normX = canonicalizeNormalized(normX);
        paramsObj = toPhysical(normX);

        const physicalKey = getPhysicalKey(normX);

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
            ? customTag.startsWith("PRESET_")
                ? "PRESET"
                : customTag.startsWith("RANDOM_INIT_")
                    ? "RANDOM_INIT"
                    : customTag.startsWith("FALLBACK_")
                        ? "FALLBACK"
                        : "INIT"
            : "BAYES";

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

                if (percent > lastProgress) {
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

                    notifyProgress(
                        percent,
                        technicalMetrics,
                        abortInfo.reason
                    );

                    return true;
                };

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

                if (
                    percent <= MAX_ABORT_PROGRESS_PERCENT &&
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

                if (
                    percent <= MAX_ABORT_PROGRESS_PERCENT &&
                    predictedFinalLoad !== null
                ) {
                    if (
                        predictedFinalLoad > absoluteCeiling
                    ) {
                        predictedAbortCount++;
                    } else {
                        predictedAbortCount = 0;
                    }

                    if (
                        predictedAbortCount >=
                        REQUIRED_PREDICTED_ABORTS
                    ) {
                        return requestAbort({
                            reason:
                                "PREDICTED_LOAD_EXCEEDS_CEILING",
                            percent,
                            currentLoad,
                            predictedFinalLoad:
                                Math.round(predictedFinalLoad),
                            absoluteCeiling,
                            predictedAbortCount
                        });
                    }
                } else {
                    predictedAbortCount = 0;
                }

                notifyProgress(
                    percent,
                    technicalMetrics
                );

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

            const abortTrainingLoad = hasPredictedLoad
                ? abortPredictedLoad
                : abortCurrentLoad;

            const loadNoise = getAbortLoadNoise(
                hasPredictedLoad,
                abortProgress
            );

            const errorNoise = getAbortErrorNoise(abortProgress);

            // ABORT остаётся полноценной частью обучающих массивов GP.
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

            // Но ABORT не является завершённым результатом.
            observedIsComplete.push(false);
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

        return isValidObservation
            ? {
                load,
                errorScore,
                feasible: currentIsFeasible
            }
            : null;
    };

    // ------------------------------------------------------------
    // INITIAL PRESETS
    // ------------------------------------------------------------

    if (options.modelPresets) {
        const modesToLoad =
            Array.isArray(options.accuracyModes)
                ? options.accuracyModes
                : Object.keys(options.modelPresets);

        for (const presetKey of modesToLoad) {
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

    // ------------------------------------------------------------
    // BAYESIAN OPTIMIZATION
    // ------------------------------------------------------------

    const FEASIBILITY_EXPLORATION_INTERVAL = 5;
    const MIN_SELECTED_FEASIBILITY = 0.20;
    const MIN_FEASIBILITY_GAIN = 0.05;

    let bayesianDecisionCount = 0;
    let consecutiveMatrixFailures = 0;

    let loadLengthScales = null;
    let errorLengthScales = null;

    while (currentExecutionCount < totalIterations) {
        bayesianDecisionCount++;

        const N = observedX.length;

        if (N === 0) break;

        if (
            !loadLengthScales ||
            bayesianDecisionCount % 10 === 0
        ) {
            loadLengthScales = optimizeLengthScales(
                observedX,
                observedLogLoad,
                observedLoadNoise,
                numParams
            );

            errorLengthScales = optimizeLengthScales(
                observedX,
                observedLogError,
                observedErrorNoise,
                numParams
            );
        }

        const loadGP = fitGaussianProcess(
            observedX,
            observedLogLoad,
            observedLoadNoise,
            loadLengthScales
        );

        const errorGP = fitGaussianProcess(
            observedX,
            observedLogError,
            observedErrorNoise,
            errorLengthScales
        );

        if (!loadGP?.valid || !errorGP?.valid) {
            consecutiveMatrixFailures++;

            const fallback = generateRandomPoint(
                evaluatedKeys,
                300
            );

            if (
                !fallback ||
                consecutiveMatrixFailures >= 3
            ) {
                break;
            }

            pendingDecision = {
                method: "RANDOM_FALLBACK",
                reason: "GP_FIT_FAILED",

                loadGP: loadGP?.reason || "UNKNOWN",
                errorGP: errorGP?.reason || "UNKNOWN",

                trainingCount: N
            };

            evaluate(
                fallback.physical,
                fallback.x,
                "FALLBACK_GP_FAILED"
            );

            continue;
        }

        consecutiveMatrixFailures = 0;

        const hasFeasibleResult =
            Boolean(gBestMetrics);

        const bestObjective = hasFeasibleResult
            ? getObjectiveValue(gBestLoad, gBestError)
            : Infinity;

        // --------------------------------------------------------
        // CANDIDATE GENERATION (ЗАМЕНИТЬ ДАННЫЙ БЛОК)
        // --------------------------------------------------------
        const candidates = [];

        // Адаптивное скалирование размера сеток кандидатов
        const candidatesCount = Math.min(3000, 1000 + currentExecutionCount * 12);
        const localExplorers = Math.min(600, 150 + Math.floor(currentExecutionCount * 3.0));

        let randomCandidatesGenerated = 0;
        let randomCandidatesRejected = 0;

        let localCandidatesGenerated = 0;
        let localCandidatesRejected = 0;

        const seenCandidateKeys = new Set(evaluatedKeys);
        const maxSobolAttempts = candidatesCount * 10;
        let sobolAttempts = 0;

        // ВЫНЕЙСЕНО СЮДА ИЗ СЕКЦИИ ACQUISITION (Устраняет ошибку "not defined")
        const residualCorrelation = estimateResidualCorrelation(residualPairs);
        const loadSigmaCalibration = estimateResidualSigmaScale(residualPairs, "load");
        const errorSigmaCalibration = estimateResidualSigmaScale(residualPairs, "error");

        while (
            randomCandidatesGenerated < candidatesCount &&
            sobolAttempts < maxSobolAttempts
            ) {
            sobolAttempts++;

            const rawX = nextSobolPoint();
            const x = canonicalizeNormalized(rawX);
            const physical = toPhysical(x);

            if (!isValidPhysical(physical)) {
                randomCandidatesRejected++;
                continue;
            }

            const key = getPhysicalKey(x);
            if (seenCandidateKeys.has(key)) {
                randomCandidatesRejected++;
                continue;
            }

            // Анти-дубликатор: фильтрация слишком близких точек
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
            randomCandidatesGenerated++;
        }

        // --------------------------------------------------------
        // ELITE POINTS
        // --------------------------------------------------------

        // ABORT-точки остаются в GP и влияют на прогноз,
        // но не используются как центры локального поиска.
        const completeObservationIndices =
            Array.from(
                { length: N },
                (_, i) => i
            ).filter(i => observedIsComplete[i]);

        const sortedIndices =
            completeObservationIndices.sort((a, b) => {
                const loadA = observedLoad[a];
                const errorA = observedError[a];

                const loadB = observedLoad[b];
                const errorB = observedError[b];

                const violationA =
                    getConstraintViolation(loadA, errorA);

                const violationB =
                    getConstraintViolation(loadB, errorB);

                if (violationA !== violationB) {
                    return violationA - violationB;
                }

                return (
                    getObjectiveValue(loadA, errorA) -
                    getObjectiveValue(loadB, errorB)
                );
            });

        const eliteIndices = [];
        const eliteKeys = new Set();

        for (const idx of sortedIndices) {
            const key = getPhysicalKey(observedX[idx]);

            if (!eliteKeys.has(key)) {
                eliteKeys.add(key);
                eliteIndices.push(idx);
            }

            if (eliteIndices.length >= 3) {
                break;
            }
        }


        // --------------------------------------------------------
        // ОПТИМИЗИРОВАННЫЙ ЛОКАЛЬНЫЙ ПОИСК (ЗАМЕНИТЬ ДАННЫЙ БЛОК)
        // --------------------------------------------------------
        let localAttempts = 0;
        const maxLocalAttempts = localExplorers * 5;
        const minimizeLoad = objective === "minimize_load";

        while (
            localCandidatesGenerated < localExplorers &&
            localAttempts < maxLocalAttempts &&
            eliteIndices.length > 0
            ) {
            localAttempts++;

            const baseIdx = eliteIndices[(localAttempts - 1) % eliteIndices.length];
            const basePoint = observedX[baseIdx];

            // Создаем базовую мутировавшую точку (как в вашем старом алгоритме)
            const mutatedX = new Float64Array(numParams);
            for (let i = 0; i < numParams; i++) {
                const offset = (Math.random() - 0.5) * 0.15; // чуть увеличили разброс для разнообразия
                mutatedX[i] = Math.max(0, Math.min(1, basePoint[i] + offset));
            }

            // ХИЛЛ-КЛАЙМБИНГ запускаем ТОЛЬКО на первых 15% кандидатов (для полировки топа),
            // а остальные 85% генерируем быстро, чтобы не вешать процессор.
            if (localCandidatesGenerated < Math.max(5, Math.floor(localExplorers * 0.15))) {
                let currentPoint = new Float64Array(mutatedX);
                let bestLocalAcquisition = quickEvaluateAcquisition(
                    currentPoint, loadGP, errorGP, hasFeasibleResult, bestObjective,
                    residualCorrelation.rho, minimizeLoad, loadSigmaCalibration,
                    errorSigmaCalibration, maxAllowedLoad, maxAllowedErrorScore
                );

                let stepSize = 0.05;

                // Уменьшили до 2 итераций локальной полировки по ключевым осям
                for (let iter = 0; iter < 2; iter++) {
                    let localImproved = false;
                    for (let d = 0; d < numParams; d++) {
                        // Проверяем направления
                        for (const sign of [-1, 1]) {
                            const testPoint = new Float64Array(currentPoint);
                            testPoint[d] = Math.max(0, Math.min(1, testPoint[d] + sign * stepSize));

                            const acq = quickEvaluateAcquisition(
                                testPoint, loadGP, errorGP, hasFeasibleResult, bestObjective,
                                residualCorrelation.rho, minimizeLoad, loadSigmaCalibration,
                                errorSigmaCalibration, maxAllowedLoad, maxAllowedErrorScore
                            );

                            if (acq > bestLocalAcquisition + 1e-6) {
                                bestLocalAcquisition = acq;
                                currentPoint = testPoint;
                                localImproved = true;
                            }
                        }
                    }
                    if (!localImproved) stepSize *= 0.5;
                }
                mutatedX.set(currentPoint);
            }

            const canonicalX = canonicalizeNormalized(mutatedX);
            const physical = toPhysical(canonicalX);
            const key = getPhysicalKey(canonicalX);

            if (isValidPhysical(physical) && !seenCandidateKeys.has(key)) {
                candidates.push(canonicalX);
                seenCandidateKeys.add(key);
                localCandidatesGenerated++;
            } else {
                localCandidatesRejected++;
            }
        }


        // --------------------------------------------------------
        // ACQUISITION FUNCTION
        // --------------------------------------------------------

        const objectiveGP = minimizeLoad
            ? loadGP
            : errorGP;

        let bestAcquisition = -Infinity;
        let nextBestX = null;
        let bestCandidateStats = null;

        let invalidPredictionCount = 0;
        let zeroSigmaCount = 0;
        let nonFiniteEICount = 0;

        const constraintLoadTarget = maxAllowedLoad;
        const constraintErrorTarget =
            maxAllowedErrorScore;

        let bestFeasibilityX = null;
        let bestFeasibilityStats = null;

        let bestFeasibilityScore = -Infinity;
        let bestFeasibilitySelectedScore = -Infinity;
        let bestFeasibilityObjective = Infinity;

        const FEASIBILITY_TIE_EPSILON = 1e-9;

        for (
            let c = 0;
            c < candidates.length;
            c++
        ) {
            const candX = candidates[c];

            const rawLoadPrediction =
                predictGaussianProcess(loadGP, candX);

            const rawErrorPrediction =
                predictGaussianProcess(errorGP, candX);

            if (
                !rawLoadPrediction ||
                !rawErrorPrediction
            ) {
                invalidPredictionCount++;
                continue;
            }

            const loadPrediction =
                applySigmaCalibration(
                    rawLoadPrediction,
                    loadSigmaCalibration
                );

            const errorPrediction =
                applySigmaCalibration(
                    rawErrorPrediction,
                    errorSigmaCalibration
                );

            if (!loadPrediction || !errorPrediction) {
                invalidPredictionCount++;
                continue;
            }

            const pLoad = probabilityBelow(
                loadPrediction,
                constraintLoadTarget
            );

            const pError = probabilityBelow(
                errorPrediction,
                constraintErrorTarget
            );

            const pFeasible = jointProbabilityBelow(
                loadPrediction,
                errorPrediction,
                constraintLoadTarget,
                constraintErrorTarget,
                residualCorrelation.rho
            );

            const objectivePrediction =
                objectiveGP === loadGP
                    ? loadPrediction
                    : errorPrediction;

            const sigmaObjective =
                objectivePrediction.sigmaLog;

            const candidateObjective =
                objectivePrediction.meanLog;

            const feasibilityScore = pFeasible;

            bestFeasibilityScore = Math.max(
                bestFeasibilityScore,
                feasibilityScore
            );

            // --- ТЕПЕРЬ ЭТОТ БЛОК ДОЛЖЕН ВЫГЛЯДЕТЬ ТАК (БЕЗ МЕРТВОГО КОДА) ---
            const isFirstCandidate = (bestFeasibilityX === null);
            const isStrictlyBetterFeasibility = (feasibilityScore > bestFeasibilitySelectedScore + FEASIBILITY_TIE_EPSILON);
            const isFeasibilityTie = Math.abs(feasibilityScore - bestFeasibilitySelectedScore) <= FEASIBILITY_TIE_EPSILON;

            let betterFeasibility = false;

            if (isFirstCandidate) {
                betterFeasibility = true;
            } else if (isStrictlyBetterFeasibility) {
                betterFeasibility = true;
            } else if (isFeasibilityTie && candidateObjective < bestFeasibilityObjective) {
                // Если шансы зайти по нагрузке равны, выбираем того, у кого предсказанная ошибка МЕНЬШЕ
                betterFeasibility = true;
            }

            if (betterFeasibility) {
                bestFeasibilitySelectedScore = feasibilityScore;
                bestFeasibilityObjective = candidateObjective;
                bestFeasibilityX = candX;
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
                const constraintPrediction =
                    minimizeLoad
                        ? errorPrediction
                        : loadPrediction;

                const constraintLimit =
                    minimizeLoad
                        ? constraintErrorTarget
                        : constraintLoadTarget;

                const ei =
                    calculateConstrainedLogNormalEI(
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

                if (acquisition > bestAcquisition) {
                    bestAcquisition = acquisition;
                    nextBestX = candX;

                    bestCandidateStats = {
                        loadPrediction,
                        errorPrediction,
                        pLoad,
                        pError,
                        pFeasible,

                        constraintProbability:
                            minimizeLoad
                                ? pError
                                : pLoad,

                        ei,
                        acquisition,
                        objectivePrediction,
                        sigmaObjective,

                        bestLogTarget:
                            Math.log1p(bestObjective)
                    };
                }
            } else {
                const explorationBonus =
                    1e-4 * Math.min(10, sigmaObjective);

                const acquisition =
                    pFeasible + explorationBonus;

                if (acquisition > bestAcquisition) {
                    bestAcquisition = acquisition;
                    nextBestX = candX;

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

        // --------------------------------------------------------
        // CONTROLLED FEASIBILITY EXPLORATION
        // --------------------------------------------------------

        let selectionMethod = hasFeasibleResult
            ? "CONSTRAINED_EXPECTED_IMPROVEMENT"
            : "FEASIBILITY_SEARCH";

        let selectionFallbackReason = null;

        if (
            hasFeasibleResult &&
            bestFeasibilityX
        ) {
            const selectedFeasibility =
                bestCandidateStats?.pFeasible ?? 0;

            const dynamicFeasibilityInterval = Math.min(15, Math.floor(FEASIBILITY_EXPLORATION_INTERVAL + (currentExecutionCount / 18)));
            const periodicExploration = bayesianDecisionCount % dynamicFeasibilityInterval === 0;

            const lowFeasibility =
                selectedFeasibility <
                MIN_SELECTED_FEASIBILITY &&
                bestFeasibilityScore -
                selectedFeasibility >=
                MIN_FEASIBILITY_GAIN;

            const noPositiveEI =
                bestAcquisition <= 0;

            if (
                periodicExploration ||
                lowFeasibility ||
                noPositiveEI
            ) {
                nextBestX = bestFeasibilityX;
                bestCandidateStats =
                    bestFeasibilityStats;

                bestAcquisition =
                    bestFeasibilityScore;

                selectionMethod =
                    "FEASIBILITY_EXPLORATION";

                selectionFallbackReason = noPositiveEI
                    ? "NON_POSITIVE_CONSTRAINED_EI"
                    : periodicExploration
                        ? "PERIODIC_EXPLORATION"
                        : "LOW_SELECTED_FEASIBILITY";
            }
        }

        if (!nextBestX) {
            selectionMethod = "RANDOM_FALLBACK";
            selectionFallbackReason =
                "NO_VALID_CANDIDATE";

            const fallback = generateRandomPoint(
                evaluatedKeys,
                500
            );

            if (!fallback) break;

            nextBestX = fallback.x;
            bestCandidateStats = null;
        }

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
            objective,

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
                kernel: "RBF",

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
            prediction: stats
                ? {
                    load: {
                        meanLog: stats.loadPrediction.meanLog,
                        sigmaLog: stats.loadPrediction.sigmaLog,
                        predictedMean: Math.exp(stats.loadPrediction.meanLog + (stats.loadPrediction.sigmaLog ** 2) / 2) - 1
                    },

                    error: {
                        meanLog: stats.errorPrediction.meanLog,
                        sigmaLog: stats.errorPrediction.sigmaLog,
                        predictedMean: Math.exp(stats.errorPrediction.meanLog + (stats.errorPrediction.sigmaLog ** 2) / 2) - 1
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
                physical: toPhysical(nextBestX),
                acquisition:
                    stats?.acquisition ?? null
            }
        };

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

            selectedCandidatePrediction: stats
                ? {
                    predictedLoad:
                        Math.expm1(
                            stats.loadPrediction.meanLog
                        ),

                    predictedError:
                        Math.expm1(
                            stats.errorPrediction.meanLog
                        ),

                    probabilityLoadFeasible:
                    stats.pLoad,

                    probabilityErrorFeasible:
                    stats.pError,

                    jointFeasibility:
                    stats.pFeasible,

                    expectedImprovement:
                    stats.ei
                }
                : "No predictions available (Random Fallback)",

            selectedParams:
                toPhysical(nextBestX)
        });

        evaluate(
            toPhysical(nextBestX),
            nextBestX
        );
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
            objective
        }
    };
}

// Вставить сразу после createSobolGenerator и перед optimizeForMaxSpeed
function quickEvaluateAcquisition(candX, loadGP, errorGP, hasFeasibleResult, bestObjective, rho, minimizeLoad, loadScale, errorScale, maxLoad, maxErrorScore) {
    const rawLoad = predictGaussianProcess(loadGP, candX);
    const rawError = predictGaussianProcess(errorGP, candX);
    if (!rawLoad || !rawError) return -Infinity;

    const loadPred = applySigmaCalibration(rawLoad, loadScale);
    const errorPred = applySigmaCalibration(rawError, errorScale);
    if (!loadPred || !errorPred) return -Infinity;

    const pFeasible = jointProbabilityBelow(loadPred, errorPred, maxLoad, maxErrorScore, rho);
    const objPrediction = minimizeLoad ? loadPred : errorPred;

    if (hasFeasibleResult) {
        const constraintPred = minimizeLoad ? errorPred : loadPred;
        const constraintLimit = minimizeLoad ? maxErrorScore : maxLoad;
        return calculateConstrainedLogNormalEI(bestObjective, objPrediction, constraintPred, constraintLimit, rho);
    } else {
        const explorationBonus = 1e-4 * Math.min(10, objPrediction.sigmaLog);
        return pFeasible + explorationBonus;
    }
}
