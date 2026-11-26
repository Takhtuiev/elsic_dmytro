import { createDiagnosticLogger } from "./optimizerDiagnostics.js";


// ============================================================================
// 0. НАСТРОЙКИ АЛГОРИТМА
// Все именованные пороги в одном месте. Значения подобраны на стенде из 14 задач
// (синтетика с известным оптимумом + реальная модель нагрева).
// ============================================================================

// Ограничения
// «Далеко за границей»: прогноз превышает лимит примерно на 15% масштаба ограничения
const FAR_OUTSIDE_LOG_MARGIN = Math.log(1.15);

// Модель цели
// Сдвиг априорного среднего модели цели в «плохую» сторону (в σ наблюдений)
const OBJECTIVE_PRIOR_PESSIMISM = 0.5;

// Автовыбор преобразования цели: минимум завершённых прогонов для сравнения
// и требуемый перевес по log-правдоподобию для смены преобразования
const TRANSFORM_MIN_OBSERVATIONS = 8;
const TRANSFORM_SWITCH_MARGIN = 2.0;

// Регионы доверия (TuRBO): начальная/максимальная длина стороны (в нормированных
// координатах с учётом масштабов GP), число удач до расширения, максимум регионов
const TR_LENGTH_INIT = 0.8;
const TR_LENGTH_MAX = 1.6;
const TR_SUCCESS_TOLERANCE = 3;
const TR_MAX_REGIONS = 4;
// «Continue» = второй взгляд: во сколько раз увеличить неопределённость прогноза цели
// и минимальное расстояние (норм. координаты) между проверяемыми локальными оптимумами
const VERIFY_SIGMA_FACTOR = 2;
const VERIFY_MIN_SEPARATION = 0.2;
// Пул кандидатов на шаг: базовый размер + на каждый параметр; доля глобальных точек;
// максимум стартов для локальной оптимизации EI
const POOL_BASE_SIZE = 250;
const POOL_PER_PARAM = 60;
const GLOBAL_POOL_SHARE = 0.12;
const LOCAL_OPT_STARTS_MAX = 8;
// Логарифмическая шкала оси параметра: положительный диапазон шире этого (max/min).
// Для «масштабных» параметров (плотность сетки, шаг, мощность) поиск и модель работают
// в долях-множителях, а не в абсолютных приращениях
const LOG_AXIS_MIN_RATIO = 4;

// Ранние остановки и прерывания
// Максимальная по пулу вероятность допустимости, ниже которой задача считается недопустимой
const INFEASIBLE_PROBABILITY_THRESHOLD = 0.01;
// Запас над лимитом монотонной метрики, после которого прогон обрывается как заведомо недопустимый
const CERTAIN_ABORT_MARGIN = 1.0;
// Обученные по оборванным прогонам наблюдения: допустимый диапазон прогресса обрыва (%)
const MIN_ABORT_TRAINING_PROGRESS = 5;
const MAX_ABORT_PROGRESS_PERCENT = 50;
// Прогон, досчитанный до этого процента, не обрываем, даже если он заведомо недопустим:
// дочёт стоит мало, а модель получает точные данные вместо экстраполяции.
const FINISH_RUN_PROGRESS_PERCENT = 70;
// ...если только метрика не превысила потолок прерывания вдвое (защита от очень долгих прогонов)
const FINISH_RUN_MAX_CEILING_FACTOR = 2;
// Дисперсия шума (лог-ед.) для цели оборванного прогона, если цель — не метрика обрыва:
// частичное значение (например, ошибка недосчитанного нагрева) не говорит о полном прогоне,
// поэтому модель цели его фактически не учитывает. Точка остаётся в модели ограничений.
const UNRELIABLE_ABORT_OBJECTIVE_NOISE = 100;
// Калибровка неопределённости: сколько последних «прогноз → факт» хранить
const MAX_RESIDUAL_PAIRS = 45;

// ============================================================================
// 1. ЧИСЛЕННЫЕ И МАТЕМАТИЧЕСКИЕ ОСНОВЫ
// Расстояния, ядро Матерна, линейная алгебра и функции нормального распределения.
// ============================================================================

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


// Ожидаемое улучшение (EI) с учётом ограничений. GP моделирует цель в преобразованном
// пространстве y = transform.forward(v); улучшение считается в исходных единицах цели
// и делится на improvementScale (масштаб цели), поэтому не зависит от выбора преобразования.
function calculateConstrainedEI(
    bestValue,
    objectivePrediction,
    constraintProbFn,
    isMaximize,
    improvementScale,
    transform
) {
    if (
        !Number.isFinite(bestValue) ||
        !objectivePrediction ||
        !Number.isFinite(objectivePrediction.meanLog) ||
        !Number.isFinite(objectivePrediction.sigmaLog) ||
        objectivePrediction.sigmaLog < 0
    ) {
        return 0;
    }

    const mu = objectivePrediction.meanLog;
    const sigma = objectivePrediction.sigmaLog;
    const yTarget = transform.forward(bestValue);
    if (!Number.isFinite(yTarget)) return 0;
    const normScale = Number.isFinite(improvementScale) && improvementScale > 0
        ? improvementScale
        : Math.max(1e-6, Math.abs(bestValue));

    const improvementAt = (y) => {
        const predictedValue = transform.inverse(y);
        if (!Number.isFinite(predictedValue)) return 0;
        const rawDiff = isMaximize ? (predictedValue - bestValue) : (bestValue - predictedValue);
        return Math.max(0, rawDiff / normScale);
    };

    if (sigma < 1e-9) {
        return improvementAt(mu) * constraintProbFn(0);
    }

    const thresholdZ = (yTarget - mu) / sigma;
    const lower = isMaximize ? Math.max(-8, thresholdZ) : -8;
    const upper = isMaximize ? 8 : Math.min(8, thresholdZ);

    if (!Number.isFinite(upper) || !Number.isFinite(lower) || upper <= lower) {
        if (!Number.isFinite(thresholdZ)) return 0;
        const zClamped = Math.max(-8, Math.min(8, thresholdZ));
        const zSq = Math.min(500, thresholdZ * thresholdZ);
        const tailScore = (Math.exp(-0.5 * zSq) / (1 + zSq)) * constraintProbFn(zClamped);
        return Number.isFinite(tailScore) ? Math.max(0, tailScore) : 0;
    }

    // Интегрирование по Симпсону по z ∈ [lower, upper]
    const intervals = 64;
    const step = (upper - lower) / intervals;
    const normalizer = 1 / Math.sqrt(2 * Math.PI);
    let integral = 0;
    for (let i = 0; i <= intervals; i++) {
        const z = lower + i * step;
        const weight = i === 0 || i === intervals ? 1 : (i % 2 === 0 ? 2 : 4);
        integral += weight * improvementAt(mu + sigma * z) * constraintProbFn(z) * normalizer * Math.exp(-0.5 * z * z);
    }
    const result = integral * step / 3;
    return Number.isFinite(result) ? Math.max(0, result) : 0;
}

// Вероятность того, что величина, прогноз которой (в пространстве GP) равен prediction,
// окажется ниже порога yLimit (тоже в пространстве GP)
function probabilityYBelow(prediction, yLimit) {
    if (
        !prediction ||
        !Number.isFinite(yLimit) ||
        !Number.isFinite(prediction.meanLog) ||
        !Number.isFinite(prediction.sigmaLog) ||
        prediction.sigmaLog < 0
    ) {
        return 0;
    }
    if (prediction.sigmaLog < 1e-9) return prediction.meanLog <= yLimit ? 1 : 0;
    const p = normalCDF((yLimit - prediction.meanLog) / prediction.sigmaLog);
    return Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
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
    isCoarseAxis = null,
    isMaxGoal = false,
    baseNugget = 1e-4,
    priorMeanShift = 0
) {
    const totalObservations = Array.isArray(X) ? X.length : 0;

    const effectiveSamples = Math.max(4, Math.min(totalObservations, 60));
    const avgSpacing = Math.pow(effectiveSamples, -1 / numParams);
    const MIN_SCALE = Math.max(0.02, Math.min(0.25, 0.65 * avgSpacing * (1.0 - 0.35 * progressFactor)));
    const MAX_SCALE = Math.max(0.25, Math.min(0.85, 2.2 * avgSpacing));
    const MAX_SAMPLES = Math.min(60, 35 + Math.floor(progressFactor * 25));
    const MAX_PASSES = 6;
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
            const sortedComplete = [...completeIndices].sort((a, b) =>
                isMaxGoal ? (Y[b] - Y[a]) : (Y[a] - Y[b])
            );
            const eliteCount = Math.floor(MAX_SAMPLES * 0.5);
            const eliteIndices = sortedComplete.slice(0, eliteCount);
            const restIndices = sortedComplete.slice(eliteCount);

            const restX = restIndices.map(i => X[i]);
            const diverseSub = selectDiverseIndices(restX, MAX_SAMPLES - eliteCount);
            selectedIndices = [
                ...eliteIndices,
                ...diverseSub.map(subIdx => restIndices[subIdx])
            ];
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
            isCoarseAxis,
            baseNugget,
            priorMeanShift
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
                Math.max(lowerBounds[d], originalScale * 0.65),
                Math.min(upperBounds[d], originalScale * 1.5)
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

function fitGaussianProcess(X, Y, noise, lengthScales, isComplete, isCoarseAxis = null, baseNugget = 1e-4, priorMeanShift = 0) {
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

    // Пессимистичное априорное среднее (в единицах σ): вдали от данных модель
    // предсказывает «посредственное», а не «среднее» значение, и не тратит шаги на углы.
    if (Number.isFinite(priorMeanShift) && priorMeanShift !== 0) {
        yMean += priorMeanShift * safeYStd;
    }

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
            : baseNugget;

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
        sigmaLog: prediction.sigmaLog * factor
    };
}


// ============================================================================
// 5. КАЛИБРОВКА НЕОПРЕДЕЛЁННОСТИ И ВЕРОЯТНОСТНЫЕ ОГРАНИЧЕНИЯ
// ============================================================================

// Условие 1,2,3,4,5,6: Интеллектуальный расчет калибровки с ЕМА-сглаживанием и глобальным контролем осей
function estimateResidualSigmaScale(pairs, key, observedX = [], lastScaleValue = 1.0, progressFactor = 0.0) {
    const MIN_REQUIRED_SAMPLES = 8;
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
        rawLimit <= -1 ||
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
        return { points: [] };
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
        return { points: [] };
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

    while (results.length < targetCount && consecutiveMisses < MAX_CONSECUTIVE_MISSES) {

        const u = sobolState._draw();
        sobolState.drawsCount++;

        const values = new Array(numDims);

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
        }

        const key = values.join("|");
        if ((externalSeen && externalSeen.has(key)) || batchSeen.has(key)) {
            consecutiveMisses++;
            continue;
        }

        consecutiveMisses = 0;
        batchSeen.add(key);
        results.push({ values, key });
    }

    return { points: results };
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

function getRoundingTolerance(limit) {
    const absLim = Math.abs(limit);
    if (!Number.isFinite(absLim) || absLim === 0) return 1e-9;
    const magnitude = Math.floor(Math.log10(absLim));
    return 0.5 * Math.pow(10, magnitude - 2);
}


// Знаковый логарифм: монотонен, гладок в нуле, работает с отрицательными значениями
// и сжимает огромные диапазоны (например, нагрузка 1e6..1e9) так же, как обычный log.
function signedLog1p(v) {
    return v >= 0 ? Math.log1p(v) : -Math.log1p(-v);
}

// Любое ограничение (max / min / диапазон) приводится к «превышению» excess:
//   excess <= tol  <=>  ограничение выполнено.
// GP обучается на signedLog1p(excess / scale), поэтому ограничения вида
// «c(x) <= 0» с отрицательными значениями больше не обрезаются до нуля.
function normalizeSingleConstraint(c) {
    const val = c?.value;
    if (!Number.isFinite(val)) {
        return { excess: NaN, tol: 0, refScale: 0, violation: Infinity, feasible: false };
    }

    const hasMax = Number.isFinite(c?.max);
    const hasMin = Number.isFinite(c?.min);

    const explicitTol = Number.isFinite(c?.tolerance) && c.tolerance >= 0 ? c.tolerance : null;

    if (hasMax && !hasMin) {
        const tol = explicitTol !== null ? explicitTol : getRoundingTolerance(c.max);
        const excess = val - c.max;
        const scale = Math.max(1e-6, Math.abs(c.max));
        const violation = excess <= tol ? 0 : Math.max(0, excess / scale);
        return { excess, tol, refScale: Math.abs(c.max), violation, feasible: excess <= tol };
    }

    if (hasMin && !hasMax) {
        const tol = explicitTol !== null ? explicitTol : getRoundingTolerance(c.min);
        const excess = c.min - val;
        const scale = Math.max(1e-6, Math.abs(c.min));
        const violation = excess <= tol ? 0 : Math.max(0, excess / scale);
        return { excess, tol, refScale: Math.abs(c.min), violation, feasible: excess <= tol };
    }

    if (hasMin && hasMax) {
        const center = (c.min + c.max) * 0.5;
        const halfWidth = Math.max(1e-6, (c.max - c.min) * 0.5);
        const tol = explicitTol !== null ? explicitTol : getRoundingTolerance(halfWidth);
        const excess = Math.abs(val - center) - halfWidth;
        const violation = excess <= tol ? 0 : Math.max(0, excess / halfWidth);
        return { excess, tol, refScale: halfWidth, violation, feasible: excess <= tol };
    }

    return { excess: -1, tol: 0, refScale: 1, violation: 0, feasible: true };
}

function createParameterSpace(config, paramKeys) {
    const numParams = paramKeys.length;
    const MAX_INDEXED_LEVELS = 5000;

    const getStepPrecision = (step) => {
        if (!Number.isFinite(step) || step <= 0) return null;
        const str = step.toString();
        if (str.includes("e-")) return Math.min(8, Number(str.split("e-")[1]));
        const dotIdx = str.indexOf(".");
        return dotIdx >= 0 ? Math.min(6, str.length - dotIdx - 1) : 0;
    };

    const roundByPrecision = (val, precision) =>
        Number.isInteger(precision) ? Number(val.toFixed(precision)) : val;

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

    const minAxisScales = new Float64Array(numParams);
    const normAxisSteps = new Float64Array(numParams);
    const isCoarseAxis = new Uint8Array(numParams);

    const axes = paramKeys.map((key, d) => {
        const range = config[key];
        const span = range.max - range.min;
        const step = range.step;
        const precision = getStepPrecision(step);

        let levels = null;
        if (span <= 0) {
            levels = [range.min];
        } else if (Number.isFinite(step) && step > 0) {
            const count = Math.floor((span + 1e-12) / step);
            if (count > 0 && count <= MAX_INDEXED_LEVELS) {
                levels = [];
                for (let i = 0; i <= count; i++) {
                    const val = roundByPrecision(range.min + i * step, precision);
                    if (val <= range.max + 1e-12) levels.push(Math.min(range.max, val));
                }
                if (levels.length === 0) levels = null;
            }
        }

        let normStep = 0;
        if (span > 0) {
            if (levels && levels.length > 1) normStep = 1 / (levels.length - 1);
            else if (Number.isFinite(step) && step > 0) normStep = step / span;
        }

        normAxisSteps[d] = normStep > 0 ? normStep : (span > 0 ? 0.01 : 0);
        isCoarseAxis[d] = normStep > 0.015 ? 1 : 0;
        minAxisScales[d] = span <= 0 ? 0.25 : (normStep > 0 ? Math.min(0.65, normStep * 2.2) : 0.08);

        const logScale = range.min > 0 && range.max / range.min >= LOG_AXIS_MIN_RATIO;
        const logRatio = logScale ? Math.log(range.max / range.min) : 0;
        return { key, min: range.min, max: range.max, span, step, precision, levels, logScale, logRatio };
    });
    // Нормированная координата u ∈ [0, 1] ↔ физическое значение (линейно или в лог-шкале)
    const axisToPhysical = (ax, u) => (ax.logScale ? ax.min * Math.exp(u * ax.logRatio) : ax.min + u * ax.span);
    const axisToNormalized = (ax, v) => (ax.logScale ? Math.log(v / ax.min) / ax.logRatio : (v - ax.min) / ax.span);

    const toPhysical = (xNorm) => {
        if (!xNorm || xNorm.length !== numParams) {
            throw new Error("Некорректная размерность нормализованной точки.");
        }
        const physical = {};
        for (let d = 0; d < numParams; d++) {
            const ax = axes[d];
            const u = Number.isFinite(xNorm[d]) ? Math.max(0, Math.min(1, xNorm[d])) : 0.5;
            if (ax.span <= 0) {
                physical[ax.key] = ax.min;
                continue;
            }
            const rawPhys = axisToPhysical(ax, u);
            if (ax.levels) {
                physical[ax.key] = ax.levels[findNearestLevelIndex(ax.levels, rawPhys)];
            } else if (Number.isFinite(ax.step) && ax.step > 0) {
                const snapped = ax.min + Math.round((rawPhys - ax.min) / ax.step) * ax.step;
                physical[ax.key] = Math.max(ax.min, Math.min(ax.max, roundByPrecision(snapped, ax.precision)));
            } else {
                physical[ax.key] = rawPhys;
            }
        }
        return physical;
    };

    const toNormalized = (physical) => {
        if (!physical || typeof physical !== "object" || Array.isArray(physical)) return null;
        const normX = new Float64Array(numParams);
        for (let d = 0; d < numParams; d++) {
            const ax = axes[d];
            const val = physical[ax.key];
            if (!Number.isFinite(val) || val < ax.min - 1e-12 || val > ax.max + 1e-12) return null;
            normX[d] = ax.span > 0 ? Math.max(0, Math.min(1, axisToNormalized(ax, val))) : 0;
        }
        return normX;
    };

    const getKey = (physical) => paramKeys.map(k => String(physical[k])).join("|");

    const quantize = (rawX) => {
        const physical = toPhysical(rawX);
        const x = toNormalized(physical);
        if (!x) return null;
        return { x, physical, key: getKey(physical) };
    };

    // Глобальные точки Соболя: по лог-осям — равномерно в нормированной координате
    const sobolBounds = axes.map(ax => {
        if (ax.logScale) return { min: 0, max: 1 };
        if (ax.levels) return { levels: ax.levels, min: ax.min, max: ax.max };
        if (Number.isFinite(ax.step) && ax.step > 0) return { min: ax.min, max: ax.max, step: ax.step };
        return { min: ax.min, max: ax.max };
    });

    const fromSobolPoint = (pt) => {
        const normX = new Float64Array(numParams);
        for (let d = 0; d < numParams; d++) {
            const ax = axes[d];
            const v = pt.values[d];
            if (ax.logScale) {
                normX[d] = v;
                continue;
            }
            if (!Number.isFinite(v) || v < ax.min - 1e-12 || v > ax.max + 1e-12) return null;
            normX[d] = ax.span > 0 ? Math.max(0, Math.min(1, axisToNormalized(ax, v))) : 0;
        }
        return quantize(normX);
    };

    const stepGrid = (xNorm, moves) => {
        const baseQ = quantize(xNorm);
        if (!baseQ) return null;
        const trial = new Float64Array(baseQ.x);
        let moved = false;

        for (const { dim, dir } of moves) {
            const ax = axes[dim];
            if (!ax || ax.span <= 0) continue;
            const baseVal = baseQ.physical[ax.key];
            let nextVal;

            if (ax.levels) {
                const idx = findNearestLevelIndex(ax.levels, baseVal);
                nextVal = ax.levels[Math.max(0, Math.min(ax.levels.length - 1, idx + dir))];
            } else if (Number.isFinite(ax.step) && ax.step > 0) {
                nextVal = baseVal + dir * ax.step;
            } else {
                nextVal = baseVal + dir * (ax.span * 0.005);
            }

            trial[dim] = Math.max(0, Math.min(1, axisToNormalized(ax, nextVal)));
            moved = true;
        }

        return moved ? quantize(trial) : null;
    };

    const stepAxis = (xNorm, dimIdx, dir) => stepGrid(xNorm, [{ dim: dimIdx, dir }]);

    return {
        minAxisScales,
        normAxisSteps,
        isCoarseAxis,
        sobolBounds,
        toPhysical,
        toNormalized,
        quantize,
        fromSobolPoint,
        stepAxis,
        stepGrid,
        getStepPrecision
    };
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


    // Бюджет запуска задаёт вызывающая сторона (конфиг задач): task.budget = { iterations, initPoints }
    const budget = task.budget;
    if (
        !budget ||
        !Number.isFinite(budget.iterations) ||
        budget.iterations < 1 ||
        !Number.isFinite(budget.initPoints) ||
        budget.initPoints < 1
    ) {
        throw new Error(
            "Некорректный бюджет оптимизации (task.budget)."
        );
    }
    // «Зрелость» поиска для адаптивных порогов: число шагов относительно стандартного
    // бюджета для этой размерности, а не относительно бюджета, выбранного пользователем.
    // С большим бюджетом пороги не «застывают» в осторожном режиме, с маленьким — не ускоряются
    const REFERENCE_BUDGET = Math.max(80, numParams * 35 + 20);
    const totalIterations = currentExecutionCount + Math.floor(budget.iterations);
    const initPointsCount = Math.min(totalIterations, Math.floor(budget.initPoints));

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

    const runtime = {
        emaStorage: state?.lastEMAStorage
            ? {
                load: state.lastEMAStorage.load ?? 1.0,
                errors: Array.isArray(state.lastEMAStorage.errors)
                    ? [...state.lastEMAStorage.errors]
                    : (Number.isFinite(state.lastEMAStorage.error) ? [state.lastEMAStorage.error] : [])
            }
            : { load: 1.0, errors: [] },
        bestStepNumber: state ? (state.lastEvaluatedBestStepNumber ?? null) : null,
        significantBestStep: state?.significantBestStep ?? null,
        currentStepParams: null
    };

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

    const toF64 = (v) => (v ? (v instanceof Float64Array ? v : new Float64Array(Object.values(v))) : null);
    const searchRegions = Array.isArray(state?.searchRegions)
        ? state.searchRegions.map(r => attachRegionSobol({ ...r, bestX: toF64(r.bestX), lastStep: toF64(r.lastStep) }))
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
                : []
        }
        : {
            loadLengthScales: null,
            constraintLengthScales: [],
            lastLoadScaleCompleteCount: -Infinity,
            lastConstraintScaleCompleteCount: []
        };

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

    const space = createParameterSpace(config, paramKeys);
    const { minAxisScales, normAxisSteps, isCoarseAxis } = space;

    const evaluatedKeys = state?.evaluatedKeys instanceof Set
        ? state.evaluatedKeys
        : new Set(Array.isArray(state?.evaluatedKeys) ? state.evaluatedKeys : []);

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
            bounds: space.sobolBounds,
            sobolState: globalSobolState,
            seenKeys
        });
        return points.length > 0 ? space.fromSobolPoint(points[0]) : null;
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
    // Сырые «превышения» ограничений (для пересчёта при смене масштаба) и параметры преобразования
    const observedConstraintExcess = state?.observedConstraintExcess || [];
    const constraintScales = state?.constraintScales || [];
    const constraintScaleIsDynamic = state?.constraintScaleIsDynamic || [];
    const constraintTols = state?.constraintTols || [];
    // Границы ограничений (min/max/tolerance) — для пересчёта произвольного значения в excess
    const constraintDefs = state?.constraintDefs || [];
    // Индекс ограничения, которое отслеживает метрику раннего прерывания (task.earlyAbort)
    let abortMetricConstraintIdx = state?.abortMetricConstraintIdx ?? null;

    const constraintToY = (k, excess) => signedLog1p(excess / constraintScales[k]);
    // constraintLimitsGP хранится так, чтобы log1p(limit) == порог в пространстве GP
    const refreshConstraintLimit = (k) => {
        constraintLimitsGP[k] = Math.expm1(constraintToY(k, constraintTols[k]));
    };
    const ensureConstraintSlots = (normalizedList, rawList) => {
        while (observedLogConstraints.length < normalizedList.length) {
            const idx = observedLogConstraints.length;
            const nc = normalizedList[idx];
            observedLogConstraints.push([]);
            observedConstraintNoise.push([]);
            observedConstraintExcess.push([]);
            constraintNames.push(rawList[idx]?.name || `c_${idx}`);
            const isDynamic = !(nc.refScale > 1e-12);
            constraintScaleIsDynamic.push(isDynamic);
            constraintScales.push(
                isDynamic
                    ? Math.max(1e-9, Number.isFinite(nc.excess) && Math.abs(nc.excess) > 0 ? Math.abs(nc.excess) : 1)
                    : nc.refScale
            );
            constraintTols.push(nc.tol);
            constraintDefs.push({
                min: rawList[idx]?.min,
                max: rawList[idx]?.max,
                tolerance: rawList[idx]?.tolerance
            });
            constraintLimitsGP.push(0);
            refreshConstraintLimit(idx);
        }
    };
    const pushConstraintObservation = (k, excess, noiseValue) => {
        observedConstraintExcess[k].push(excess);
        observedLogConstraints[k].push(constraintToY(k, excess));
        observedConstraintNoise[k].push(noiseValue);
    };
    // Для ограничений вида «c <= 0» масштаб берётся из типичной величины |excess| и уточняется по данным
    const recalibrateDynamicConstraintScales = () => {
        for (let k = 0; k < observedConstraintExcess.length; k++) {
            if (!constraintScaleIsDynamic[k]) continue;
            const mags = observedConstraintExcess[k]
                .filter(Number.isFinite)
                .map(Math.abs)
                .sort((a, b) => a - b);
            if (mags.length < 3) continue;
            const median = mags[Math.floor(mags.length / 2)];
            const nextScale = Math.max(1e-9, median);
            if (Math.abs(nextScale / constraintScales[k] - 1) <= 0.25) continue;
            constraintScales[k] = nextScale;
            observedLogConstraints[k] = observedConstraintExcess[k].map(e => constraintToY(k, e));
            refreshConstraintLimit(k);
            globalGPState.constraintLengthScales[k] = null;
        }
    };
    const observedAllFeasible = state?.observedAllFeasible || [];
    const observedIsComplete = state?.observedIsComplete || [];
    const residualPairsByConstraint = Array.isArray(state?.residualPairsByConstraint)
        ? state.residualPairsByConstraint
        : (Array.isArray(state?.residualPairs) ? [state.residualPairs] : []);
    let goalDirection = state?.goalDirection || task.goal || "min";
    let objectiveTolerance = state?.objectiveTolerance ?? null;
    const isMaximize = () => goalDirection === "max";
    const isBetterVal = (a, b) => (isMaximize() ? a > b : a < b);
    let objectiveShift = state?.objectiveShift ?? 0;

    // Преобразование цели для GP: y = forward(v). observedLogLoad хранит y,
    // observedLoad — исходные значения, observedLoadNoise — дисперсию шума в лог-единицах.
    //   log    — log1p(v + shift): для целей, меняющихся на порядки (нагрузка, время);
    //   linear — v как есть: для целей с ровным разбросом (температура, |ΔT|).
    // Режим "auto" выбирает лучший по правдоподобию модели (см. selectObjectiveTransform).
    const OBJECTIVE_TRANSFORMS = ["log", "linear"];
    const forcedTransformMode = OBJECTIVE_TRANSFORMS.includes(taskSettings.objectiveTransform)
        ? taskSettings.objectiveTransform
        : null;
    const logSlopeAt = (v) => 1 / (1 + Math.max(0, v + objectiveShift));
    // Если цель ни разу не была отрицательной (время, нагрузка, ошибка, |ΔT|), линейная модель
    // не должна обещать улучшений ниже нуля — иначе EI не затухает у нулевого оптимума
    let objectiveNonNegative = state?.objectiveNonNegative ?? true;
    const makeObjectiveTransform = (mode) => (mode === "linear"
        ? { mode, forward: v => v, inverse: y => (objectiveNonNegative && y < 0 ? 0 : y), slope: () => 1 }
        : {
            mode: "log",
            forward: v => Math.log1p(Math.max(0, v + objectiveShift)),
            inverse: y => Math.expm1(y) - objectiveShift,
            slope: logSlopeAt
        });
    let objT = makeObjectiveTransform(forcedTransformMode || state?.objectiveTransformMode || "log");
    let lastTransformCheckCount = state?.lastTransformCheckCount ?? -Infinity;

    const rebuildObjectiveY = () => {
        for (let i = 0; i < observedLoad.length; i++) observedLogLoad[i] = objT.forward(observedLoad[i]);
    };
    // Шум оборванных прогонов хранится в лог-единицах; переводим в единицы текущего преобразования
    const objectiveTrainingNoise = () => observedLoadNoise.map((n, i) => {
        if (!(n > 0) || objT.mode === "log") return n;
        const s = logSlopeAt(observedLoad[i]) / objT.slope(observedLoad[i]);
        return n / (s * s);
    });

    // Nugget цели в нормированных единицах GP: допуск цели переводится в пространство
    // преобразования (через его производную в точке лучшего значения) и делится на разброс Y.
    const computeObjectiveNugget = (T, ys, includeMask = null) => {
        if (!(Number.isFinite(objectiveTolerance) && objectiveTolerance > 0)) return 1e-4;
        let mean = 0;
        let count = 0;
        for (let i = 0; i < ys.length; i++) {
            if ((includeMask && !includeMask[i]) || !Number.isFinite(ys[i])) continue;
            count++;
            mean += (ys[i] - mean) / count;
        }
        let variance = 0;
        for (let i = 0; i < ys.length; i++) {
            if ((includeMask && !includeMask[i]) || !Number.isFinite(ys[i])) continue;
            variance += (ys[i] - mean) ** 2;
        }
        const std = count > 1 ? Math.sqrt(variance / count) : 0;
        if (!(std > 1e-12)) return 1e-4;
        const refValue = gBestMetrics ? gBestLoad : T.inverse(mean);
        const tolY = objectiveTolerance * T.slope(refValue);
        return Math.max(1e-6, Math.min(2e-3, (tolY / std) ** 2));
    };

    // Сравнение преобразований по правдоподобию модели в ИСХОДНЫХ единицах цели:
    // log p(v) = log p(y_norm) + Σ log|T'(v)| − N·log σ_y (поправка на замену переменных,
    // как в методе Бокса — Кокса). Переключаемся только при явном перевесе.
    const selectObjectiveTransform = (completeIdx, progressFactor, constraintNugget) => {
        const X = completeIdx.map(i => observedX[i]);
        const values = completeIdx.map(i => observedLoad[i]);
        const zeros = new Array(X.length).fill(0);
        const trues = new Array(X.length).fill(true);
        const prior = isMaximize() ? -OBJECTIVE_PRIOR_PESSIMISM : OBJECTIVE_PRIOR_PESSIMISM;
        const scores = {};
        for (const mode of OBJECTIVE_TRANSFORMS) {
            const T = makeObjectiveTransform(mode);
            const ys = values.map(T.forward);
            if (!ys.every(Number.isFinite)) {
                scores[mode] = -Infinity;
                continue;
            }
            const nugget = Math.max(computeObjectiveNugget(T, ys), constraintNugget * 0.5);
            const scales = optimizeLengthScales(
                X, ys, zeros, numParams, progressFactor, trues, null,
                minAxisScales, isCoarseAxis, isMaximize(), nugget, prior
            );
            const gp = fitGaussianProcess(X, ys, zeros, scales, trues, isCoarseAxis, nugget, prior);
            if (!gp?.valid) {
                scores[mode] = -Infinity;
                continue;
            }
            let logJacobian = 0;
            for (const v of values) logJacobian += Math.log(Math.max(1e-300, T.slope(v)));
            scores[mode] = gp.logMarginalLikelihood + logJacobian - gp.trainingCount * Math.log(gp.yStd);
        }
        let bestMode = objT.mode;
        for (const mode of OBJECTIVE_TRANSFORMS) {
            if (scores[mode] > scores[bestMode] + TRANSFORM_SWITCH_MARGIN) bestMode = mode;
        }
        emitStepLog({
            type: "OBJECTIVE_TRANSFORM_CHECK",
            stepNumber: currentExecutionCount,
            scores,
            previous: objT.mode,
            selected: bestMode
        });
        if (bestMode !== objT.mode) {
            objT = makeObjectiveTransform(bestMode);
            rebuildObjectiveY();
            globalGPState.loadLengthScales = null;
        }
    };

    const ensurePositiveObjective = (val) => {
        if (!Number.isFinite(val)) return;
        if (val < 0) objectiveNonNegative = false;
        if (val + objectiveShift < 0) {
            objectiveShift = Math.abs(val) + 10;
            rebuildObjectiveY();
            globalGPState.loadLengthScales = null;
        }
    };
    let gBestMetrics = state?.gBestMetrics || null;
    let gBestPhysical = state?.gBestPhysical || null;
    let gBestLoad = state?.gBestLoad ?? (isMaximize() ? -Infinity : Infinity);
    let gBestConstraints = state?.gBestConstraints || null;
    let lastSignificantBestLoad = state?.lastSignificantBestLoad ?? (isMaximize() ? -Infinity : Infinity);
    let fallbackMetrics = state?.fallbackMetrics || null;
    let fallbackPhysical = state?.fallbackPhysical || null;
    let fallbackLoad = state?.fallbackLoad ?? (isMaximize() ? -Infinity : Infinity);
    let fallbackConstraints = state?.fallbackConstraints || null;
    let fallbackViolation = state?.fallbackViolation ?? Infinity;
    let fallbackObjective = state?.fallbackObjective ?? (isMaximize() ? -Infinity : Infinity);

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
                ? Math.min(4, space.getStepPrecision(step))
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
        if (typeof options.onStructuredLog !== "function") {
            return;
        }
        try {
            options.onStructuredLog(
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
            runtime.currentStepParams,
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
                ? runtime.bestStepNumber
                : null
        };
    }

    // -----------------------------------------------------------------------
    // 7.7. РЕГИОНЫ ДОВЕРИЯ (схема TuRBO)
    // Регион — коробка вокруг своей лучшей точки. Полуширина по оси d:
    //   halfWidth_d = length · w_d / 2,  w_d ∝ масштаб GP по оси (среднее геом. = 1),
    // но не меньше одной ячейки сетки параметров.
    // TR_SUCCESS_TOLERANCE удач подряд → length ×2; failureTolerance неудач подряд → length /2.
    // Регион, сжатый до одной ячейки и снова неудачный, «сошёлся» — это и есть доводка.
    // Точка относится к региону только по источнику (из чьего облака она взята).
    // -----------------------------------------------------------------------
    const failureTolerance = Math.max(4, numParams);
    const maxActiveRegions = Math.min(TR_MAX_REGIONS, numParams + 1);
    // Сошёлся ли регион, содержащий текущую лучшую допустимую точку (сбрасывается при новом лидере)
    let leaderConverged = state?.leaderConverged ?? false;

    const lengthScaleWeights = () => {
        const ls = globalGPState.loadLengthScales;
        const w = new Float64Array(numParams).fill(1);
        if (!ls || ls.length !== numParams) return w;
        let logSum = 0;
        for (let d = 0; d < numParams; d++) logSum += Math.log(Math.max(1e-6, ls[d]));
        const geo = Math.exp(logSum / numParams);
        for (let d = 0; d < numParams; d++) w[d] = Math.max(0.2, Math.min(5, ls[d] / geo));
        return w;
    };
    const regionHalfWidths = (length) => {
        const w = lengthScaleWeights();
        const hw = new Float64Array(numParams);
        for (let d = 0; d < numParams; d++) {
            const cell = normAxisSteps[d] > 0 ? normAxisSteps[d] : 0;
            hw[d] = Math.min(0.5, Math.max(cell, length * w[d] / 2));
        }
        return hw;
    };
    const isRegionAtMinimumSize = (reg) => {
        const w = lengthScaleWeights();
        for (let d = 0; d < numParams; d++) {
            const cell = normAxisSteps[d] > 0 ? normAxisSteps[d] : 0;
            if (reg.length * w[d] / 2 > cell + 1e-12) return false;
        }
        return true;
    };
    const isBetterRecord = (violA, objA, violB, objB) =>
        violA < violB - 1e-12 || (Math.abs(violA - violB) <= 1e-12 && isBetterVal(objA, objB));
    // Регион, в котором лежит текущая лучшая точка
    const getLeaderRegion = () => {
        let leader = null;
        for (const reg of searchRegions) {
            if (!reg.active) continue;
            if (!leader || isBetterRecord(reg.bestViolation, reg.bestObjective, leader.bestViolation, leader.bestObjective)) {
                leader = reg;
            }
        }
        return leader;
    };

    const createRegion = (normX, load, violation) => attachRegionSobol({
        id: searchRegions.length ? Math.max(...searchRegions.map(r => r.id)) + 1 : 0,
        bestX: new Float64Array(normX),
        bestLoad: load,
        bestObjective: getObjectiveValue(load),
        bestViolation: violation,
        length: TR_LENGTH_INIT,
        successCount: 0,
        failureCount: 0,
        lastStep: null,
        active: true,
        converged: false,
        attempts: 0,
        improvements: 0
    });

    // Два региона, чьи центры попадают в коробки друг друга, сливаются (остаётся лучший)
    const mergeOverlappingRegions = (reg) => {
        const hwA = regionHalfWidths(reg.length);
        for (const other of searchRegions) {
            if (!other.active || other === reg) continue;
            const hwB = regionHalfWidths(other.length);
            let overlaps = true;
            for (let d = 0; d < numParams; d++) {
                if (Math.abs(reg.bestX[d] - other.bestX[d]) > Math.min(hwA[d], hwB[d])) {
                    overlaps = false;
                    break;
                }
            }
            if (!overlaps) continue;
            const loser = isBetterRecord(reg.bestViolation, reg.bestObjective, other.bestViolation, other.bestObjective) ? other : reg;
            loser.active = false;
            if (loser === reg) return;
        }
    };

    const spawnRegion = (normX, load, violation) => {
        const active = searchRegions.filter(r => r.active);
        if (active.length >= maxActiveRegions) {
            // Слотов нет — вытесняем худший регион, если новая точка лучше его
            let worst = null;
            for (const reg of active) {
                if (!worst || isBetterRecord(worst.bestViolation, worst.bestObjective, reg.bestViolation, reg.bestObjective)) worst = reg;
            }
            if (!worst || !isBetterRecord(violation, getObjectiveValue(load), worst.bestViolation, worst.bestObjective)) return;
            worst.active = false;
        }
        // Неактивные записи держим только для диагностики — не больше нескольких
        while (searchRegions.length >= maxActiveRegions * 3) {
            const idx = searchRegions.findIndex(r => !r.active);
            if (idx < 0) break;
            searchRegions.splice(idx, 1);
        }
        const reg = createRegion(normX, load, violation);
        searchRegions.push(reg);
        mergeOverlappingRegions(reg);
    };

    const regionHoldsGlobalBest = (reg) =>
        Boolean(gBestMetrics) && reg.bestViolation === 0 && reg.bestLoad === gBestLoad;

    // Регион вокруг лучшей известной точки должен существовать, пока лидер не сошёлся:
    // иначе нечего доводить и критерий остановки «лидер сошёлся» недостижим
    const seedRegionsIfEmpty = () => {
        if (leaderConverged) return;
        if (gBestMetrics) {
            if (searchRegions.some(r => r.active && regionHoldsGlobalBest(r))) return;
            const x = gBestPhysical ? space.toNormalized(gBestPhysical) : null;
            if (x) spawnRegion(x, gBestLoad, 0);
            return;
        }
        if (searchRegions.some(r => r.active)) return;
        const x = fallbackPhysical ? space.toNormalized(fallbackPhysical) : null;
        if (x) spawnRegion(x, fallbackLoad, fallbackViolation);
    };

    const convergeRegion = (reg) => {
        reg.converged = true;
        reg.active = false;
        const holdsGlobalBest = regionHoldsGlobalBest(reg);
        if (holdsGlobalBest) leaderConverged = true;
        emitStepLog({
            type: "REGION_CONVERGED",
            stepNumber: currentExecutionCount,
            regionId: reg.id,
            holdsGlobalBest,
            bestValue: reg.bestLoad
        });
    };

    const updateTrustRegions = (normX, load, violation, outcomeStatus, sourceRegionId = -1) => {
        if (outcomeStatus === "ERROR") return;
        const isNewGlobalBest = outcomeStatus === "SUCCESS" && runtime.bestStepNumber === currentExecutionCount;
        if (isNewGlobalBest) leaderConverged = false;

        const reg = Number.isInteger(sourceRegionId) && sourceRegionId >= 0
            ? searchRegions.find(r => r.id === sourceRegionId && r.active)
            : null;

        if (reg) {
            reg.attempts++;
            reg.shrunkWithoutEval = false;
            const valid = outcomeStatus === "SUCCESS" && Number.isFinite(load) && Number.isFinite(violation);
            const objective = getObjectiveValue(load);
            const better = valid && isBetterRecord(violation, objective, reg.bestViolation, reg.bestObjective);
            const minGain = Number.isFinite(objectiveTolerance) && objectiveTolerance > 0
                ? objectiveTolerance
                : 1e-3 * Math.max(1e-9, Math.abs(reg.bestObjective));
            const significant = better && (
                violation < reg.bestViolation - 1e-12 ||
                Math.abs(objective - reg.bestObjective) >= minGain
            );
            if (better) {
                const step = new Float64Array(numParams);
                for (let d = 0; d < numParams; d++) step[d] = normX[d] - reg.bestX[d];
                reg.lastStep = step;
                reg.bestX = new Float64Array(normX);
                reg.bestLoad = load;
                reg.bestObjective = objective;
                reg.bestViolation = violation;
            }
            if (significant) {
                reg.checkedAtMinimum = false;
                reg.improvements++;
                reg.successCount++;
                reg.failureCount = 0;
                if (reg.successCount >= TR_SUCCESS_TOLERANCE) {
                    reg.length = Math.min(TR_LENGTH_MAX, reg.length * 2);
                    reg.successCount = 0;
                }
                mergeOverlappingRegions(reg);
            } else {
                reg.successCount = 0;
                reg.failureCount++;
                if (reg.failureCount >= failureTolerance) {
                    if (isRegionAtMinimumSize(reg)) {
                        convergeRegion(reg);
                    } else {
                        reg.length = reg.length / 2;
                        reg.failureCount = 0;
                        reg.lastStep = null;
                    }
                }
            }
            return;
        }

        // Точка не из региона (старт, глобальная, разведка): новый регион, если это новый
        // лидер или если активных регионов нет вовсе (перезапуск после сходимости)
        if (outcomeStatus !== "SUCCESS" || !Number.isFinite(load) || !Number.isFinite(violation)) return;
        const noActiveRegions = !searchRegions.some(r => r.active);
        const promisingWhileInfeasible = !gBestMetrics && violation <= fallbackViolation + 1e-12;
        if (isNewGlobalBest || promisingWhileInfeasible || (noActiveRegions && (violation === 0 || !gBestMetrics))) {
            spawnRegion(normX, load, violation);
        }
    };

    // Облако кандидатов региона: точки Соболя в коробке, центр слегка сдвинут вдоль
    // последнего удачного шага (не дальше половины коробки)
    const getRegionDraw = (reg) => {
        if (typeof reg.sobolState._draw !== "function") {
            const shift = reg.sobolState.digitalShift instanceof Uint32Array
                ? reg.sobolState.digitalShift
                : new Uint32Array(Object.values(reg.sobolState.digitalShift || {}));
            Object.defineProperty(reg.sobolState, "_draw", {
                value: createSobolGenerator(numParams, shift.length === numParams ? shift : null, reg.sobolState.drawsCount || 0),
                enumerable: false,
                writable: true,
                configurable: true
            });
        }
        return reg.sobolState._draw;
    };
    const sampleRegionCloud = (reg, quota, addCandidate) => {
        const hw = regionHalfWidths(reg.length);
        const center = new Float64Array(numParams);
        for (let d = 0; d < numParams; d++) {
            const shift = reg.lastStep ? 0.5 * reg.lastStep[d] : 0;
            center[d] = reg.bestX[d] + Math.max(-hw[d] / 2, Math.min(hw[d] / 2, shift));
        }
        const draw = getRegionDraw(reg);
        let added = 0;
        for (let attempt = 0; attempt < quota * 4 && added < quota; attempt++) {
            const u = draw();
            reg.sobolState.drawsCount++;
            const x = new Float64Array(numParams);
            for (let d = 0; d < numParams; d++) {
                x[d] = Math.max(0, Math.min(1, center[d] + (2 * u[d] - 1) * hw[d]));
            }
            if (addCandidate(space.quantize(x), reg.lastStep ? "LOCAL_DIRECTIONAL" : "LOCAL", reg.id)) added++;
        }
        return added;
    };

    // Режим «второго взгляда» при продолжении: области вокруг других хороших точек истории,
    // которые выглядят как отдельные локальные оптимумы (лучшие в своей окрестности и
    // далеко от лидера) — возможно, там недоискали
    const seedVerificationRegions = () => {
        const n = observedX.length;
        const usable = [];
        for (let i = 0; i < n; i++) {
            if (!observedIsComplete[i] || !Number.isFinite(observedLoad[i])) continue;
            if (gBestMetrics && !observedAllFeasible[i]) continue;
            usable.push(i);
        }
        usable.sort((a, b) => (isBetterVal(observedLoad[a], observedLoad[b]) ? -1 : 1));
        const topCount = Math.max(1, Math.ceil(usable.length * 0.5));
        const dist = (a, b) => {
            let s = 0;
            for (let d = 0; d < numParams; d++) s += (a[d] - b[d]) ** 2;
            return Math.sqrt(s / numParams);
        };
        const picked = gBestPhysical ? [space.toNormalized(gBestPhysical)].filter(Boolean) : [];
        for (const i of usable.slice(0, topCount)) {
            if (searchRegions.filter(r => r.active).length >= maxActiveRegions) break;
            const x = observedX[i];
            if (picked.some(p => dist(p, x) < VERIFY_MIN_SEPARATION)) continue;
            // Локальный оптимум: в окрестности нет наблюдений лучше
            const dominated = usable.some(j =>
                j !== i && dist(observedX[j], x) < VERIFY_MIN_SEPARATION / 2 && isBetterVal(observedLoad[j], observedLoad[i])
            );
            if (dominated) continue;
            picked.push(x);
            spawnRegion(x, observedLoad[i], 0);
            const reg = searchRegions[searchRegions.length - 1];
            if (reg && reg.active) reg.length = TR_LENGTH_INIT / 2;
        }
        emitStepLog({
            type: "VERIFICATION_STARTED",
            stepNumber: currentExecutionCount,
            regions: searchRegions.filter(r => r.active).map(r => ({ id: r.id, bestVal: r.bestLoad, length: r.length }))
        });
    };

    if (state) {
        // Продолжение по команде пользователя: даём лидеру ещё один шанс —
        // оживляем его сошедшийся регион с половинным начальным размером
        leaderConverged = false;
        const leaderRecord = searchRegions.find(r => regionHoldsGlobalBest(r));
        if (leaderRecord && !leaderRecord.active) {
            leaderRecord.active = true;
            leaderRecord.converged = false;
            leaderRecord.length = TR_LENGTH_INIT / 2;
            leaderRecord.successCount = 0;
            leaderRecord.failureCount = 0;
            leaderRecord.shrunkWithoutEval = false;
            leaderRecord.checkedAtMinimum = false;
        }
        seedVerificationRegions();
    }

    // -----------------------------------------------------------------------
    // 7.8. ВЫПОЛНЕНИЕ ОДНОЙ СИМУЛЯЦИИ И РЕГИСТРАЦИЯ НАБЛЮДЕНИЯ
    // -----------------------------------------------------------------------

    // Список ограничений в том же порядке, что и при регистрации наблюдений
    // (ограничение-лимит самой цели, если задано objective.min/max, идёт первым)
    const buildRawConstraintList = (evalOut) => {
        const list = Array.isArray(evalOut?.constraints) ? [...evalOut.constraints] : [];
        if (Number.isFinite(evalOut?.objective?.max) || Number.isFinite(evalOut?.objective?.min)) {
            list.unshift({
                name: evalOut.objective.name || "objectiveLimit",
                value: evalOut.objective.value,
                min: evalOut.objective.min,
                max: evalOut.objective.max,
                tolerance: evalOut.objective.tolerance
            });
        }
        return list;
    };

    // По завершённому прогону определяем, какое ограничение совпадает с метрикой прерывания
    const detectAbortMetricConstraint = (evalOut, res, preparedParams, wasAborted) => {
        if (Number.isInteger(abortMetricConstraintIdx) && abortMetricConstraintIdx >= 0) return;
        if (wasAborted || !task.earlyAbort || typeof task.earlyAbort.metric !== "function") return;
        let finalMetric;
        try {
            finalMetric = task.earlyAbort.metric(100, res?.technicalMetrics, preparedParams);
        } catch {
            return;
        }
        if (!Number.isFinite(finalMetric)) return;
        const list = buildRawConstraintList(evalOut);
        abortMetricConstraintIdx = list.findIndex(rc =>
            Number.isFinite(rc?.value) &&
            Math.abs(rc.value - finalMetric) <= Math.max(1e-9, 1e-6 * Math.abs(finalMetric))
        );
    };

    // Порог гарантированной недопустимости для монотонной метрики прерывания
    const getCertainInfeasibleLimit = () => {
        if (task.earlyAbort?.monotonic !== true) return Infinity;
        const k = abortMetricConstraintIdx;
        if (!Number.isInteger(k) || k < 0) return Infinity;
        const def = constraintDefs[k];
        if (!def || !Number.isFinite(def.max) || Number.isFinite(def.min)) return Infinity;
        // Небольшой запас: точки возле самой границы досчитываются до конца (это дёшево
        // и даёт точное значение для модели), а далеко ушедшие за лимит обрываются рано.
        return def.max + Math.max(0, constraintTols[k] ?? 0) + CERTAIN_ABORT_MARGIN * Math.abs(def.max);
    };

    const evaluate = async (
        paramsObj,
        normX,
        customTag = null
    ) => {
        const q = space.quantize(normX);
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
        runtime.currentStepParams = paramsObj;
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
        // Если метрика прерывания монотонно растёт (task.earlyAbort.monotonic) и совпадает
        // с ограничением сверху, то её выход за лимит ограничения означает гарантированную
        // недопустимость точки — симуляцию можно остановить сразу, на любом проценте.
        const certainInfeasibleLimit = hasEarlyAbort ? getCertainInfeasibleLimit() : Infinity;
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
                if (percent >= FINISH_RUN_PROGRESS_PERCENT && currentLoad < absoluteCeiling * FINISH_RUN_MAX_CEILING_FACTOR) {
                    notifyProgress(percent, technicalMetrics);
                    return false;
                }
                if (currentLoad > certainInfeasibleLimit) {
                    return requestAbort({
                        reason: "CONSTRAINT_LIMIT_EXCEEDED",
                        percent,
                        currentLoad,
                        predictedFinalLoad,
                        absoluteCeiling: certainInfeasibleLimit,
                        certain: true
                    });
                }
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
            res = await simulateFn(simArgs);
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
        detectAbortMetricConstraint(evalOut, res, preparedParams, Boolean(recordedAbortProgress) || statusType === "abort");
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
        if (Number.isFinite(evalOut?.objective?.tolerance) && evalOut.objective.tolerance >= 0) {
            objectiveTolerance = evalOut.objective.tolerance;
        }
        const rawConstraints = Array.isArray(evalOut?.constraints) ? [...evalOut.constraints] : [];
        if (Number.isFinite(evalOut?.objective?.max) || Number.isFinite(evalOut?.objective?.min)) {
            rawConstraints.unshift({
                name: evalOut.objective.name || "objectiveLimit",
                value: load,
                min: evalOut.objective.min,
                max: evalOut.objective.max,
                tolerance: evalOut.objective.tolerance
            });
        }
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
        const allConstraintsFinite = normalizedConstraints.every(c => Number.isFinite(c.excess));
        // Значение совпадает с метрикой раннего прерывания (с относительной точностью)
        const matchesAbortMetric = (v) =>
            Number.isFinite(v) &&
            Number.isFinite(abortCurrentLoad) &&
            Math.abs(v - abortCurrentLoad) <= Math.max(1e-9, 1e-6 * Math.abs(abortCurrentLoad));
        const isUsableAbortObservation =
            isAborted &&
            recordedAbortProgress &&
            Number.isFinite(abortProgress) &&
            (
                recordedAbortProgress.certain
                    ? abortProgress >= 0
                    : (abortProgress >= MIN_ABORT_TRAINING_PROGRESS && abortProgress <= MAX_ABORT_PROGRESS_PERCENT)
            ) &&
            Number.isFinite(abortCurrentLoad) &&
            abortCurrentLoad >= 0 &&
            allConstraintsFinite;
        if (isUsableAbortObservation) {
            ensureConstraintSlots(normalizedConstraints, rawConstraints);
            if (abortMetricConstraintIdx === null) {
                const matchIdx = rawConstraints.findIndex(rc => matchesAbortMetric(rc?.value));
                abortMetricConstraintIdx = matchIdx >= 0 ? matchIdx : -1;
            }
            const hasPredictedLoad =
                Number.isFinite(abortPredictedLoad) &&
                abortPredictedLoad >= abortCurrentLoad;
            let abortExtrapolated = hasPredictedLoad ? abortPredictedLoad : abortCurrentLoad;
            const isCertainWithoutForecast = Boolean(recordedAbortProgress.certain) && !hasPredictedLoad;
            if (isCertainWithoutForecast) {
                // Прогноза по истории ещё нет (очень ранний обрыв): грубая оценка «метрика ∝ прогрессу»
                abortExtrapolated = abortCurrentLoad * Math.min(20, 100 / Math.max(5, abortProgress));
            } else if (abortProgress < MAX_ABORT_PROGRESS_PERCENT) {
                const penaltyFactor = 1 + (1 - abortProgress / MAX_ABORT_PROGRESS_PERCENT) * 0.5;
                abortExtrapolated *= penaltyFactor;
            }
            const progressRatio = Math.max(0, Math.min(1,
                (abortProgress - MIN_ABORT_TRAINING_PROGRESS) /
                (MAX_ABORT_PROGRESS_PERCENT - MIN_ABORT_TRAINING_PROGRESS)
            ));
            const extrapNoise = isCertainWithoutForecast ? 0.10 : 0.04 - 0.035 * progressRatio;
            const unextrapolatedNoise = 0.15;

            const isObjectiveExtrapolated = matchesAbortMetric(load);
            const objTrainingVal = isObjectiveExtrapolated
                ? abortExtrapolated
                : (Number.isFinite(load) ? load : abortExtrapolated);
            // Цель — сама метрика обрыва: экстраполяция информативна. Иначе частичное значение
            // цели недостоверно и в модель цели фактически не попадает.
            const loadNoise = isObjectiveExtrapolated ? extrapNoise : UNRELIABLE_ABORT_OBJECTIVE_NOISE;

            ensurePositiveObjective(objTrainingVal);
            observedX.push(new Float64Array(normX));
            observedLoad.push(objTrainingVal);
            observedLogLoad.push(objT.forward(objTrainingVal));
            observedLoadNoise.push(loadNoise);

            for (let k = 0; k < normalizedConstraints.length; k++) {
                const rawVal = rawConstraints[k]?.value;
                const isConstraintExtrapolated = matchesAbortMetric(rawVal);

                if (isConstraintExtrapolated) {
                    const extrapC = normalizeSingleConstraint({ ...rawConstraints[k], value: abortExtrapolated });
                    pushConstraintObservation(k, extrapC.excess, extrapNoise);
                } else {
                    pushConstraintObservation(k, normalizedConstraints[k].excess, unextrapolatedNoise);
                }
            }
            observedAllFeasible.push(false);
            observedIsComplete.push(false);
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
            ensureConstraintSlots(normalizedConstraints, rawConstraints);
            ensurePositiveObjective(load);
            const predicted = decision?.predictionForResidual;
            if (
                predicted &&
                Number.isFinite(predicted.loadMeanLog) &&
                Number.isFinite(predicted.loadSigmaLog) &&
                predicted.loadSigmaLog > 0 &&
                Array.isArray(predicted.constraints)
            ) {
                const loadResidual = predicted.transformMode === objT.mode
                    ? (objT.forward(load) - predicted.loadMeanLog) / Math.max(1e-9, predicted.loadSigmaLog)
                    : NaN;
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
                                const errorResidual = (constraintToY(k, normalizedConstraints[k].excess) - cPred.meanLog) / Math.max(1e-9, cPred.sigmaLog);
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
            observedLogLoad.push(objT.forward(load));
            observedLoadNoise.push(0);
            for (let k = 0; k < normalizedConstraints.length; k++) {
                pushConstraintObservation(k, normalizedConstraints[k].excess, 0);
            }
            observedAllFeasible.push(allConstraintsFeasible);
            observedIsComplete.push(true);
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
                    const isFirstBest = !gBestMetrics;
                    gBestMetrics = metrics;
                    gBestPhysical = paramsObj;
                    gBestLoad = load;
                    gBestConstraints = currentConstraintsSummary;
                    runtime.bestStepNumber = currentExecutionCount;

                    const minGain = Number.isFinite(objectiveTolerance) && objectiveTolerance > 0
                        ? objectiveTolerance
                        : Math.max(1e-6, Math.abs(lastSignificantBestLoad)) * 1e-4;
                    const gain = Number.isFinite(lastSignificantBestLoad)
                        ? Math.abs(load - lastSignificantBestLoad)
                        : Infinity;

                    if (isFirstBest || gain >= minGain) {
                        lastSignificantBestLoad = load;
                        runtime.significantBestStep = currentExecutionCount;
                    }
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
            decision?.sourceDiagnostics?.regionId ?? -1
        );
        return isValidObservation
            ? { load, violation: totalViolation, feasible: allConstraintsFeasible }
            : null;
    };
// -----------------------------------------------------------------------
// 7.9. НАЧАЛЬНОЕ НАПОЛНЕНИЕ ВЫБОРКИ (С ЗАЩИТОЙ ПОСЛЕ ПЕРВОГО ABORT)
// -----------------------------------------------------------------------
    if (!state) {
        const abortCeiling = task.earlyAbort?.ceiling ?? Infinity;
        const canUseAbortGuard = Boolean(task.earlyAbort) && Number.isFinite(abortCeiling);

        while (currentExecutionCount < initPointsCount) {
            await new Promise(resolve => setTimeout(resolve, 0));
            if (typeof options.shouldStop === "function" && options.shouldStop()) {
                break;
            }

            const hasAbortOccurred = observedIsComplete.some(v => v === false);
            const activateAbortGuard = canUseAbortGuard && hasAbortOccurred && observedX.length >= 3;

            if (!activateAbortGuard) {
                const singleBatch = generateDiscreteSobolPoints({
                    count: 1,
                    bounds: space.sobolBounds,
                    sobolState: globalSobolState,
                    seenKeys: evaluatedKeys
                });
                const pt = singleBatch.points[0];
                if (!pt) break;

                const candidate = space.fromSobolPoint(pt);
                if (!candidate) continue;

                await evaluate(
                    candidate.physical,
                    candidate.x,
                    "RANDOM_INIT_" + currentExecutionCount
                );
                continue;
            }

            // Режим включается ТОЛЬКО после получения хотя бы одного ABORT
            // Какая величина отслеживает метрику прерывания: найденное ограничение или сама цель
            const abortConstraintIdx =
                Number.isInteger(abortMetricConstraintIdx) &&
                abortMetricConstraintIdx >= 0 &&
                abortMetricConstraintIdx < observedLogConstraints.length &&
                constraintDefs[abortMetricConstraintIdx]
                    ? abortMetricConstraintIdx
                    : -1;
            // Порог прерывания в пространстве соответствующей GP-модели
            const abortCeilingY = abortConstraintIdx >= 0
                ? constraintToY(
                    abortConstraintIdx,
                    normalizeSingleConstraint({ ...constraintDefs[abortConstraintIdx], value: abortCeiling }).excess
                )
                : objT.forward(abortCeiling);

            const abortTargetY = abortConstraintIdx >= 0
                ? observedLogConstraints[abortConstraintIdx]
                : observedLogLoad;
            const abortTargetNoise = abortConstraintIdx >= 0
                ? observedConstraintNoise[abortConstraintIdx]
                : objectiveTrainingNoise();

            let abortMetricModel = null;
            const rawScales = estimateLengthScales(observedX, numParams);
            const scales = new Float64Array(numParams);
            for (let d = 0; d < numParams; d++) {
                scales[d] = Math.max(minAxisScales[d], rawScales[d]);
            }
            const fitted = fitGaussianProcess(
                observedX,
                abortTargetY,
                abortTargetNoise,
                scales,
                observedIsComplete,
                isCoarseAxis
            );
            if (fitted?.valid) {
                abortMetricModel = fitted;
            }

            const lookaheadBatch = generateDiscreteSobolPoints({
                count: 4,
                bounds: space.sobolBounds,
                sobolState: globalSobolState,
                seenKeys: evaluatedKeys
            });

            const candidatesQueue = [];
            for (const pt of lookaheadBatch.points) {
                const cand = space.fromSobolPoint(pt);
                if (cand && !evaluatedKeys.has(cand.key)) {
                    candidatesQueue.push(cand);
                }
            }

            if (candidatesQueue.length === 0) break;

            let chosenCandidate = candidatesQueue[0];
            if (abortMetricModel) {
                let safestCand = candidatesQueue[0];
                let highestSafeProb = -1;

                for (const cand of candidatesQueue) {
                    const pred = predictGaussianProcess(abortMetricModel, cand.x);
                    const pBelowCeiling = pred ? probabilityYBelow(pred, abortCeilingY) : 0.5;

                    if (pBelowCeiling >= 0.35) {
                        chosenCandidate = cand;
                        break;
                    }
                    if (pBelowCeiling > highestSafeProb) {
                        highestSafeProb = pBelowCeiling;
                        safestCand = cand;
                    }
                }

                if (highestSafeProb < 0.35) {
                    chosenCandidate = safestCand;
                }
            }


            await evaluate(
                chosenCandidate.physical,
                chosenCandidate.x,
                "RANDOM_INIT_SAFE_" + currentExecutionCount
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
    let consecutiveMatrixFailures = 0;
    let stepsWithoutGlobalImprovement = 0;
    let lowEIConsecutiveCount = 0;
    // Детектор «задача, по-видимому, недопустима»: модель уверена, что ни одна точка
    // не удовлетворит ограничениям, и наименьшее нарушение перестало уменьшаться.
    let infeasibleStallCount = 0;
    let infeasibleRefViolation = fallbackViolation;
    const infeasiblePatience = 8 + 2 * numParams;
    // Остановка по сходимости: регион-лидер сжался до одной ячейки и не улучшается,
    // а модель нигде (включая глобальные кандидаты) не видит заметного улучшения
    const convergenceLowEISteps = 2 + Math.floor(numParams / 2);

    seedRegionsIfEmpty();

    while (currentExecutionCount < totalIterations) {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (typeof options.shouldStop === "function" && options.shouldStop()) {
            break;
        }
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
        const progressFactor = Math.min(1.0, currentExecutionCount / REFERENCE_BUDGET);
        // Масштабы GP переобучаются чаще, когда регион-лидер мал (идёт тонкая доводка)
        const leaderForSchedule = getLeaderRegion();
        const reoptimizeInterval = leaderForSchedule && isRegionAtMinimumSize(leaderForSchedule) ? 3 : 5;

        let coarseStepEnergy = 0;
        for (let d = 0; d < numParams; d++) {
            if (isCoarseAxis[d]) {
                const stepD = normAxisSteps[d] || 0;
                coarseStepEnergy += stepD * stepD;
            }
        }
        const constraintNugget = Math.max(1e-4, Math.min(2.5e-3, coarseStepEnergy * 0.75));

        // Масштаб цели: модуль лучшего значения, но не меньше доли разброса наблюдений и допуска.
        // Так EI и пороги сходимости одинаково ведут себя для отрицательных целей и целей около нуля.
        const completeObjValues = [];
        for (let i = 0; i < observedLoad.length; i++) {
            if (observedIsComplete[i] && Number.isFinite(observedLoad[i])) completeObjValues.push(observedLoad[i]);
        }
        completeObjValues.sort((a, b) => a - b);
        const objSpread = completeObjValues.length >= 3
            ? completeObjValues[Math.floor(completeObjValues.length * 0.9)] - completeObjValues[Math.floor(completeObjValues.length * 0.1)]
            : 0;
        const objMagnitude = gBestMetrics
            ? Math.abs(gBestLoad)
            : observedLoad.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
        const refObjScale = Math.max(
            1e-9,
            objMagnitude,
            0.05 * objSpread,
            Number.isFinite(objectiveTolerance) && objectiveTolerance > 0 ? objectiveTolerance * 10 : 0
        );
        const relObjTol = (Number.isFinite(objectiveTolerance) && objectiveTolerance > 0)
            ? Math.max(1e-5, Math.min(0.05, objectiveTolerance / refObjScale))
            : null;
        // Автовыбор преобразования цели (раз в несколько шагов, с гистерезисом)
        if (!forcedTransformMode) {
            const completeIdx = [];
            for (let i = 0; i < observedLoad.length; i++) {
                if (observedIsComplete[i] && Number.isFinite(observedLoad[i])) completeIdx.push(i);
            }
            const checkInterval = Math.max(4, numParams + 2);
            if (
                completeIdx.length >= TRANSFORM_MIN_OBSERVATIONS &&
                completeIdx.length - lastTransformCheckCount >= checkInterval
            ) {
                lastTransformCheckCount = completeIdx.length;
                selectObjectiveTransform(completeIdx, progressFactor, constraintNugget);
            }
        }

        const rawObjectiveNugget = computeObjectiveNugget(objT, observedLogLoad, observedIsComplete);
        const objectiveNugget = Math.max(rawObjectiveNugget, constraintNugget * 0.5);
        const objectivePriorShift = isMaximize() ? -OBJECTIVE_PRIOR_PESSIMISM : OBJECTIVE_PRIOR_PESSIMISM;

        recalibrateDynamicConstraintScales();
        const currentCompleteCount = observedIsComplete.filter(Boolean).length;
        const numConstraints = observedLogConstraints.length;
        if (
            !globalGPState.loadLengthScales ||
            currentCompleteCount - globalGPState.lastLoadScaleCompleteCount >= reoptimizeInterval
        ) {
            globalGPState.loadLengthScales = optimizeLengthScales(
                observedX,
                observedLogLoad,
                objectiveTrainingNoise(),
                numParams,
                progressFactor,
                observedIsComplete,
                globalGPState.loadLengthScales,
                minAxisScales,
                isCoarseAxis,
                isMaximize(),
                objectiveNugget,
                objectivePriorShift
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
                    isCoarseAxis,
                    false,
                    constraintNugget
                );
                globalGPState.lastConstraintScaleCompleteCount[k] = currentCompleteCount;
            }
        }
// 7.10.2. ОБУЧЕНИЕ ГЛОБАЛЬНЫХ GP-МОДЕЙ (ЦЕЛЬ + ВСЕ КОМПАСЫ)
        const loadGP = fitGaussianProcess(
            observedX,
            observedLogLoad,
            objectiveTrainingNoise(),
            globalGPState.loadLengthScales,
            observedIsComplete,
            isCoarseAxis,
            objectiveNugget,
            objectivePriorShift
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
                isCoarseAxis,
                constraintNugget
            );
            if (!cGP?.valid) {
                allConstraintsGPValid = false;
                break;
            }
            globalConstraintModels.push(cGP);
        }
        if (!loadGP?.valid || !allConstraintsGPValid) {
            consecutiveMatrixFailures++;
            const fallback = generateRandomPoint(evaluatedKeys);
            if (!fallback || consecutiveMatrixFailures >= 3) break;
            pendingDecision = {
                method: "RANDOM_FALLBACK",
                reason: "GP_FIT_FAILED",
                trainingCount: N
            };
            await evaluate(fallback.physical, fallback.x, "FALLBACK_GP_FAILED");
            continue;
        }
        consecutiveMatrixFailures = 0;
        const hasFeasibleResult = Boolean(gBestMetrics);
        const bestObjectiveValue = hasFeasibleResult ? getObjectiveValue(gBestLoad) : NaN;
        const candidates = [];
        const candidateSources = [];
        const seenCandidateKeys = new Set(evaluatedKeys);
        const primaryPairs = residualPairsByConstraint[0] || [];
        runtime.emaStorage.load = estimateResidualSigmaScale(primaryPairs, "load", observedX, runtime.emaStorage.load, progressFactor);
        // При продолжении модель цели «сомневается» сильнее — шанс проверить то, в чём была слишком уверена
        const loadSigmaCalibration = runtime.emaStorage.load * (state ? VERIFY_SIGMA_FACTOR : 1);

        const constraintCorrelations = [];
        const constraintSigmaCalibrations = [];
        for (let k = 0; k < numConstraints; k++) {
            const pairsK = residualPairsByConstraint[k] || [];
            const prevScaleK = runtime.emaStorage.errors[k] ?? 1.0;
            const newScaleK = estimateResidualSigmaScale(pairsK, "error", observedX, prevScaleK, progressFactor);
            runtime.emaStorage.errors[k] = newScaleK;
            constraintSigmaCalibrations[k] = newScaleK;

            // Считаем физическую корреляцию между целью и ограничением по всем завершённым точкам с 1-го шага
            let nValid = 0, sumObj = 0, sumCon = 0;
            for (let i = 0; i < observedX.length; i++) {
                if (!observedIsComplete[i]) continue;
                const yObj = observedLogLoad[i];
                const yCon = observedLogConstraints[k]?.[i];
                if (Number.isFinite(yObj) && Number.isFinite(yCon)) {
                    sumObj += yObj;
                    sumCon += yCon;
                    nValid++;
                }
            }

            if (nValid < 5) {
                constraintCorrelations[k] = { rho: 0, rawRho: 0, samples: nValid };
            } else {
                const meanObj = sumObj / nValid;
                const meanCon = sumCon / nValid;
                let num = 0, denObj = 0, denCon = 0;
                for (let i = 0; i < observedX.length; i++) {
                    if (!observedIsComplete[i]) continue;
                    const yObj = observedLogLoad[i];
                    const yCon = observedLogConstraints[k]?.[i];
                    if (Number.isFinite(yObj) && Number.isFinite(yCon)) {
                        const dObj = yObj - meanObj;
                        const dCon = yCon - meanCon;
                        num += dObj * dCon;
                        denObj += dObj * dObj;
                        denCon += dCon * dCon;
                    }
                }
                const denom = Math.sqrt(denObj * denCon);
                const rawRho = denom > 1e-12 ? Math.max(-0.98, Math.min(0.98, num / denom)) : 0;
                const shrinkage = nValid / (nValid + 10);
                const rho = Math.max(-0.85, Math.min(0.85, rawRho * shrinkage));
                constraintCorrelations[k] = { rho, rawRho, samples: nValid };
            }
        }

        // Считаем долю успешных попаданий в ограничения за последние 8 шагов после инициализации
        const bayesFeasHistory = observedAllFeasible.slice(initPointsCount);
        const recentWindow = bayesFeasHistory.slice(-8);
        const recentFeasRate = recentWindow.length > 0
            ? recentWindow.filter(Boolean).length / recentWindow.length
            : 0.5;

        // Базовый порог адаптируется к статистике: при частых нарушениях растёт, при серии успехов — смягчается
        const adaptiveBaseFeas = Math.max(0.20, Math.min(0.42, 0.36 - 0.18 * recentFeasRate));

        const getDynamicMinFeasibility = (evalPred, isLocalOpt = false) => {
            if (!hasFeasibleResult || numConstraints === 0) return 0;

            let maxRelUncertainty = 0;
            let activeCount = 0;
            for (let k = 0; k < numConstraints; k++) {
                const cPred = evalPred.constraintPreds[k];
                const cGP = globalConstraintModels[k];
                if (!cPred || !cGP) continue;
                if (evalPred.probs[k] < 0.98) activeCount++;

                const relSigma = cPred.sigmaLog / Math.max(1e-6, cGP.yStd);
                if (relSigma > maxRelUncertainty) {
                    maxRelUncertainty = relSigma;
                }
            }

            // Если модель плохо знает область (relSigma > 0.15), требуем пропорционально более высокую надёжность
            const epistemicPenalty = Math.max(0, Math.min(0.28, (maxRelUncertainty - 0.15) * 0.45));
            const constraintScale = Math.pow(adaptiveBaseFeas, Math.sqrt(Math.max(1, activeCount)));
            const optOffset = isLocalOpt ? 0.03 : 0.0;

            return Math.max(0.18, Math.min(0.65, constraintScale + epistemicPenalty + optOffset));
        };
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
        // Вероятность допустимости при условии значения цели z (в σ её прогноза).
        // Учитывает корреляцию цели с каждым ограничением; ограничения, совпадающие
        // с самой целью (rho > 0.92 при минимизации), пропускаются — их учитывает EI.
        const buildConditionalFeasibility = (evalPred) => {
            const active = [];
            let staticProb = 1.0;
            for (let k = 0; k < numConstraints; k++) {
                const cPred = evalPred.constraintPreds[k];
                const probK = evalPred.probs[k];
                if (probK >= 0.999999) continue;

                const corrInfo = constraintCorrelations[k];
                const isSelfObjectiveConstraint =
                    !isMaximize() && corrInfo && corrInfo.samples >= 12 && corrInfo.rawRho > 0.92;
                if (isSelfObjectiveConstraint) continue;

                if (!cPred || cPred.sigmaLog <= 1e-9) {
                    staticProb *= probK;
                    continue;
                }
                const rho = Math.max(-0.8, Math.min(0.8, corrInfo?.rho || 0));
                active.push({
                    limZ: (Math.log1p(constraintLimitsGP[k]) - cPred.meanLog) / cPred.sigmaLog,
                    rho,
                    condSigma: Math.sqrt(Math.max(1e-12, 1 - rho * rho))
                });
            }
            return (z) => {
                if (staticProb === 0) return 0;
                let prob = staticProb;
                for (const p of active) prob *= normalCDF((p.limZ - p.rho * z) / p.condSigma);
                return prob;
            };
        };

        // ---------------------------------------------------------------
        // 7.10.4. ПУЛ: глобальная доля + облака регионов (коробки TuRBO)
        // ---------------------------------------------------------------
        const activeRegions = searchRegions.filter(r => r.active);
        const rawPoolSize = POOL_BASE_SIZE + POOL_PER_PARAM * numParams;
        const globalCount = activeRegions.length > 0
            ? Math.round(rawPoolSize * GLOBAL_POOL_SHARE)
            : rawPoolSize;
        const localCount = rawPoolSize - globalCount;

        const addCandidate = (q, type, regionId) => {
            if (!q || seenCandidateKeys.has(q.key)) return false;
            seenCandidateKeys.add(q.key);
            candidates.push(q.x);
            candidateSources.push({ type, regionId });
            return true;
        };

        const globalBatch = generateDiscreteSobolPoints({
            count: globalCount,
            bounds: space.sobolBounds,
            sobolState: globalSobolState,
            seenKeys: seenCandidateKeys
        });
        let globalGenerated = 0;
        for (const pt of globalBatch.points) {
            if (addCandidate(space.fromSobolPoint(pt), "GLOBAL", -1)) globalGenerated++;
        }

        // Лидеру — половина локальной квоты, остальное поровну между прочими регионами
        const leaderRegion = getLeaderRegion();
        let localGenerated = 0;
        for (const reg of activeRegions) {
            const share = activeRegions.length === 1
                ? 1
                : (reg === leaderRegion ? 0.5 : 0.5 / Math.max(1, activeRegions.length - (leaderRegion ? 1 : 0)));
            const quota = Math.max(4, Math.round(localCount * share));
            localGenerated += sampleRegionCloud(reg, quota, addCandidate);
        }

        // ---------------------------------------------------------------
        // 7.10.5. ОЦЕНКА ПУЛА: EI с ограничениями (или вероятность допустимости)
        // ---------------------------------------------------------------
        const tolFloor = relObjTol !== null ? relObjTol * 0.25 : 1e-4;
        const stagnationRatioEI = Math.min(1.0, lowEIConsecutiveCount / 4);
        const adaptiveFloor = 1.5e-4 + 4.5e-4 * Math.max(progressFactor * 0.7, stagnationRatioEI);
        const MIN_SIGNIFICANT_EI = Math.max(tolFloor, adaptiveFloor);
        // «Улучшать нечего»: ожидаемое улучшение меньше половины допуска цели из задачи
        const EI_NEGLIGIBLE = relObjTol !== null ? relObjTol : MIN_SIGNIFICANT_EI;
        const scoreCandidate = (candX) => {
            const evalPred = evaluateCandidatePredictions(candX);
            if (!evalPred) return null;
            const { loadPrediction, constraintPreds, pFeasible } = evalPred;
            let acquisition;
            if (hasFeasibleResult) {
                if (pFeasible < getDynamicMinFeasibility(evalPred, false)) {
                    acquisition = 0;
                } else {
                    let isFarOutsideLimit = false;
                    if (pFeasible < 0.28) {
                        for (let k = 0; k < numConstraints; k++) {
                            const cPred = constraintPreds[k];
                            const lim = constraintLimitsGP[k];
                            if (cPred && Number.isFinite(lim) && cPred.meanLog > Math.log1p(lim) + FAR_OUTSIDE_LOG_MARGIN) {
                                isFarOutsideLimit = true;
                                break;
                            }
                        }
                    }
                    acquisition = isFarOutsideLimit
                        ? 0
                        : calculateConstrainedEI(
                            bestObjectiveValue,
                            loadPrediction,
                            buildConditionalFeasibility(evalPred),
                            isMaximize(),
                            refObjScale,
                            objT
                        );
                }
            } else {
                // Допустимой точки ещё нет: ищем самую вероятно допустимую
                acquisition = pFeasible + 1e-4 * Math.min(10, loadPrediction.sigmaNormalized);
            }
            return {
                acquisition,
                stats: {
                    loadPrediction,
                    allConstraintPredictions: constraintPreds,
                    pFeasible,
                    ei: hasFeasibleResult ? acquisition : null,
                    acquisition
                }
            };
        };

        const scored = [];
        let invalidPredictionCount = 0;
        let bestFeasibilityScore = 0;
        let explorationIdx = -1;
        let explorationScore = -Infinity;
        for (let c = 0; c < candidates.length; c++) {
            const s = scoreCandidate(candidates[c]);
            if (!s) {
                invalidPredictionCount++;
                continue;
            }
            scored.push({ idx: c, ...s });
            bestFeasibilityScore = Math.max(bestFeasibilityScore, s.stats.pFeasible);
            if (candidateSources[c].type === "GLOBAL") {
                // Разведка: максимум неопределённости среди достаточно вероятно допустимых точек
                const explore = s.stats.pFeasible >= 0.25 ? s.stats.loadPrediction.sigmaNormalized * s.stats.pFeasible : -Infinity;
                if (explore > explorationScore) {
                    explorationScore = explore;
                    explorationIdx = c;
                }
            }
        }
        scored.sort((a, b) => b.acquisition - a.acquisition);

        let bestAcquisition = scored.length ? scored[0].acquisition : -Infinity;
        let selectedIndexInPool = scored.length ? scored[0].idx : -1;
        let bestCandidateStats = scored.length ? scored[0].stats : null;
        let nextBestX = scored.length ? candidates[selectedIndexInPool] : null;

        // ---------------------------------------------------------------
        // 7.10.5b. ЛОКАЛЬНАЯ ОПТИМИЗАЦИЯ EI ОТ ЛУЧШИХ КАНДИДАТОВ (внутри коробки региона)
        // ---------------------------------------------------------------
        const eiOptStats = { starts: 0, improvements: 0, cutByFeas: 0 };
        if (hasFeasibleResult && scored.length > 0) {
            const evalPointAcquisition = (candX) => {
                const evalPred = evaluateCandidatePredictions(candX);
                if (!evalPred) return null;

                const { loadPrediction, constraintPreds, pFeasible } = evalPred;
                const condProbFn = buildConditionalFeasibility(evalPred);

                const dynamicLocalFloor = getDynamicMinFeasibility(evalPred, true);
                if (pFeasible < dynamicLocalFloor) {
                    eiOptStats.cutByFeas++;
                    return null;
                }

                const ei = calculateConstrainedEI(
                    bestObjectiveValue,
                    loadPrediction,
                    condProbFn,
                    isMaximize(),
                    refObjScale,
                    objT
                );
                if (!Number.isFinite(ei) || ei <= 0) return null;

                return {
                    acquisition: ei,
                    stats: {
                        loadPrediction,
                        allConstraintPredictions: constraintPreds,
                        pFeasible,
                        ei,
                        acquisition: ei
                    }
                };
            };
            // Вычисление дискретно-адаптированного градиента с проекцией на границу ограничений
            const computeProjectedStepDirection = (xPoint) => {
                const centerPred = evaluateCandidatePredictions(xPoint);
                if (!centerPred) return null;

                const gradObj = new Float64Array(numParams);
                const constraintGrads = [];
                const activeConstraints = [];

                for (let k = 0; k < numConstraints; k++) {
                    const probK = centerPred.probs[k];
                    if (probK < 0.80) {
                        activeConstraints.push({ k, probK });
                        constraintGrads.push(new Float64Array(numParams));
                    }
                }

                const goalSign = isMaximize() ? 1.0 : -1.0;

                for (let d = 0; d < numParams; d++) {
                    const cellStep = normAxisSteps[d] || 0.01;
                    const h = Math.max(0.005, cellStep * 0.5);
                    const xPlus = new Float64Array(xPoint);
                    const xMinus = new Float64Array(xPoint);
                    xPlus[d] = Math.min(1, xPoint[d] + h);
                    xMinus[d] = Math.max(0, xPoint[d] - h);
                    const spanH = xPlus[d] - xMinus[d];
                    if (spanH <= 1e-9) continue;

                    const predPlus = evaluateCandidatePredictions(xPlus);
                    const predMinus = evaluateCandidatePredictions(xMinus);
                    if (!predPlus || !predMinus) continue;

                    // Градиент улучшения цели с лёгким учётом неопределённости
                    const dObjMean = (predPlus.loadPrediction.meanLog - predMinus.loadPrediction.meanLog) / spanH;
                    const dObjSigma = (predPlus.loadPrediction.sigmaLog - predMinus.loadPrediction.sigmaLog) / spanH;
                    gradObj[d] = goalSign * dObjMean + 0.15 * dObjSigma;

                    // Градиенты роста активных ограничений (направлены в запретную зону)
                    for (let idx = 0; idx < activeConstraints.length; idx++) {
                        const k = activeConstraints[idx].k;
                        const cPlus = predPlus.constraintPreds[k];
                        const cMinus = predMinus.constraintPreds[k];
                        if (cPlus && cMinus) {
                            constraintGrads[idx][d] = (cPlus.meanLog - cMinus.meanLog) / spanH;
                        }
                    }
                }

                // Проекция градиента цели на касательную плоскость к активным ограничениям
                const projDir = new Float64Array(gradObj);
                for (let pass = 0; pass < 2; pass++) {
                    for (let idx = 0; idx < activeConstraints.length; idx++) {
                        const gCon = constraintGrads[idx];
                        const probK = activeConstraints[idx].probK;
                        let dot = 0;
                        let normSqCon = 0;
                        for (let d = 0; d < numParams; d++) {
                            dot += projDir[d] * gCon[d];
                            normSqCon += gCon[d] * gCon[d];
                        }
                        if (normSqCon <= 1e-12) continue;

                        // Если шаг толкает в стену (dot > 0) — убираем нормальную составляющую;
                        // если уже слишком близко к нарушению (probK < 0.45) — добавляем мягкий возврат
                        const restorePush = probK < 0.45 ? (0.45 - probK) * 0.5 * Math.sqrt(normSqCon) : 0;
                        if (dot > 0 || restorePush > 0) {
                            const coeff = (Math.max(0, dot) + restorePush) / normSqCon;
                            for (let d = 0; d < numParams; d++) {
                                projDir[d] -= coeff * gCon[d];
                            }
                        }
                    }
                }

                // Масштабируем направление с учётом характерных масштабов осей
                let normSq = 0;
                for (let d = 0; d < numParams; d++) {
                    const scale = Math.max(0.1, Math.min(1.5, globalGPState.loadLengthScales?.[d] ?? 0.55));
                    projDir[d] *= scale;
                    normSq += projDir[d] * projDir[d];
                }
                if (normSq <= 1e-12) return null;

                const invNorm = 1 / Math.sqrt(normSq);
                for (let d = 0; d < numParams; d++) {
                    projDir[d] *= invNorm;
                }
                return projDir;
            };

            // Кандидат локального подъёма: добавить в пул и, если он заметно лучше, сделать выбранным
            const registerLocalCandidate = (q, qScored, regionId) => {
                if (!addCandidate(q, "LOCAL_EI_OPT", regionId)) return;
                if (qScored.acquisition >= EI_NEGLIGIBLE && qScored.acquisition > bestAcquisition * 1.005) {
                    eiOptStats.improvements++;
                    bestAcquisition = qScored.acquisition;
                    nextBestX = q.x;
                    bestCandidateStats = qScored.stats;
                    selectedIndexInPool = candidates.length - 1;
                }
            };

            // Ходы по сетке: ±1 ячейка по каждой оси и по парам осей
            const gridMoves = [];
            for (let d = 0; d < numParams; d++) {
                for (const dir of [-1, 1]) gridMoves.push([{ dim: d, dir }]);
            }
            for (let d1 = 0; d1 < numParams; d1++) {
                for (let d2 = d1 + 1; d2 < numParams; d2++) {
                    for (const dir1 of [-1, 1]) {
                        for (const dir2 of [-1, 1]) gridMoves.push([{ dim: d1, dir: dir1 }, { dim: d2, dir: dir2 }]);
                    }
                }
            }

            // Двухшаговый манёвр (дискретные «грубые» оси): сдвиг по крупной оси (±1 ячейка) + компенсация по мелким осям до границы
            if (gBestPhysical && numParams > 1) {
                const baseLeaderX = space.toNormalized(gBestPhysical);
                const hasFineAxis = Array.from(isCoarseAxis).some(flag => flag === 0);
                if (baseLeaderX && hasFineAxis) {
                    for (let coarseDim = 0; coarseDim < numParams; coarseDim++) {
                        if (!isCoarseAxis[coarseDim]) continue;

                        for (const dir of [-1, 1]) {
                            const shiftedQ = space.stepAxis(baseLeaderX, coarseDim, dir);
                            if (!shiftedQ) continue;

                            let compX = new Float64Array(shiftedQ.x);
                            const compResidual = new Float64Array(numParams);
                            let compStep = 0.018;

                            for (let sub = 0; sub < 8; sub++) {
                                const dirVec = computeProjectedStepDirection(compX);
                                if (!dirVec) break;

                                dirVec[coarseDim] = 0;
                                let fineNormSq = 0;
                                for (let d = 0; d < numParams; d++) fineNormSq += dirVec[d] * dirVec[d];
                                if (fineNormSq <= 1e-12) break;

                                const invFineNorm = 1 / Math.sqrt(fineNormSq);
                                const trialCont = new Float64Array(compX);
                                for (let d = 0; d < numParams; d++) {
                                    if (d === coarseDim) continue;
                                    const unitD = dirVec[d] * invFineNorm;
                                    const lowBound = Math.max(0, baseLeaderX[d] - 0.14);
                                    const highBound = Math.min(1, baseLeaderX[d] + 0.14);
                                    const nextPos = compX[d] + unitD * compStep + compResidual[d];
                                    trialCont[d] = Math.max(lowBound, Math.min(highBound, nextPos));
                                }

                                const qComp = space.quantize(trialCont);
                                if (!qComp) break;

                                for (let d = 0; d < numParams; d++) {
                                    if (d === coarseDim) continue;
                                    const maxRem = normAxisSteps[d] || 0.01;
                                    compResidual[d] = Math.max(-maxRem, Math.min(maxRem, trialCont[d] - qComp.x[d]));
                                }

                                const predComp = evaluateCandidatePredictions(qComp.x);
                                if (!predComp) break;

                                if (predComp.pFeasible >= getDynamicMinFeasibility(predComp, false)) {
                                    compX = qComp.x;
                                    const qScored = evalPointAcquisition(qComp.x);
                                    if (qScored && !seenCandidateKeys.has(qComp.key)) {
                                        registerLocalCandidate(qComp, qScored, leaderRegion ? leaderRegion.id : -1);
                                    }
                                } else {
                                    compStep *= 0.5;
                                    compResidual.fill(0);
                                    if (compStep < 0.005) break;
                                }
                            }
                        }
                    }
                }
            }

            // Старты: лидер (лучшая допустимая точка) + топ-K кандидатов пула
            const startEntries = [];
            const leaderX = gBestPhysical ? space.toNormalized(gBestPhysical) : null;
            if (leaderX) startEntries.push({ x: leaderX, regionId: leaderRegion ? leaderRegion.id : -1 });
            const topK = Math.min(LOCAL_OPT_STARTS_MAX, 2 + numParams);
            for (const s of scored.slice(0, topK)) {
                if (!(s.acquisition > 0)) break;
                startEntries.push({ x: candidates[s.idx], regionId: candidateSources[s.idx].regionId });
            }

            for (const entry of startEntries) {
                const startQ = space.quantize(entry.x);
                if (!startQ) continue;
                eiOptStats.starts++;
                const reg = entry.regionId >= 0 ? searchRegions.find(r => r.id === entry.regionId && r.active) : null;
                // Коробка доверия: регион-источник или (для глобальных стартов) начальный размер
                const halfWidths = regionHalfWidths(reg ? reg.length : TR_LENGTH_INIT / 2);
                const boxCenter = reg ? reg.bestX : startQ.x;
                const inBox = (x) => {
                    for (let d = 0; d < numParams; d++) {
                        if (Math.abs(x[d] - boxCenter[d]) > halfWidths[d] + 1e-12) return false;
                    }
                    return true;
                };

                let currentX = new Float64Array(startQ.x);
                let currentKey = startQ.key;
                const startScored = evalPointAcquisition(currentX);
                let localBestAcq = startScored ? startScored.acquisition : 0;

                // Фаза 1: подъём по проекции градиента с накоплением остатка округления
                const residualBuffer = new Float64Array(numParams);
                let stepSize = 0.045;
                let stalledSubSteps = 0;
                for (let iter = 0; iter < 8; iter++) {
                    const stepDir = computeProjectedStepDirection(currentX);
                    if (!stepDir) break;
                    const trialCont = new Float64Array(numParams);
                    for (let d = 0; d < numParams; d++) {
                        const lo = Math.max(0, boxCenter[d] - halfWidths[d]);
                        const hi = Math.min(1, boxCenter[d] + halfWidths[d]);
                        trialCont[d] = Math.max(lo, Math.min(hi, currentX[d] + stepDir[d] * stepSize + residualBuffer[d]));
                    }
                    const q = space.quantize(trialCont);
                    if (!q) break;
                    for (let d = 0; d < numParams; d++) {
                        const maxRem = normAxisSteps[d] || 0.02;
                        residualBuffer[d] = Math.max(-maxRem, Math.min(maxRem, trialCont[d] - q.x[d]));
                    }
                    if (q.key === currentKey) {
                        if (++stalledSubSteps >= 2) {
                            stepSize *= 1.5;
                            stalledSubSteps = 0;
                        }
                        continue;
                    }
                    stalledSubSteps = 0;
                    const qScored = evalPointAcquisition(q.x);
                    if (qScored && qScored.acquisition > localBestAcq * 1.001) {
                        localBestAcq = qScored.acquisition;
                        currentX = q.x;
                        currentKey = q.key;
                        registerLocalCandidate(q, qScored, entry.regionId);
                    } else {
                        stepSize *= 0.5;
                        residualBuffer.fill(0);
                        if (stepSize < 0.006) break;
                    }
                }

                // Фаза 2: точный дожим по соседним ячейкам сетки (оси и диагонали ±1)
                let improved = true;
                for (let pass = 0; improved && pass < 3; pass++) {
                    improved = false;
                    for (const moves of gridMoves) {
                        const q = space.stepGrid(currentX, moves);
                        if (!q || seenCandidateKeys.has(q.key) || !inBox(q.x)) continue;
                        const qScored = evalPointAcquisition(q.x);
                        if (qScored && qScored.acquisition > localBestAcq * 1.002) {
                            localBestAcq = qScored.acquisition;
                            currentX = q.x;
                            improved = true;
                            registerLocalCandidate(q, qScored, entry.regionId);
                        }
                    }
                }
            }
        }
        // Чистый (без локальных добавок) максимум EI по всему пулу — для критериев сходимости
        const bestPoolAcquisition = Math.max(bestAcquisition, scored.length ? scored[0].acquisition : -Infinity);

        if (!hasFeasibleResult && numConstraints > 0) {
            const violationImproved =
                Number.isFinite(fallbackViolation) &&
                (!Number.isFinite(infeasibleRefViolation) || fallbackViolation < infeasibleRefViolation * 0.95);
            if (violationImproved) {
                infeasibleRefViolation = fallbackViolation;
                infeasibleStallCount = 0;
            } else if (bestFeasibilityScore < INFEASIBLE_PROBABILITY_THRESHOLD) {
                infeasibleStallCount++;
            } else {
                infeasibleStallCount = 0;
            }
            if (infeasibleStallCount >= infeasiblePatience) {
                emitStepLog({
                    type: "EARLY_STOP_LIKELY_INFEASIBLE",
                    stepNumber: currentExecutionCount,
                    bestFeasibilityProbability: bestFeasibilityScore,
                    leastViolation: fallbackViolation
                });
                emitStructuredLog(
                    "SYSTEM",
                    `⚠️ Early stop at step #${currentExecutionCount}: constraints look unsatisfiable in this parameter range (max P(feasible) < ${INFEASIBLE_PROBABILITY_THRESHOLD}). Returning the least-violating configuration.`,
                    buildSimulationSnapshot(
                        currentExecutionCount,
                        "WARN",
                        100,
                        null,
                        null,
                        "Likely infeasible"
                    )
                );
                break;
            }
        }
        // ---------------------------------------------------------------
        // 7.10.6. ВЫБОР: улучшение / разведка / поиск допустимости
        // ---------------------------------------------------------------
        // Модель не видит улучшения нигде в пуле. Регион-лидер сжимается без симуляции,
        // но не более одного раза подряд: следующий шаг обязательно проверяет лучшего
        // кандидата реальным прогоном (модель возле границ ограничений бывает слишком
        // пессимистична). Лидер минимального размера после такой проверки — сошёлся.
        let forceExploit = false;
        if (hasFeasibleResult && bestPoolAcquisition < EI_NEGLIGIBLE) {
            const lead = searchRegions.find(r => r.active && regionHoldsGlobalBest(r));
            if (lead) {
                if (lead.shrunkWithoutEval) {
                    // Лучший непосчитанный кандидат из коробки самого лидера
                    const own = scored.find(e => candidateSources[e.idx].regionId === lead.id);
                    if (!own || (isRegionAtMinimumSize(lead) && lead.checkedAtMinimum)) {
                        convergeRegion(lead);
                        continue;
                    }
                    forceExploit = true;
                    nextBestX = candidates[own.idx];
                    selectedIndexInPool = own.idx;
                    bestCandidateStats = own.stats;
                    if (isRegionAtMinimumSize(lead)) lead.checkedAtMinimum = true;
                } else {
                    lead.shrunkWithoutEval = true;
                    if (!isRegionAtMinimumSize(lead)) {
                        lead.length /= 2;
                        lead.failureCount = 0;
                        lead.successCount = 0;
                        lead.lastStep = null;
                        emitStepLog({
                            type: "REGION_SHRUNK_BY_MODEL",
                            stepNumber: currentExecutionCount,
                            regionId: lead.id,
                            length: lead.length,
                            bestPoolAcquisition
                        });
                    }
                    continue;
                }
            }
        }

        let selectionMethod = hasFeasibleResult ? "CONSTRAINED_EXPECTED_IMPROVEMENT" : "FEASIBILITY_SEARCH";
        let selectionFallbackReason = null;
        if (!forceExploit && hasFeasibleResult && bestPoolAcquisition < EI_NEGLIGIBLE && explorationIdx >= 0) {
            // Лидер уже сошёлся и улучшения нигде нет — изучаем самое неопределённое место
            nextBestX = candidates[explorationIdx];
            selectedIndexInPool = explorationIdx;
            const s = scored.find(e => e.idx === explorationIdx);
            bestCandidateStats = s ? s.stats : null;
            selectionMethod = "UNCERTAINTY_EXPLORATION";
            selectionFallbackReason = "NON_POSITIVE_CONSTRAINED_EI";
        }
        if (!nextBestX) {
            selectionMethod = "RANDOM_FALLBACK";
            selectionFallbackReason = "NO_VALID_CANDIDATE";
            const fallback = generateRandomPoint(evaluatedKeys);
            if (!fallback) break;
            nextBestX = fallback.x;
            bestCandidateStats = null;
            selectedIndexInPool = -1;
        }
        const chosenSource = selectedIndexInPool >= 0
            ? candidateSources[selectedIndexInPool]
            : { type: "FALLBACK", regionId: -1 };
        const resolvedSelectedPhysical = space.quantize(nextBestX)?.physical || space.toPhysical(nextBestX);

        // ---------------------------------------------------------------
        // 7.10.7. ФИКСАЦИЯ РЕШЕНИЯ И ДИАГНОСТИКА
        // ---------------------------------------------------------------
        const stats = bestCandidateStats;
        pendingDecision = {
            method: selectionMethod,
            sourceDiagnostics: chosenSource,
            predictionForResidual: stats
                ? {
                    transformMode: objT.mode,
                    loadMeanLog: stats.loadPrediction.meanLog,
                    loadSigmaLog: stats.loadPrediction.rawSigmaLog,
                    constraints: (stats.allConstraintPredictions || []).map(c => ({
                        meanLog: c?.meanLog ?? NaN,
                        sigmaLog: c?.rawSigmaLog ?? NaN
                    }))
                }
                : null
        };
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
            objectiveTransform: objT.mode,
            gpScales: {
                objective: Array.from(loadGP.lengthScales),
                objectiveLML: loadGP.logMarginalLikelihood,
                constraints: globalConstraintModels.map((cGP, idx) => ({
                    name: constraintNames[idx] || `c_${idx}`,
                    scales: Array.from(cGP.lengthScales),
                    lml: cGP.logMarginalLikelihood
                }))
            },
            eiOptStats,
            convergenceState: {
                gBestValue: gBestMetrics ? gBestLoad : null,
                gBestStep: runtime.bestStepNumber,
                stepsWithoutImprovement: stepsWithoutGlobalImprovement,
                lowEIConsecutiveCount
            },
            poolDiagnostics: {
                totalCandidatesInPool: candidates.length,
                globalGenerated,
                localGenerated,
                invalidPredictions: invalidPredictionCount
            },
            constraintsCalibration: constraintNames.map((name, idx) => ({
                name,
                rho: constraintCorrelations[idx]?.rho ?? 0,
                rawRho: constraintCorrelations[idx]?.rawRho ?? 0,
                samples: constraintCorrelations[idx]?.samples ?? 0,
                sigmaScale: constraintSigmaCalibrations[idx] ?? 1.0
            })),
            objectiveSigmaCalibration: loadSigmaCalibration,
            selectedCandidatePrediction: stats
                ? {
                    predictedValue: objT.inverse(stats.loadPrediction.meanLog),
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
            regionsDiagnostics: searchRegions.map(reg => ({
                id: reg.id,
                active: reg.active,
                converged: reg.converged,
                length: reg.length,
                bestVal: reg.bestLoad,
                bestViol: reg.bestViolation,
                successCount: reg.successCount,
                failureCount: reg.failureCount,
                attempts: reg.attempts,
                improvements: reg.improvements
            }))
        });

        const stepBeforeEval = runtime.significantBestStep || 0;
        await evaluate(resolvedSelectedPhysical, nextBestX);
        seedRegionsIfEmpty();

        // ---------------------------------------------------------------
        // 7.10.8. КОНТРОЛЬ СХОДИМОСТИ
        // ---------------------------------------------------------------
        if (runtime.significantBestStep && runtime.significantBestStep > stepBeforeEval) {
            stepsWithoutGlobalImprovement = 0;
        } else {
            stepsWithoutGlobalImprovement++;
        }
        const baseEIThreshold = relObjTol !== null
            ? Math.max(0.0005, Math.min(0.005, relObjTol * 1.2))
            : 0.0015;
        // Не ниже порога «улучшать нечего»: иначе при крупном допуске цели оптимизатор уходит
        // в разведку (EI < EI_NEGLIGIBLE), но и не останавливается (EI > порога исчерпания)
        const EI_EXHAUSTION_THRESHOLD = Math.max(EI_NEGLIGIBLE, baseEIThreshold + 0.002 * progressFactor);
        if (Number.isFinite(bestPoolAcquisition) && bestPoolAcquisition < EI_EXHAUSTION_THRESHOLD) {
            lowEIConsecutiveCount++;
        } else {
            lowEIConsecutiveCount = 0;
        }
        // Страховка: модель долго нигде не видит улучшения — останавливаемся при любом состоянии регионов
        const hardLowEIStop = lowEIConsecutiveCount >= Math.max(15, 3 * (numParams + 2));
        if ((leaderConverged && lowEIConsecutiveCount >= convergenceLowEISteps) || hardLowEIStop) {
            emitStepLog({
                type: "EARLY_STOP_CONVERGED",
                stepNumber: currentExecutionCount,
                stepsWithoutGlobalImprovement,
                lowEIConsecutiveCount
            });
            emitStructuredLog(
                "SYSTEM",
                `⚡ Search converged at step #${currentExecutionCount}: the best point is refined down to one grid cell and the model sees no promising regions left.`,
                buildSimulationSnapshot(currentExecutionCount, "SUCCESS", 100, null, null, "Converged")
            );
            break;
        }
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
            bestStep: runtime.bestStepNumber
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
            bestStepNumber: runtime.bestStepNumber,
            technicalMetrics: finalMetrics
        },
        diagnosticLogText: diag.getText(),
        resumeState: {
            goalDirection,
            objectiveTolerance,
            objectiveShift,
            objectiveTransformMode: objT.mode,
            leaderConverged,
            objectiveNonNegative,
            lastTransformCheckCount,
            currentExecutionCount,
            sobolDraws: globalSobolState.drawsCount,
            prngState,
            lastEMAStorage: runtime.emaStorage,
            evaluatedKeys: Array.from(evaluatedKeys),
            observedX,
            observedLoad,
            observedLogLoad,
            observedLoadNoise,
            observedLogConstraints,
            observedConstraintNoise,
            constraintLimitsGP,
            constraintNames,
            observedConstraintExcess,
            constraintScales,
            constraintScaleIsDynamic,
            constraintTols,
            constraintDefs,
            abortMetricConstraintIdx,
            observedAllFeasible,
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
            lastSignificantBestLoad,
            significantBestStep: runtime.significantBestStep,
            lastEvaluatedBestStepNumber: runtime.bestStepNumber,
            fallbackMetrics,
            fallbackPhysical,
            fallbackLoad,
            fallbackConstraints,
            fallbackViolation,
            fallbackObjective
        }
    };
}


