/**
 * Optimized 2D transient FULLY IMPLICIT finite-difference heating and cooling model for opaque plastics (PVC).
 * Features dynamic spatial grid generation concentrated around intense physical gradient zones (5-8 mm).
 * Includes seamless fallback to efficient 1D calculation mode when width is 0.
 *
 * COMPACT VERSION: Eliminates grid redundancy. Coordinates are stored once under 'temperatureProfile',
 * while thermal fields are split into 'heating' (after oven) and 'pause' (after transfer cooling).
 *
 * PERFORMANCE-SAFE SOLVER WORK COUNTERS ADDED VIA REGISTERS/STACK LET VARIABLES.
 *
 * Update: Error metrics shifted to LOCALLY-ORIENTED approach (Honest Center with 2D diffusion consideration).
 * CPU load minimized (error calculations executed in O(1) per step).
 */
import {normalizeMachine} from "../pvc-1d-transient-heating";

export const ACCURACY_MODES = ["fast", "optimal", "accurate", "accurate2"];

export const LIMITS = {
    gridX:        [0.35,  0.16,  0.116, 0.135 ], // Шаг сетки по горизонтали X (мм)
    gridY:        [1.30,  0.78,  0.307, 0.330 ], // Шаг сетки по вертикали Y (мм)

    tempStepK:     [2.0,   2.13,  0.77,  0.65  ], // Целевой шаг изменения температуры за итерацию (К)

};

export const DEFAULT_SLOT_HALF_WIDTH_MM = 5.0;           // Половина ширины щели нагревателя (ТЭНа)
export const DEFAULT_CONVECTION_TRANSITION_END_MM = 8.0; // Граница рассеивания жара (начало холодной зоны)

const MAX_NODES_X = 300;
const MAX_NODES_Y = 500;
const MAX_BAND_MATRIX_ELEMENTS = 15000000;
const MIN_GEOMETRIC_STEP_MM = 0.000001;


export const SIGMA = 5.670374419e-8;
export const HEATER_RADIUS_MM = 3.0;
export const DISTANCE_TO_SHEET_MM = 8.0;

const UI_PROGRESS_THROTTLE_MS = 40; // Минимальный интервал реального времени между отправками прогресса в UI (в миллисекундах)

const MAX_TOTAL_TIME_STEPS = 100000;  // Жесткий потолок на число шагов по времени
const MAX_CONSECUTIVE_REJECTIONS = 12;// Максимальное количество неудачных попыток сжатия шага dt подряд на одном месте
const MAX_PICARD_ITERATIONS = 40;

// Параметры автоматического регулятора шага времени (PI-контроллер)
const DT_SAFETY_FACTOR = 0.85;        // Коэффициент безопасности при прогнозе следующего шага
const DT_MAX_GROWTH_FACTOR = 1.45;    // Максимальный множитель роста dt за один успешный шаг
const DT_MIN_SUCCESS_SHRINK = 0.50;   // Минимальный множитель сжатия dt на успешном шаге
const DT_REJECT_MIN_SHRINK = 0.35;    // Нижняя граница сжатия dt при отказе солвера
const DT_REJECT_MAX_SHRINK = 0.75;    // Верхняя граница сжатия dt при отказе солвера
const DT_FALLBACK_RESIDUAL_RATIO = 4.0; // Аварийное отношение невязки при нечисловой ошибке
const DT_SINGULARITY_SHRINK = 0.50;   // Множитель сжатия при вырожденной матрице (нулевая диагональ)
const MIN_PHYSICAL_DT_SECONDS = 0.005;// Защитный пол шага при приближении к границам температур

const EFFECTIVE_H_MM = DISTANCE_TO_SHEET_MM + HEATER_RADIUS_MM;
const AMBIENT_CONVECTION_H_TOP = 8.0;
const AMBIENT_CONVECTION_H_BOT = 7.0;

export function validateSimulationParams({ thicknessMm, material, machine, simulation}) {
    const errors = [];

    // 1. Базовая валидация верхнего уровня
    if (!validPositive(thicknessMm)) errors.push("Invalid thickness.");
    if (!material || typeof material !== "object") errors.push("Invalid material model.");
    if (!machine || typeof machine !== "object") {
        errors.push("Invalid machine.");
    } else if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) {
        errors.push("Exactly two heaters are required.");
    }
    if (!simulation || typeof simulation !== "object") errors.push("Simulation parameters are missing.");

    // Если структура критически нарушена на верхнем уровне, дальше проверять custom-параметры небезопасно
    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    // 2. Валидация кастомных параметров точности (accuracyMode)
    const am = simulation.accuracyMode;
    if (am && typeof am === "object") {
        if (!validPositive(am.gridX)) errors.push("Invalid custom parameter: gridX must be a positive number.");
        if (!validPositive(am.gridY)) errors.push("Invalid custom parameter: gridY must be a positive number.");

        if (!validPositive(am.tempStepK)) errors.push("Invalid custom parameter: tempStepK must be a positive number.");
    }

    // Итоговый вердикт по накопленным ошибкам
    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    return { isValid: true };
}

const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
const toKelvin = c => c + 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;

function getExcessEnthalpy(t, tg, jumpFactor, width, baseCp) {
    const halfWidth = width / 2;
    const tStart = tg - halfWidth;
    const tEnd = tg + halfWidth;
    const deltaCpMax = baseCp * (jumpFactor - 1.0);
    if (t <= tStart) return 0.0;
    if (t >= tEnd) return deltaCpMax * (t - (tStart + tEnd) / 2.0);
    return (deltaCpMax / (2.0 * width)) * (t - tStart) * (t - tStart);
}

function createMaterialModel(material) {
    if (!material || typeof material !== "object") return null;
    const tg = material.glassTransitionTemp;
    const jumpFactor = material.tgSpecificHeatJumpFactor;
    const width = material.tgTransitionWidthC;
    const isFnDensity = typeof material.density === "function";
    const isFnThermalConductivity = typeof material.thermalConductivity === "function";
    const isFnSpecificHeat = typeof material.specificHeat === "function";
    const matDensity = material.density;
    const matThermalConductivity = material.thermalConductivity;
    const matSpecificHeat = material.specificHeat;

    return {
        constant: false,
        properties: null,
        get: (temperatureC, oldTemperatureC = null) => {
            const density = isFnDensity ? matDensity(temperatureC) : matDensity;
            const k = isFnThermalConductivity ? matThermalConductivity(temperatureC) : matThermalConductivity;
            const baseCp = isFnSpecificHeat ? matSpecificHeat(temperatureC) : matSpecificHeat;
            let cp = baseCp;
            if (oldTemperatureC !== null && Math.abs(temperatureC - oldTemperatureC) > 1e-4) {
                const hOld = getExcessEnthalpy(oldTemperatureC, tg, jumpFactor, width, baseCp);
                const hNew = getExcessEnthalpy(temperatureC, tg, jumpFactor, width, baseCp);
                cp = baseCp + (hNew - hOld) / (temperatureC - oldTemperatureC);
            } else {
                const halfWidth = width / 2;
                const tStart = tg - halfWidth;
                const tEnd = tg + halfWidth;
                if (temperatureC > tStart && temperatureC <= tEnd) {
                    cp = baseCp + ((baseCp * jumpFactor - baseCp) / width) * (temperatureC - tStart);
                } else if (temperatureC > tEnd) {
                    cp = baseCp * jumpFactor;
                }
            }
            return { density, k, cp };
        }
    };
}

const makeError = (message, extra = {}) => ({
    status: { type: "error", message },
    heatingTimeSeconds: 0,
    coolingTimeSeconds: 0,
    calculationTimeMs: 0,
    reachedTarget: false,
    stoppedByMaxTemperature: false,
    temperatureProfile: null,
    accuracyMetrics: null,
    ...extra
});

function createNonlinearGridX(thicknessMm, nodeCount) {
    const x = new Float64Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
        const fraction = i / (nodeCount - 1);
        x[i] = thicknessMm * 0.5 * (1.0 - Math.cos(fraction * Math.PI));
    }
    x[0] = 0.0;
    x[nodeCount - 1] = thicknessMm;

    const dx = new Float64Array(nodeCount - 1);
    for (let i = 0; i < nodeCount - 1; i++) {
        const diff = x[i + 1] - x[i];
        dx[i] = diff < MIN_GEOMETRIC_STEP_MM ? MIN_GEOMETRIC_STEP_MM : diff;
    }

    const dxHat = new Float64Array(nodeCount);
    dxHat[0] = 0.5 * dx[0];
    for (let i = 1; i < nodeCount - 1; i++) dxHat[i] = 0.5 * (dx[i - 1] + dx[i]);
    dxHat[nodeCount - 1] = 0.5 * dx[nodeCount - 2];

    const invDxH = new Float64Array(nodeCount);
    const invDxL = new Float64Array(nodeCount);
    const invDxR = new Float64Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
        invDxH[i] = 1000.0 / dxHat[i];
        if (i > 0) invDxL[i] = 1000.0 / dx[i - 1];
        if (i < nodeCount - 1) invDxR[i] = 1000.0 / dx[i];
    }
    return { x, dx, dxHat, invDxH, invDxL, invDxR, nodeCount };
}


function createParametricGridY(
    widthHalfMm,
    nodeCount,
    slotHalfWidthMm,
    convectionTransitionEndMm
) {
    if (
        !Number.isFinite(widthHalfMm) ||
        widthHalfMm <= 0 ||
        !Number.isInteger(nodeCount) ||
        nodeCount < 2
    ) {
        throw new RangeError("Invalid Y-grid dimensions.");
    }

    const y = new Float64Array(nodeCount);

    // ============================================================
    // 1. ПАРАМЕТРЫ ФИЗИЧЕСКИ ОБУСЛОВЛЕННОГО СГУЩЕНИЯ
    // ============================================================

    const H = EFFECTIVE_H_MM;
    const H2 = H * H;

    const yCenter =
        (slotHalfWidthMm + convectionTransitionEndMm) / 2.0;

    const centerWidth = 3.0;

    const zoneWidth = Math.max(
        1e-6,
        (convectionTransitionEndMm - slotHalfWidthMm) * 0.5 || 1.5
    );

    const radiationPeakY = H * 0.5;

    const radiationPeakViewFactor = Math.pow(
        H2 / (H2 + radiationPeakY * radiationPeakY),
        1.5
    );

    const maxRadiationGradient =
        (3.0 * radiationPeakY /
            (H2 + radiationPeakY * radiationPeakY)) *
        radiationPeakViewFactor;

    // ============================================================
    // 2. ЕДИНАЯ ФУНКЦИЯ ПЛОТНОСТИ УЗЛОВ
    // ============================================================

    function getWeightDensity(posMm) {
        let weight = 1.0;

        // Центральная область: y = 0
        weight += 2.0 * Math.exp(
            -Math.pow(posMm / centerWidth, 2)
        );

        // Изменение пространственного фактора радиационного нагрева
        const viewFactor = Math.pow(
            H2 / (H2 + posMm * posMm),
            1.5
        );

        const radiationGradient =
            (3.0 * posMm / (H2 + posMm * posMm)) *
            viewFactor;

        const normalizedRadiationGradient =
            maxRadiationGradient > 0
                ? radiationGradient / maxRadiationGradient
                : 0;

        weight += 2.0 * normalizedRadiationGradient;

        // Зона изменения условий конвекции: 5–8 мм
        weight += 8.0 * Math.exp(
            -Math.pow(
                (posMm - yCenter) / zoneWidth,
                2
            )
        );

        return weight;
    }

    // ============================================================
    // 3. ИНТЕГРИРОВАНИЕ ПЛОТНОСТИ МЕТОДОМ ТРАПЕЦИЙ
    // ============================================================

    const integrationIntervals = Math.max(
        2048,
        nodeCount * 64
    );

    const integrationStep =
        widthHalfMm / integrationIntervals;

    const cumulative = new Float64Array(
        integrationIntervals + 1
    );

    let previousWeight = getWeightDensity(0);

    for (let i = 1; i <= integrationIntervals; i++) {
        const pos = i * integrationStep;
        const currentWeight = getWeightDensity(pos);

        cumulative[i] = cumulative[i - 1] +
            0.5 * (previousWeight + currentWeight) *
            integrationStep;

        previousWeight = currentWeight;
    }

    const totalWeight =
        cumulative[integrationIntervals];

    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        throw new Error("Invalid Y-grid density integral.");
    }

    // ============================================================
    // 4. ОБРАТНОЕ РАСПРЕДЕЛЕНИЕ КООРДИНАТ
    // ============================================================

    y[0] = 0.0;
    y[nodeCount - 1] = widthHalfMm;

    const minSpacing = Math.max(
        MIN_GEOMETRIC_STEP_MM,
        Number.EPSILON * widthHalfMm * 8
    );

    for (let j = 1; j < nodeCount - 1; j++) {
        const targetWeight =
            totalWeight * j / (nodeCount - 1);

        // Бинарный поиск интегральной координаты
        let low = 0;
        let high = integrationIntervals;

        while (high - low > 1) {
            const mid = (low + high) >> 1;

            if (cumulative[mid] < targetWeight) {
                low = mid;
            } else {
                high = mid;
            }
        }

        const c0 = cumulative[low];
        const c1 = cumulative[high];

        const fraction = c1 > c0
            ? (targetWeight - c0) / (c1 - c0)
            : 0;

        const rawPosition =
            (low + fraction) * integrationStep;

        // Строго монотонные координаты
        const lowerBound =
            y[j - 1] + minSpacing;

        const upperBound =
            widthHalfMm -
            (nodeCount - 1 - j) * minSpacing;

        if (lowerBound > upperBound) {
            throw new Error("Insufficient Y-grid spacing.");
        }

        y[j] = clamp(
            rawPosition,
            lowerBound,
            upperBound
        );
    }

    // ============================================================
    // 5. ГЕОМЕТРИЧЕСКИЕ ИНТЕРВАЛЫ
    // ============================================================

    const dy = new Float64Array(nodeCount - 1);
    const dyHat = new Float64Array(nodeCount);

    for (let j = 0; j < nodeCount - 1; j++) {
        dy[j] = y[j + 1] - y[j];
    }

    dyHat[0] = 0.5 * dy[0];

    for (let j = 1; j < nodeCount - 1; j++) {
        dyHat[j] = 0.5 * (dy[j - 1] + dy[j]);
    }

    dyHat[nodeCount - 1] =
        0.5 * dy[nodeCount - 2];

    // ============================================================
    // 6. ОБРАТНЫЕ ИНТЕРВАЛЫ
    // ============================================================

    const invDyH = new Float64Array(nodeCount);
    const invDyL = new Float64Array(nodeCount);
    const invDyR = new Float64Array(nodeCount);

    for (let j = 0; j < nodeCount; j++) {
        invDyH[j] = 1000.0 / dyHat[j];

        if (j > 0) {
            invDyL[j] = 1000.0 / dy[j - 1];
        }

        if (j < nodeCount - 1) {
            invDyR[j] = 1000.0 / dy[j];
        }
    }

    return {
        y,
        dy,
        dyHat,
        invDyH,
        invDyL,
        invDyR,
        nodeCount
    };
}

export function getNonlinearViewFactors(yCoordinatesMm) {
    const Ny = yCoordinatesMm.length;
    const viewFactors = new Float64Array(Ny);
    const H = EFFECTIVE_H_MM;
    const H2 = H * H;
    for (let j = 0; j < Ny; j++) {
        const y = yCoordinatesMm[j];
        viewFactors[j] = Math.pow(H2 / (H2 + y * y), 1.5);
    }
    return viewFactors;
}

function smoothStepCosine(value, start, end) {
    if (value <= start) return 1;
    if (value >= end) return 0;
    const s = (value - start) / (end - start);
    return 0.5 * (1 + Math.cos(Math.PI * s));
}

function getLocalConvection(yMm, heaterTemperatureK, ambientTemperatureK, hSlot, slotHalfWidthMm, convectionTransitionEndMm, hAmbientSide) {
    const weight = smoothStepCosine(yMm, slotHalfWidthMm, convectionTransitionEndMm);
    const airTemperatureK = weight * heaterTemperatureK + (1 - weight) * ambientTemperatureK;
    const h = weight * hSlot + (1 - weight) * hAmbientSide;
    return { weight, airTemperatureK, h };
}

function solveBandMatrixOptimized(A, N, bandWidth, r, x, precalc) {
    const abRowStride = bandWidth * 2 + 1;
    const lead = bandWidth;
    const strideU = abRowStride - 1;

    const iMinArr = precalc.iMin;
    const iMaxArr = precalc.iMax;
    const kMinIArr = precalc.kMinI;
    const kMinJArr = precalc.kMinJ;
    const jMinArr = precalc.jMin;
    const jMaxArr = precalc.jMax;

    // LU factorization
    for (let j = 0; j < N; j++) {
        const iMin = iMinArr[j];
        const iMax = iMaxArr[j];
        const kMinJ = kMinJArr[j];
        const diagIdx = j * abRowStride + lead;

        // Upper triangular matrix
        for (let i = iMin; i <= j; i++) {
            const iStride = i * abRowStride;
            const targetIdx = iStride + lead + j - i;
            let sum = A[targetIdx];

            const kMinI = kMinIArr[i];
            let k = kMinI > kMinJ ? kMinI : kMinJ;

            for (; k < i - 3; k += 4) {
                const aIdx = iStride + lead - i + k;
                const bIdx = k * abRowStride + lead + j - k;

                sum -= A[aIdx] * A[bIdx];
                sum -= A[aIdx + 1] * A[bIdx + strideU];
                sum -= A[aIdx + 2] * A[bIdx + strideU * 2];
                sum -= A[aIdx + 3] * A[bIdx + strideU * 3];
            }

            for (; k < i; k++) {
                sum -= A[iStride + lead + k - i] *
                    A[k * abRowStride + lead + j - k];
            }

            A[targetIdx] = sum;
        }

        const diagVal = A[diagIdx];
        if (!Number.isFinite(diagVal) || diagVal === 0) return false;

        // Lower triangular matrix
        for (let i = j + 1; i <= iMax; i++) {
            const iStride = i * abRowStride;
            const targetIdx = iStride + lead + j - i;
            let sum = A[targetIdx];

            const kMinI = kMinIArr[i];
            let k = kMinI > kMinJ ? kMinI : kMinJ;

            for (; k < j - 3; k += 4) {
                const aIdx = iStride + lead - i + k;
                const bIdx = k * abRowStride + lead + j - k;

                sum -= A[aIdx] * A[bIdx];
                sum -= A[aIdx + 1] * A[bIdx + strideU];
                sum -= A[aIdx + 2] * A[bIdx + strideU * 2];
                sum -= A[aIdx + 3] * A[bIdx + strideU * 3];
            }

            for (; k < j; k++) {
                sum -= A[iStride + lead + k - i] *
                    A[k * abRowStride + lead + j - k];
            }

            A[targetIdx] = sum / diagVal;
        }
    }

    // Forward substitution
    for (let i = 0; i < N; i++) {
        let sum = r[i];
        const iStride = i * abRowStride;
        const baseIdx = iStride + lead - i;
        let j = jMinArr[i];

        for (; j < i - 3; j += 4) {
            sum -= A[baseIdx + j] * x[j];
            sum -= A[baseIdx + j + 1] * x[j + 1];
            sum -= A[baseIdx + j + 2] * x[j + 2];
            sum -= A[baseIdx + j + 3] * x[j + 3];
        }

        for (; j < i; j++) {
            sum -= A[baseIdx + j] * x[j];
        }

        x[i] = sum;
    }

    // Backward substitution
    for (let i = N - 1; i >= 0; i--) {
        let sum = x[i];
        const iStride = i * abRowStride;
        const baseIdx = iStride + lead - i;
        let j = i + 1;
        const jMax = jMaxArr[i];

        for (; j <= jMax - 3; j += 4) {
            sum -= A[baseIdx + j] * x[j];
            sum -= A[baseIdx + j + 1] * x[j + 1];
            sum -= A[baseIdx + j + 2] * x[j + 2];
            sum -= A[baseIdx + j + 3] * x[j + 3];
        }

        for (; j <= jMax; j++) {
            sum -= A[baseIdx + j] * x[j];
        }

        const diagVal = A[iStride + lead];
        if (!Number.isFinite(diagVal) || diagVal === 0) return false;

        x[i] = sum / diagVal;
    }

    return true;
}

function isTargetReached2D(T, Nx, Ny, target, targetK, outCurrentValue) {
    if (!target) return false;
    if (target.type === "time") return false;
    if (target.type === "minTemperature") {
        let minValK = Infinity;
        for (let i = 0; i < Nx; i++) {
            const nodeTempK = T[i * Ny];
            if (nodeTempK < minValK) minValK = nodeTempK;
        }
        if (outCurrentValue) outCurrentValue.v = minValK;
        return minValK >= targetK;
    }
    if (target.type === "surfaceTemperature") {
        const topK = T[0];
        const botK = T[(Nx - 1) * Ny];
        const maxSurfaceK = topK > botK ? topK : botK;
        if (outCurrentValue) outCurrentValue.v = maxSurfaceK;
        return maxSurfaceK >= targetK;
    }
    return false;
}

export function simulate2DHeating({ thicknessMm, material, machine, simulation, storeHistory = false, onProgress }) {

    const calculationStart = performance.now();
    const mach = normalizeMachine(machine);
    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({ thicknessMm, material, machine: mach, simulation});
    if (!validation.isValid) return makeError(validation.errors);

    const rawMode = simulation?.accuracyMode;
    const isStringMode = typeof rawMode === "string";
    let mode = isStringMode ? rawMode : (rawMode ? "custom" : "optimal");
    if (isStringMode && !ACCURACY_MODES.includes(mode)) mode = "optimal";

    const isCustom = mode === "custom";

    // Поиск индекса конфигурации. Если режим кастомный, берем значения по умолчанию из "optimal" (индекс 1)
    const modeIdx = !isCustom ? ACCURACY_MODES.indexOf(mode) : 1;
    const am = isStringMode ? null : rawMode;

    const GRID_X_STEP_MM        = isCustom ? (am?.gridX    ?? LIMITS.gridX[modeIdx])    : LIMITS.gridX[modeIdx];
    const GRID_Y_STEP_MM        = isCustom ? (am?.gridY    ?? LIMITS.gridY[modeIdx])    : LIMITS.gridY[modeIdx];
    const TARGET_DELTA_T        = isCustom
        ? (am?.tempStepK ?? am?.targetDt ?? LIMITS.tempStepK[modeIdx])
        : LIMITS.tempStepK[modeIdx];
    const NONLINEAR_TOLERANCE_K = clamp(0.02 * TARGET_DELTA_T * TARGET_DELTA_T, 0.001, 0.25);

    const shouldCalculateAccuracyError = simulation?.calculateAccuracyError !== false;
    const is1D = simulation.widthHalfMm === 0;

    const Nx = Math.max(5, Math.round(thicknessMm / GRID_X_STEP_MM)) + 1;
    const Ny = is1D ? 1 : (Math.max(12, Math.round(simulation.widthHalfMm / GRID_Y_STEP_MM)) + 1);

    if (Nx > MAX_NODES_X || Ny > MAX_NODES_Y) {
        return makeError(`Grid dimensions (${Nx}x${Ny}) exceed technical limits.`);
    }
    const size2D = Nx * Ny;
    const bandWidth = Ny;
    const abRowStride = bandWidth + bandWidth + 1;
    if (size2D * abRowStride > MAX_BAND_MATRIX_ELEMENTS) {
        return makeError(`Band matrix size (${size2D * abRowStride}) exceeds memory safety limit.`);
    }

    const lastX = Nx - 1;
    const lastY = Ny - 1;

    const gridX = createNonlinearGridX(thicknessMm, Nx);
    const gridY = is1D
        ? { y: new Float64Array([0.0]), dy: new Float64Array([0.0]), dyHat: new Float64Array([0.0]), invDyH: new Float64Array([1000.0/0.001]), invDyL: new Float64Array([0.0]), invDyR: new Float64Array([0.0]), nodeCount: 1 }
        : createParametricGridY(simulation.widthHalfMm, Ny, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM);

    const target = simulation.target;
    const targetType = target.type;
    const targetValue = target.value;
    const targetK = (targetType === "minTemperature" || targetType === "surfaceTemperature") ? toKelvin(targetValue) : null;

    const temperatures = simulation.temperatures;
    const initT = temperatures.initialC;
    const ambT = temperatures.ambientC;
    const maxTimeSeconds = simulation.maxTimeSeconds;
    const decompTempK = toKelvin(material.decompositionTemp);
    const stopAtMaxTemperature = simulation.stopAtMaxTemperature === true;

    const matModel = createMaterialModel(material);
    if (!matModel) return makeError("Invalid material model.");

    // =====================================================================
    // 🌟 Автоматический расчет начального dt по критерию CFL
    // =====================================================================
    let dt = simulation.dtSeconds !== undefined
        ? simulation.dtSeconds
        : Math.min(0.5, TARGET_DELTA_T * 0.15);
    const PICARD_PASS_CPU_COST = size2D * (Ny + 2) + (size2D * 150);

//  Вставьте перенесенные лимиты сюда (теперь они видят PICARD_PASS_CPU_COST):
    const MAX_ALLOWED_STEP_CPU_UNITS = PICARD_PASS_CPU_COST * 40;
    const MAX_TOTAL_CPU_UNITS = 3000000000;

    const buffers = [
        new Float64Array(size2D).fill(initT + 273.15),
        new Float64Array(size2D).fill(initT + 273.15),
        new Float64Array(size2D).fill(initT + 273.15)
    ];

    let step = 1;
    let t_nm1 = 0;
    let t_n   = 0;

    let T_nm1_top = initT + 273.15;
    let T_nm1_mid = initT + 273.15;
    let T_nm1_bot = initT + 273.15;

    let T_n_top = initT + 273.15;
    let T_n_mid = initT + 273.15;
    let T_n_bot = initT + 273.15;

    let stepCountInPhase = 0;
    let maxGridErrorC = 0.0;

    const lead = bandWidth;

    const matrixA = new Float64Array(size2D * abRowStride);
    const rhsVec = new Float64Array(size2D);
    const solverX = new Float64Array(size2D);

    const ku = bandWidth;
    const kl = bandWidth;
    const precalc = {
        iMin: new Int32Array(size2D), iMax: new Int32Array(size2D),
        kMinJ: new Int32Array(size2D), kMinI: new Int32Array(size2D),
        jMin: new Int32Array(size2D), jMax: new Int32Array(size2D)
    };
    for (let idx = 0; idx < size2D; idx++) {
        precalc.iMin[idx] = idx - ku < 0 ? 0 : idx - ku;
        precalc.iMax[idx] = idx + kl > size2D - 1 ? size2D - 1 : idx + kl;
        precalc.kMinJ[idx] = idx - kl < 0 ? 0 : idx - kl;
        precalc.kMinI[idx] = idx - ku < 0 ? 0 : idx - ku;
        precalc.jMin[idx] = idx - kl < 0 ? 0 : idx - kl;
        precalc.jMax[idx] = idx + ku > size2D - 1 ? size2D - 1 : idx + ku;
    }

    const viewFactorsY = getNonlinearViewFactors(gridY.y);
    const T_top_K = (ambT + mach.heaters[0].heaterTemperatureFactor * (mach.heaters[0].regulatorTemperatureC - ambT)) + 273.15;
    const T_bot_K = (ambT + mach.heaters[1].heaterTemperatureFactor * (mach.heaters[1].regulatorTemperatureC - ambT)) + 273.15;
    const T_top_K_4 = T_top_K * T_top_K * T_top_K * T_top_K;
    const T_bot_K_4 = T_bot_K * T_bot_K * T_bot_K * T_bot_K;

    const hTop = mach.heaters[0].convectiveHeatTransferCoefficient;
    const hBot = mach.heaters[1].convectiveHeatTransferCoefficient;
    const ambientTemperatureK = ambT + 273.15;
    const ambientTemperatureK_4 = ambientTemperatureK * ambientTemperatureK * ambientTemperatureK * ambientTemperatureK;

    const epsS = material.emissivity;
    const epsH_top = mach.heaters[0].heaterEmissivity;
    const epsEffH_top = (epsH_top * epsS) / (epsH_top + epsS - epsH_top * epsS);
    const radFactorTopBase = mach.heaters[0].radiationGain * epsEffH_top * SIGMA;

    const epsH_bot = mach.heaters[1].heaterEmissivity;
    const epsEffH_bot = (epsH_bot * epsS) / (epsH_bot + epsS - epsH_bot * epsS);
    const radFactorBotBase = mach.heaters[1].radiationGain * epsEffH_bot * SIGMA;

    const precalcConvTopH = new Float64Array(Ny);
    const precalcConvTopAir = new Float64Array(Ny);
    const precalcConvBotH = new Float64Array(Ny);
    const precalcConvBotAir = new Float64Array(Ny);

    for (let j = 0; j <= lastY; j++) {
        const yMm = gridY.y[j];
        const cTop = getLocalConvection(yMm, T_top_K, ambientTemperatureK, hTop, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM, AMBIENT_CONVECTION_H_TOP);
        precalcConvTopH[j] = cTop.h;
        precalcConvTopAir[j] = cTop.airTemperatureK;
        const cBot = getLocalConvection(yMm, T_bot_K, ambientTemperatureK, hBot, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM, AMBIENT_CONVECTION_H_BOT);
        precalcConvBotH[j] = cBot.h;
        precalcConvBotAir[j] = cBot.airTemperatureK;
    }

    let time = 0;
    const simulationMaxTime = targetType === "time" ? (maxTimeSeconds < targetValue ? maxTimeSeconds : targetValue) : maxTimeSeconds;
    let history = storeHistory ? { time: [], frontSurfaceC: [], centerC: [], backSurfaceC: [] } : undefined;

    let lastLoggedTime = -1;
    const logHistoryGlobal = (currentAbsoluteTime, force = false) => {
        if (!storeHistory || !history) return;
        if (history.time.length > 0 && history.time[history.time.length - 1] === currentAbsoluteTime) return;
        if (!force && (currentAbsoluteTime - lastLoggedTime < 1.0)) return;

        const curIdx = step % 3;
        const currentBuffer = buffers[curIdx];

        history.time.push(currentAbsoluteTime);
        history.frontSurfaceC.push(currentBuffer[0] - 273.15);
        history.centerC.push(currentBuffer[((Nx - 1) >> 1) * Ny] - 273.15);
        history.backSurfaceC.push(currentBuffer[lastX * Ny] - 273.15);

        lastLoggedTime = currentAbsoluteTime;
    };

    logHistoryGlobal(0, true);

    const invDxH = gridX.invDxH;
    const invDxL = gridX.invDxL;
    const invDxR = gridX.invDxR;
    const invDyH = gridY.invDyH;
    const invDyL = gridY.invDyL;
    const invDyR = gridY.invDyR;

    let lastReportedPercent = -1;
    const totalCoolingTime = simulation.cooling?.timeSeconds || 0;
    const hCooling = simulation.cooling?.convectiveHeatTransferCoefficient || 8.0;
    const radFactorAmbient = epsS * SIGMA;

    const maxHeatingPercent = simulation.maxHeatingPercent ?? (totalCoolingTime > 0 ? 95 : 99);
    const coolingWeightRange = 100 - maxHeatingPercent;

    let maxSolverErrorC = 0.0;
    let maxTimeErrorC = 0.0;

    let countTimeSteps = 0;
    let countRejectedSteps = 0
    let totalPicardIterations = 0;

    let totalCpuUnits = 0;         // Накопленная сложность за всю симуляцию
    let currentStepCpuUnits = 0;   // Накопленная сложность в рамках текущей временной отметки dt


    let heatingProfileC = null;
    let pauseProfileC;
    let reachedTarget = false;
    let status = null;

    const totalRangeHeating = targetValue - initT;
    const invTargetValueTime = targetValue > 0 ? (1.0 / targetValue) : 0.0;
    const invMaxTimeSeconds = maxTimeSeconds > 0 ? (1.0 / maxTimeSeconds) : 0.0;
    const invTotalCoolingTime = totalCoolingTime > 0 ? (1.0 / totalCoolingTime) : 0.0;

    let lastReportTimeMs = performance.now(); // Фиксируем реальное время старта
    let currentPhase = "heating";
    let coolingTimeElapsed = 0;

    const idxTop = 0;
    const idxMid = ((Nx - 1) >> 1) * Ny;
    const idxBot = lastX * Ny;


    let countConsecutiveRejectedSteps = 0; // Счетчик ошибок сходимости подряд

    const switchToCoolingPhase = () => {
        currentPhase = "cooling";
        const curIdx = step % 3;
        const currentBuffer = buffers[curIdx];

        heatingProfileC = new Float64Array(size2D);
        for (let i = 0; i < size2D; i++) heatingProfileC[i] = currentBuffer[i] - 273.15;

        stepCountInPhase = 0;
        t_nm1 = 0;
        t_n = 0;

        // Прямое присвоение в регистровые переменные вместо объектов
        T_n_top = currentBuffer[idxTop];
        T_n_mid = currentBuffer[idxMid];
        T_n_bot = currentBuffer[idxBot];

        T_nm1_top = currentBuffer[idxTop];
        T_nm1_mid = currentBuffer[idxMid];
        T_nm1_bot = currentBuffer[idxBot];

        dt = TARGET_DELTA_T * 0.2;

        countConsecutiveRejectedSteps = 0;

        logHistoryGlobal(time + coolingTimeElapsed, true);
    };


    mainSimulationLoop: while (true) {

        if (totalCpuUnits > MAX_TOTAL_CPU_UNITS) {
            status = { type: "abort", message: "Simulation terminated: Total CPU complexity exceeded safety limit." };
            break;
        }

        if (countTimeSteps > MAX_TOTAL_TIME_STEPS) {
            status = { type: "abort", message: "Simulation terminated: Exceeded maximum time steps limit." };
            break;
        }

        let currentStepTimeErr = 0.0;

        if (currentPhase === "heating") {
            if (targetType === "time" && time + dt > targetValue) {
                dt = targetValue - time;
            } else if (time + dt > simulationMaxTime) {
                dt = simulationMaxTime - time;
            }
        } else {
            if (coolingTimeElapsed + dt > totalCoolingTime) {
                dt = totalCoolingTime - coolingTimeElapsed;
            }
        }

        if (dt < 1e-5) {
            if (currentPhase === "heating" && totalCoolingTime > 0 && reachedTarget && step > 1) {
                switchToCoolingPhase();
                continue;
            } else {
                // 🎯 ИСПРАВЛЕНИЕ: Если симулятор упал по dt на первом же шаге (step === 1),
                // это ВСЕГДА жесткая ошибка, независимо от ложных показаний reachedTarget
                if (step <= 1 || (!reachedTarget && targetType !== "time")) {
                    status = {
                        type: "error",
                        message: `Simulation stalled completely: Time step fell below critical limit (1e-5) on step #${step} (${currentPhase}).`
                    };
                }
                break;
            }
        }


        const curIdx = step % 3;
        const newIdx = (step + 1) % 3;

        buffers[newIdx].set(buffers[curIdx]);

        let nonlinearConverged = false;
        let lastIterMaxSignedDiff = 0.0;
        let stepMaxGridError = 0.0;

        let prevDeltaK = Infinity;
        let consecutiveBadSteps = 0;

        for (let iter = 0; iter < MAX_PICARD_ITERATIONS; iter++) {
            totalPicardIterations++;

            matrixA.fill(0);

            let iterMaxGridError = 0.0;

            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const idxInvDxH = invDxH[i];
                const dxL = (i > 0) ? (gridX.x[i] - gridX.x[i - 1]) : 0;
                const dxR = (i < lastX) ? (gridX.x[i + 1] - gridX.x[i]) : 0;

                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = buffers[newIdx][idxRow];
                    const oldTempC = buffers[curIdx][idxRow] - 273.15;

                    if (shouldCalculateAccuracyError && i > 0 && i < lastX) {
                        const d2Tdx2 = (2.0 / (dxL + dxR)) * (
                            (buffers[newIdx][idxRow + Ny] - currentTempK) / dxR -
                            (currentTempK - buffers[newIdx][idxRow - Ny]) / dxL
                        );
                        const errX = (dxL * dxR / 8.0) * Math.abs(d2Tdx2);
                        let errY = 0.0;

                        if (!is1D && Ny >= 3 && j > 0 && j < lastY) {
                            const j1 = j - 1;
                            const j2 = j;
                            const dy1 = gridY.y[j1 + 1] - gridY.y[j1];
                            const dy2 = gridY.y[j2 + 1] - gridY.y[j2];

                            if (dy1 > 0 && dy2 > 0) {
                                const idx1 = i * Ny + j1;
                                const idx2 = i * Ny + j2;
                                const slope1 = (buffers[newIdx][idx1 + 1] - buffers[newIdx][idx1]) / dy1;
                                const slope2 = (buffers[newIdx][idx2 + 1] - buffers[newIdx][idx2]) / dy2;
                                const d2Tdy2 = 2.0 * (slope2 - slope1) / (dy1 + dy2);
                                const localDy = Math.min(dy1, dy2);
                                errY = (localDy * localDy / 8.0) * Math.abs(d2Tdy2);
                            }
                        }

                        const nodeGridError = Math.hypot(errX, errY);
                        if (nodeGridError > iterMaxGridError) {
                            iterMaxGridError = nodeGridError;
                        }
                    }

                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const kEff = props.k;

                    rhsVec[idxRow] = buffers[curIdx][idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;
                    const matRowOffset = idxRow * abRowStride + lead;
                    const dtkEff = dt * kEff;

                    if (i > 0 && i < lastX) {
                        const coeffLeft = dtkEff * idxInvDxH * invDxL[i];
                        const coeffRight = dtkEff * idxInvDxH * invDxR[i];
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else if (i === 0 || i === lastX) {
                        const isTopBound = (i === 0);
                        const coeffNext = isTopBound ? (dtkEff * idxInvDxH * invDxR[i]) : (dtkEff * idxInvDxH * invDxL[i]);
                        matrixA[matRowOffset + (isTopBound ? Ny : -Ny)] = -coeffNext;
                        centerCoeff += coeffNext;

                        const currentTempK_2 = currentTempK * currentTempK;
                        const currentTempK_3 = currentTempK_2 * currentTempK;
                        const currentTempK_4 = currentTempK_2 * currentTempK_2;

                        let q_conv = 0, dq_conv = 0, q_rad = 0, dq_rad = 0;

                        if (currentPhase === "heating") {
                            const fH = viewFactorsY[j];
                            if (isTopBound) {
                                q_conv = precalcConvTopH[j] * (precalcConvTopAir[j] - currentTempK);
                                dq_conv = -precalcConvTopH[j];
                                q_rad = radFactorTopBase * fH * (T_top_K_4 - currentTempK_4);
                                dq_rad = -4 * radFactorTopBase * fH * currentTempK_3;
                            } else {
                                q_conv = precalcConvBotH[j] * (precalcConvBotAir[j] - currentTempK);
                                dq_conv = -precalcConvBotH[j];
                                q_rad = radFactorBotBase * fH * (T_bot_K_4 - currentTempK_4);
                                dq_rad = -4 * radFactorBotBase * fH * currentTempK_3;
                            }
                        } else {
                            q_conv = hCooling * (ambientTemperatureK - currentTempK);
                            dq_conv = -hCooling;
                            q_rad = radFactorAmbient * (ambientTemperatureK_4 - currentTempK_4);
                            dq_rad = -4 * radFactorAmbient * currentTempK_3;
                        }

                        centerCoeff -= (dt * idxInvDxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (dt * idxInvDxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    }

                    if (!is1D) {
                        const idxInvDyH = invDyH[j];
                        if (j > 0 && j < lastY) {
                            const coeffLeftY = dtkEff * idxInvDyH * invDyL[j];
                            const coeffRightY = dtkEff * idxInvDyH * invDyR[j];
                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            matrixA[matRowOffset + 1] = -coeffRightY;
                            centerCoeff += (coeffLeftY + coeffRightY);
                        } else if (j === 0) {
                            const coeffRightY = dtkEff * idxInvDyH * invDyR[j];
                            matrixA[matRowOffset + 1] = -2 * coeffRightY;
                            centerCoeff += 2 * coeffRightY;
                        } else if (j === lastY) {
                            const coeffLeftY = dtkEff * idxInvDyH * invDyL[j];
                            const coeffRightY = dtkEff * idxInvDyH * invDyL[j];
                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            centerCoeff += coeffLeftY;
                            matrixA[matRowOffset] = centerCoeff;
                            const T_edge_old = buffers[curIdx][idxRow];
                            const T_virtual_extrapolated = T_edge_old - (buffers[curIdx][idxRow - 1] - T_edge_old);
                            const T_target = T_virtual_extrapolated < ambientTemperatureK ? ambientTemperatureK : T_virtual_extrapolated;
                            rhsVec[idxRow] += coeffRightY * (T_target - T_edge_old);
                        }
                    }
                    matrixA[matRowOffset] = centerCoeff;
                }
            }

            const solverSuccess = solveBandMatrixOptimized(matrixA, size2D, bandWidth, rhsVec, solverX, precalc);

            // Инкремент сложности за выполненный проход:
            totalCpuUnits += PICARD_PASS_CPU_COST;
            currentStepCpuUnits += PICARD_PASS_CPU_COST;

            if (currentStepCpuUnits > MAX_ALLOWED_STEP_CPU_UNITS) {
                status = {
                    type: "abort",
                    message: `Simulation killed on the fly: Matrix loop lockdown. CPU workload limit exceeded (${currentStepCpuUnits} units) on a single time coordinate.`
                };
                break mainSimulationLoop;
            }

            // 🎯 МГНОВЕННЫЙ ПЕРЕХВАТ: Если солвер споткнулся о нулевую диагональ
            if (!solverSuccess) {
                countRejectedSteps++;
                countConsecutiveRejectedSteps++;

                if (countConsecutiveRejectedSteps > MAX_CONSECUTIVE_REJECTIONS) {
                    status = {
                        type: "error",
                        message: `Simulation aborted on the fly: Matrix singularity and consecutive step rejections (${countConsecutiveRejectedSteps} times).`
                    };
                    break mainSimulationLoop;
                }

                dt *= DT_SINGULARITY_SHRINK;
                if (dt < 1e-6) {
                    status = { type: "error", message: `Time step reached critical minimum limit due to matrix singularity (${currentPhase}).` };
                    break mainSimulationLoop;
                }
                continue mainSimulationLoop; // Уходим на повторный расчет этой же временной отметки с меньшим dt
            }

            let maxDeltaK = 0;
            let localMaxSignedDiff = 0;

            for (let k = 0; k < size2D; k++) {
                const newTemp = solverX[k];

                if (!Number.isFinite(newTemp)) {
                    status = {
                        type: "error",
                        message: `Numerical instability: Non-finite temperature detected at node ${k}, step ${step}, iteration ${iter}.`
                    };
                    break mainSimulationLoop;
                }

                const diffSigned = newTemp - buffers[newIdx][k];
                const diffAbs = Math.abs(diffSigned);

                if (!Number.isFinite(diffAbs)) {
                    status = {
                        type: "error",
                        message: `Numerical instability: Invalid temperature difference at node ${k}, step ${step}, iteration ${iter}.`
                    };
                    break mainSimulationLoop;
                }

                if (diffAbs > maxDeltaK) {
                    maxDeltaK = diffAbs;
                    localMaxSignedDiff = diffSigned;
                }
            }

            buffers[newIdx].set(solverX);
            lastIterMaxSignedDiff = localMaxSignedDiff;

            // 1. Сначала проверяем фактическую сходимость (У вас сделано верно)
            if (maxDeltaK < NONLINEAR_TOLERANCE_K) {
                nonlinearConverged = true;
                stepMaxGridError = iterMaxGridError;
                break;
            }

            // 2. Адаптивный Пикар: контроль расходимости и стагнации O(1)
            if (iter >= 4) {
                // Фиксация устойчивого взрывного роста ошибки (более чем на 20%)
                if (maxDeltaK > prevDeltaK * 1.20) {
                    consecutiveBadSteps++;
                    if (consecutiveBadSteps >= 2) {
                        break; // Выходим из Пикара. Шаг гарантированно уйдет в реджект и dt уменьшится.
                    }
                } else {
                    consecutiveBadSteps = 0; // Сброс счетчика, если ошибка пошла вниз
                }

                // Мягкая защита от бесконечной "черепашьей" стагнации (Экономия CPU)
                // Если мы на 6+ итерации, а ошибка падает слишком вяло (менее чем на 5% за проход),
                // прерываем шаг досрочно ради пересчета на меньшем, быстром dt.
                if (iter >= 6 && maxDeltaK >= prevDeltaK * 0.95) {
                    break;
                }
            }

            prevDeltaK = maxDeltaK;
        }

        if (!nonlinearConverged) {
            countRejectedSteps++;
            countConsecutiveRejectedSteps++;

//  Вставьте проверку по удельной сложности шага:
            if (currentStepCpuUnits > MAX_ALLOWED_STEP_CPU_UNITS) {
                status = {
                    type: "abort",
                    message: `Simulation killed: Matrix loop lockdown. Step CPU complexity (${currentStepCpuUnits}) exceeded limit on step #${step}.`
                };
                break;
            }

            // ФИЛЬТР 1: Если солвер много раз подряд сжал dt на одном месте
            if (countConsecutiveRejectedSteps > MAX_CONSECUTIVE_REJECTIONS) {
                status = {
                    type: "abort",
                    message: `Simulation aborted on the fly: High numerical friction and consecutive step rejections (${countConsecutiveRejectedSteps} times).`
                };
                break;
            }

            const residualRatio = Number.isFinite(lastIterMaxSignedDiff) && Math.abs(lastIterMaxSignedDiff) > 0
                ? Math.abs(lastIterMaxSignedDiff) / NONLINEAR_TOLERANCE_K
                : DT_FALLBACK_RESIDUAL_RATIO;

            const autoShrink = clamp(
                DT_SAFETY_FACTOR / Math.sqrt(residualRatio),
                DT_REJECT_MIN_SHRINK,
                DT_REJECT_MAX_SHRINK
            );

            dt *= autoShrink;

            if (dt < 1e-6) {
                status = { type: "error", message: `Time step reached critical minimum limit (${currentPhase}).` };
                break;
            }
            continue;
        }


// Если шаг успешно принят солвером, сбрасываем счетчик ошибок сходимости
        countConsecutiveRejectedSteps = 0;



        let overHeated = false;
        let maxObservedT = 0; // Теперь переменная доступна всему оставшемуся телу цикла while
        for (let i = 0; i < size2D; i++) {
            if (buffers[newIdx][i] > maxObservedT) maxObservedT = buffers[newIdx][i];
            if (buffers[newIdx][i] >= decompTempK) overHeated = true;
        }


        if (overHeated && currentPhase === "heating") {
            let maxOldT = 0;
            for (let i = 0; i < size2D; i++) {
                if (buffers[curIdx][i] > maxOldT) maxOldT = buffers[curIdx][i];
            }
            const deltaTOverheat = maxObservedT - maxOldT;
            if (deltaTOverheat > 0.02 && maxOldT < decompTempK) {
                const fraction = (decompTempK - maxOldT) * (1.0 / deltaTOverheat);
                const nextDt = dt * clamp(fraction, 0.05, 0.95);

                if (nextDt >= 1e-5) {
                    countRejectedSteps++;
                    dt = nextDt;
                    continue;
                }
            }
            status = { type: "warn", message: `Degradation! Temperature > ${material.decompositionTemp}°C.` };
            if (stopAtMaxTemperature) {
                time += dt;
                countTimeSteps++;
                logHistoryGlobal(time + coolingTimeElapsed, true);
                break;
            }
        }

        let forceStop = false;
        // Создаем объект-контейнер для хранения критического значения (для onProgress)
        // Изначально выставляем базовое значение на случай, если фаза не heating или тип "time"
        let currentStepCriticalValue = buffers[newIdx][0];

        if (currentPhase === "heating" && targetK != null && targetType !== "time") {
            let criticalNodeIdx = 0;
            let isReached = false;

            if (targetType === "minTemperature") {
                let minValK = Infinity;
                // Ищем минимальную температуру по X за О(Nx)
                for (let i = 0; i < Nx; i++) {
                    const nodeTempK = buffers[newIdx][i * Ny];
                    if (nodeTempK < minValK) {
                        minValK = nodeTempK;
                        criticalNodeIdx = i * Ny;
                    }
                }
                currentStepCriticalValue = minValK; // Кэшируем для onProgress
                isReached = minValK >= targetK;
            } else if (targetType === "surfaceTemperature") {
                const topK = buffers[newIdx][0];
                const botK = buffers[newIdx][lastX * Ny];
                const maxSurfaceK = topK > botK ? topK : botK;

                criticalNodeIdx = topK >= botK ? 0 : (lastX * Ny);
                currentStepCriticalValue = maxSurfaceK; // Кэшируем для onProgress
                isReached = maxSurfaceK >= targetK;
            }

            // Если цель достигнута, проверяем необходимость точной подгонки dt
            if (isReached) {
                const oldNodeT = buffers[curIdx][criticalNodeIdx];
                const newNodeT = buffers[newIdx][criticalNodeIdx];
                const deltaTTarget = newNodeT - oldNodeT;

                if (deltaTTarget > 0.02 && oldNodeT < targetK) {
                    const fraction = (targetK - oldNodeT) * (1.0 / deltaTTarget);
                    const nextDt = dt * clamp(fraction, 0.05, 0.95);

                    if (nextDt >= 1e-5) {
                        countRejectedSteps++;
                        dt = nextDt;
                        continue;
                    }
                }
                forceStop = true;
            }
        }


        if (shouldCalculateAccuracyError && nonlinearConverged) {
            const lastPicardDeltaK = Math.abs(lastIterMaxSignedDiff);
            if (lastPicardDeltaK > maxSolverErrorC) maxSolverErrorC = lastPicardDeltaK;
            if (stepMaxGridError > maxGridErrorC) maxGridErrorC = stepMaxGridError;

            const h2 = dt;
            const h1 = t_n - t_nm1;

            if (stepCountInPhase >= 2 && h1 > 1e-5 && h2 > 1e-5) {
                // 🌟 МАТЕМАТИЧЕСКИ ИДЕАЛЬНО: Сокращенная формула локальной ошибки усечения метода Эйлера
                // Полностью исключает вычислительную нестабильность при h1 != h2
                const timeRatio = h2 / h1;
                const currentBuffer = buffers[newIdx];

                // Точка Top
                const errTimeTop = Math.abs((currentBuffer[idxTop] - T_n_top) - timeRatio * (T_n_top - T_nm1_top));

                // Точка Mid
                const errTimeMid = Math.abs((currentBuffer[idxMid] - T_n_mid) - timeRatio * (T_n_mid - T_nm1_mid));

                // Точка Bot
                const errTimeBot = Math.abs((currentBuffer[idxBot] - T_n_bot) - timeRatio * (T_n_bot - T_nm1_bot));

                // Поиск локального максимума ошибки времени на текущем шаге
                let localMaxTimeErr = errTimeTop > errTimeMid ? errTimeTop : errTimeMid;
                if (errTimeBot > localMaxTimeErr) localMaxTimeErr = errTimeBot;

                currentStepTimeErr = localMaxTimeErr;
                if (localMaxTimeErr > maxTimeErrorC) maxTimeErrorC = localMaxTimeErr;
            }
        }


        t_nm1 = currentPhase === "heating" ? time : coolingTimeElapsed;
        t_n = t_nm1 + dt;

        // Быстрая перекладка из регистра в регистр
        T_nm1_top = T_n_top;
        T_nm1_mid = T_n_mid;
        T_nm1_bot = T_n_bot;

        const nextBuffer = buffers[newIdx];
        T_n_top = nextBuffer[idxTop];
        T_n_mid = nextBuffer[idxMid];
        T_n_bot = nextBuffer[idxBot];

        stepCountInPhase++;
        countTimeSteps++;

        if (currentPhase === "heating") {
            time += dt;
        } else {
            coolingTimeElapsed += dt;
        }

        logHistoryGlobal(time + coolingTimeElapsed, forceStop);

        if (onProgress) {
            let currentPercent = 0;

            if (currentPhase === "heating") {
                let heatingProgressFraction = 0;

                if (targetType === "time" && targetValue > 0) {
                    heatingProgressFraction = time * invTargetValueTime;
                } else if ((targetType === "minTemperature" || targetType === "surfaceTemperature") && targetValue > initT) {
                    const maxCurrentC = maxObservedT - 273.15;
                    const minCurrentC = currentStepCriticalValue - 273.15;

                    const surfaceFraction = Math.max(0.0, Math.min(1.0, (maxCurrentC - initT) / (targetValue - initT)));
                    const coreFraction = Math.max(0.0, Math.min(1.0, (minCurrentC - initT) / totalRangeHeating));

                    if (targetType === "minTemperature") {
                        const weightCore = coreFraction;
                        const weightSurface = 1.0 - weightCore;
                        heatingProgressFraction = (surfaceFraction * weightSurface) + (coreFraction * weightCore);
                    } else {
                        heatingProgressFraction = surfaceFraction;
                    }
                } else if (maxTimeSeconds > 0) {
                    heatingProgressFraction = time * invMaxTimeSeconds;
                }

                heatingProgressFraction = Math.max(0, Math.min(1.0, heatingProgressFraction));
                currentPercent = Math.floor(heatingProgressFraction * maxHeatingPercent);
            } else {
                let coolingProgressFraction = totalCoolingTime > 0 ? (coolingTimeElapsed * invTotalCoolingTime) : 1.0;
                coolingProgressFraction = Math.max(0, Math.min(1.0, coolingProgressFraction));
                currentPercent = Math.floor(maxHeatingPercent + (coolingProgressFraction * coolingWeightRange));
            }

            const nowMs = performance.now();

            // Комбинированная защита: прогресс вырос на 1% И прошло достаточно реального времени (100% пропускаем всегда)
            if ((currentPercent > lastReportedPercent && (nowMs - lastReportTimeMs >= UI_PROGRESS_THROTTLE_MS)) || currentPercent === 100) {

                const accuracyMetrics = {
                    accuracyMode: mode,
                    solverErrorC: maxSolverErrorC,
                    timeIntegrationErrorC: maxTimeErrorC,
                    spatialGridErrorC: maxGridErrorC,
                    totalErrorScore: Math.sqrt(maxSolverErrorC ** 2 + maxTimeErrorC ** 2 + maxGridErrorC ** 2),
                };

                // 🌟 Формируем полноценный technicalMetrics, идентичный финальному при завершении
                const currentTechnicalMetrics = {
                    calculationTimeMs: nowMs - calculationStart,
                    cpuWorkloadUnits: totalCpuUnits, // Честная нагрузка в реальном времени
                    accuracy: shouldCalculateAccuracyError ? accuracyMetrics : null,
                    iterations: {
                        totalTimeSteps: countTimeSteps,
                        rejectedTimeSteps: countRejectedSteps,
                        totalGridPointsProcessed: totalCpuUnits,
                        totalPicardIterations: totalPicardIterations
                    }
                };

                // Передаем в onProgress обновленный структурированный объект
                const shouldAbort = onProgress(
                    currentPercent,
                    currentTechnicalMetrics
                );

                if (shouldAbort === true) {
                    status = {
                        type: "abort",
                        message: `Abort: outer load limit at ${currentPercent}% (${currentPhase})`
                    };
                    if (shouldCalculateAccuracyError) {
                        const lastPicardDeltaK = Math.abs(lastIterMaxSignedDiff);
                        if (lastPicardDeltaK > maxSolverErrorC) maxSolverErrorC = lastPicardDeltaK;
                        if (stepMaxGridError > maxGridErrorC) maxGridErrorC = stepMaxGridError;
                    }
                    break;
                }

                lastReportedPercent = currentPercent; // Фиксируем процент
                lastReportTimeMs = nowMs;             // Сбрасываем таймер частоты отправки
            }
        }


        if (forceStop && currentPhase === "heating") {
            if (totalCoolingTime > 0) {
                reachedTarget = true;
                switchToCoolingPhase();
                continue;
            } else {
                break;
            }
        }

// Заменить весь блок расчета следующего dt в конце while на:
        let maxStepTempChange = Math.max(
            Math.abs(buffers[newIdx][idxTop] - buffers[curIdx][idxTop]),
            Math.abs(buffers[newIdx][idxMid] - buffers[curIdx][idxMid]),
            Math.abs(buffers[newIdx][idxBot] - buffers[curIdx][idxBot])
        );

        const dtTemperature = maxStepTempChange > 1e-6
            ? dt * DT_SAFETY_FACTOR * (TARGET_DELTA_T / maxStepTempChange)
            : dt * DT_MAX_GROWTH_FACTOR;

        const targetTimeTol = Math.max(NONLINEAR_TOLERANCE_K, TARGET_DELTA_T * 0.2);
        const dtAccuracy = (shouldCalculateAccuracyError && currentStepTimeErr > 1e-6)
            ? dt * DT_SAFETY_FACTOR * Math.sqrt(targetTimeTol / currentStepTimeErr)
            : dt * DT_MAX_GROWTH_FACTOR;

        let dtPhysical = Infinity;
        if (currentPhase === "heating" && maxStepTempChange > 1e-6) {
            const heatingRate = maxStepTempChange / dt;
            const distToDecomp = decompTempK - maxObservedT;
            if (distToDecomp > 0) {
                dtPhysical = Math.min(dtPhysical, Math.max(MIN_PHYSICAL_DT_SECONDS, (distToDecomp / heatingRate) * 0.85));
            }
            if (targetK != null && targetType !== "time") {
                const distToTarget = targetK - currentStepCriticalValue;
                if (distToTarget > 0) {
                    dtPhysical = Math.min(dtPhysical, Math.max(MIN_PHYSICAL_DT_SECONDS, (distToTarget / heatingRate) * 0.9));
                }
            }
        }

        const rawNextDt = Math.min(dtTemperature, dtAccuracy, dtPhysical);
        dt = clamp(rawNextDt, dt * DT_MIN_SUCCESS_SHRINK, dt * DT_MAX_GROWTH_FACTOR);

        step++;
        currentStepCpuUnits = 0; // Обнуляем сложность шага, так как он официально принят алгоритмом

    }

    const finalCurIdx = step % 3;

    if (!heatingProfileC) {
        heatingProfileC = new Float64Array(size2D);
        for (let i = 0; i < size2D; i++) {
            heatingProfileC[i] = buffers[finalCurIdx][i] - 273.15;
        }
    }

    pauseProfileC = new Float64Array(size2D);
    for (let i = 0; i < size2D; i++) {
        pauseProfileC[i] = buffers[finalCurIdx][i] - 273.15;
    }

    if (currentPhase === "heating") {
        reachedTarget = targetType === "time"
            ? time >= targetValue
            : (targetK == null ? false : isTargetReached2D(buffers[finalCurIdx], Nx, Ny, target, targetK));
    }

    if (status && status.type === "error") {
        return makeError(status.message || "Simulation broke prematurely.", {
            heatingTimeSeconds: time,
            coolingTimeSeconds: coolingTimeElapsed,
            status: status
        });
    }

    const totalErrorScore = Math.sqrt(maxSolverErrorC ** 2 + maxTimeErrorC ** 2 + maxGridErrorC ** 2);
    const accuracyMetrics = {
        accuracyMode: mode,
        solverErrorC: maxSolverErrorC,
        timeIntegrationErrorC: maxTimeErrorC,
        spatialGridErrorC: maxGridErrorC,
        totalErrorScore,
        formatted: `Score: ${totalErrorScore.toFixed(2)}`
    };

    return {
        heatingTimeSeconds: time,
        coolingTimeSeconds: coolingTimeElapsed,
        reachedTarget,
        status: status || { type: "ok" },
        ...(storeHistory && { history }),
        temperatureProfile: {
            xCoordinatesMm: Array.from(gridX.x),
            yCoordinatesMm: Array.from(gridY.y),
            Nx, Ny,
            heating: heatingProfileC,
            pause: pauseProfileC
        },
        technicalMetrics: {
            calculationTimeMs: performance.now() - calculationStart,
            cpuWorkloadUnits: totalCpuUnits, // Итоговый точный вес симуляции
            accuracy: shouldCalculateAccuracyError ? accuracyMetrics : null,
            iterations: {
                totalTimeSteps: countTimeSteps,
                rejectedTimeSteps: countRejectedSteps,
                totalPicardIterations: totalPicardIterations,
                totalGridPointsProcessed: totalCpuUnits
            }
        }
    };
}
