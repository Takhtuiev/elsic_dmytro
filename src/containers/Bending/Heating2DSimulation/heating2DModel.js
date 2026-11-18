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

// ============================================================================
// 1. КОНСТАНТЫ И ПАРАМЕТРЫ КОНФИГУРАЦИИ
// ============================================================================

export const ACCURACY_MODES = ["fast", "optimal", "accurate"];

export const LIMITS = {
    gridDensityX: [3.9586, 6.4778, 11.5161], // Плотность сетки по толщине X (узлов / мм^0.635)
    gridDensityY: [5.0405, 6.1207, 10.8012], // Плотность сетки по ширине Y (узлов / мм^0.300)
    tempStepK:    [2.400,  1.948,  1.083], // Целевой шаг изменения температуры за итерацию (К)
};

// Геометрия и физика процесса
export const SIGMA = 5.670374419e-8;
export const HEATER_RADIUS_MM = 3.0;
export const DISTANCE_TO_SHEET_MM = 8.0;
export const DEFAULT_SLOT_HALF_WIDTH_MM = 5.0;           // Половина ширины щели нагревателя (ТЭНа)
export const DEFAULT_CONVECTION_TRANSITION_END_MM = 8.0; // Граница рассеивания жара (начало холодной зоны)

const EFFECTIVE_H_MM = DISTANCE_TO_SHEET_MM + HEATER_RADIUS_MM;
const AMBIENT_CONVECTION_H_TOP = 8.0;
const AMBIENT_CONVECTION_H_BOT = 7.0;

// Ограничения сетки и памяти
export const GRID_DENSITY_EXP_X = 0.635; // Показатель масштабирования по толщине (калибровано по 4-8 мм)
export const GRID_DENSITY_EXP_Y = 0.341; // Показатель масштабирования по полуширине

const MAX_NODES_X = 300;
const MAX_NODES_Y = 500;
const MAX_BAND_MATRIX_ELEMENTS = 15000000;
const MIN_GEOMETRIC_STEP_MM = 0.000001;
const MIN_GRID_NODES_X = 5;
const MIN_GRID_NODES_Y = 12;

// Ограничения солвера и времени расчета
const UI_PROGRESS_THROTTLE_MS = 40;
const MAX_TOTAL_TIME_STEPS = 100000;
const MAX_CONSECUTIVE_REJECTIONS = 12;
const MAX_PICARD_ITERATIONS = 40;
const MAX_TOTAL_CPU_UNITS = 3000000000;

// Параметры автоматического регулятора шага времени (PI-контроллер)
const DT_SAFETY_FACTOR = 0.85;
const DT_MAX_GROWTH_FACTOR = 1.45;
const DT_MIN_SUCCESS_SHRINK = 0.50;
const DT_REJECT_MIN_SHRINK = 0.35;
const DT_REJECT_MAX_SHRINK = 0.75;
const DT_FALLBACK_RESIDUAL_RATIO = 4.0;
const DT_SINGULARITY_SHRINK = 0.50;
const MIN_PHYSICAL_DT_SECONDS = 0.005;

// Базовые математические утилиты
const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));
const toKelvin = c => c + 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;

// ============================================================================
// 2. ВАЛИДАЦИЯ И НАСТРОЙКИ СЕТКИ
// ============================================================================

export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object") return null;
    if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) return null;

    const top = machine.heaters[0];
    const bot = machine.heaters[1];
    const globalOffset = Number.isFinite(machine.pidPhaseOffsetSeconds) ? machine.pidPhaseOffsetSeconds : 0;

    const applyOffset = (pid) => {
        if (!pid) return null;
        return {
            ...pid,
            phaseSeconds: (pid.phaseSeconds || 0) + globalOffset
        };
    };

    const mergedBotPid = (top.pid || bot.pid)
        ? { ...(top.pid || {}), ...(bot.pid || {}) }
        : null;

    return {
        ...machine,
        heaters: [
            { ...top, pid: applyOffset(top.pid) },
            { ...top, ...bot, pid: applyOffset(mergedBotPid) }
        ]
    };
}

export function validateSimulationParams({ thicknessMm, material, machine, simulation }) {
    const errors = [];

    if (!validPositive(thicknessMm)) errors.push("Invalid thickness.");
    if (!material || typeof material !== "object") errors.push("Invalid material model.");
    if (!machine || typeof machine !== "object") {
        errors.push("Invalid machine.");
    } else if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) {
        errors.push("Exactly two heaters are required.");
    }
    if (!simulation || typeof simulation !== "object") errors.push("Simulation parameters are missing.");

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    const am = simulation.accuracyMode;
    if (am && typeof am === "object") {
        const is1DMode = simulation.widthHalfMm === 0;
        if (!validPositive(am.gridDensityX)) {
            errors.push("Invalid custom parameter: gridDensityX must be a positive number.");
        }
        if (!is1DMode && !validPositive(am.gridDensityY)) {
            errors.push("Invalid custom parameter: gridDensityY must be a positive number.");
        }
        if (!validPositive(am.tempStepK)) {
            errors.push("Invalid custom parameter: tempStepK must be a positive number.");
        }
    }

    return errors.length > 0 ? { isValid: false, errors } : { isValid: true };
}

export function calculateGridNodeCountX(thicknessMm, stepXMm) {
    return Math.max(MIN_GRID_NODES_X, Math.round(thicknessMm / stepXMm)) + 1;
}

export function calculateGridNodeCountY(widthHalfMm, stepYMm) {
    if (widthHalfMm === 0) return 1;
    return Math.max(MIN_GRID_NODES_Y, Math.round(widthHalfMm / stepYMm)) + 1;
}

export function densityToGridStepX(densityX, thicknessMm) {
    if (!validPositive(thicknessMm) || !validPositive(densityX)) return NaN;
    const intervals = Math.max(MIN_GRID_NODES_X, Math.round(densityX * Math.pow(thicknessMm, GRID_DENSITY_EXP_X)));
    return thicknessMm / intervals;
}

export function snapGridDensityX(rawDensityX, thicknessMm) {
    if (!validPositive(thicknessMm) || !validPositive(rawDensityX)) return rawDensityX;
    const intervals = Math.max(MIN_GRID_NODES_X, Math.round(rawDensityX * Math.pow(thicknessMm, GRID_DENSITY_EXP_X)));
    return intervals / Math.pow(thicknessMm, GRID_DENSITY_EXP_X);
}

export function densityToGridStepY(densityY, widthHalfMm) {
    if (!validPositive(widthHalfMm)) return 1.0;
    if (!validPositive(densityY)) return NaN;
    const intervals = Math.max(MIN_GRID_NODES_Y, Math.round(densityY * Math.pow(widthHalfMm, GRID_DENSITY_EXP_Y)));
    return widthHalfMm / intervals;
}

export function snapGridDensityY(rawDensityY, widthHalfMm) {
    if (!validPositive(widthHalfMm) || !validPositive(rawDensityY)) return rawDensityY;
    const intervals = Math.max(MIN_GRID_NODES_Y, Math.round(rawDensityY * Math.pow(widthHalfMm, GRID_DENSITY_EXP_Y)));
    return intervals / Math.pow(widthHalfMm, GRID_DENSITY_EXP_Y);
}

// ============================================================================
// 3. ГЕНЕРАТОРЫ НЕРАВНОМЕРНЫХ ПРОСТРАНСТВЕННЫХ СЕТОК
// ============================================================================

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

function createParametricGridY(widthHalfMm, nodeCount, slotHalfWidthMm, convectionTransitionEndMm) {
    if (!validPositive(widthHalfMm) || !Number.isInteger(nodeCount) || nodeCount < 2) {
        throw new RangeError("Invalid Y-grid dimensions.");
    }

    const y = new Float64Array(nodeCount);
    const H = EFFECTIVE_H_MM;
    const H2 = H * H;
    const yCenter = (slotHalfWidthMm + convectionTransitionEndMm) / 2.0;
    const centerWidth = 3.0;
    const zoneWidth = Math.max(1e-6, (convectionTransitionEndMm - slotHalfWidthMm) * 0.5 || 1.5);

    const radiationPeakY = H * 0.5;
    const radiationPeakViewFactor = Math.pow(H2 / (H2 + radiationPeakY * radiationPeakY), 1.5);
    const maxRadiationGradient = (3.0 * radiationPeakY / (H2 + radiationPeakY * radiationPeakY)) * radiationPeakViewFactor;

    function getWeightDensity(posMm) {
        let weight = 1.0;
        weight += 2.0 * Math.exp(-Math.pow(posMm / centerWidth, 2));

        const viewFactor = Math.pow(H2 / (H2 + posMm * posMm), 1.5);
        const radiationGradient = (3.0 * posMm / (H2 + posMm * posMm)) * viewFactor;
        const normalizedRadiationGradient = maxRadiationGradient > 0 ? radiationGradient / maxRadiationGradient : 0;

        weight += 2.0 * normalizedRadiationGradient;
        weight += 8.0 * Math.exp(-Math.pow((posMm - yCenter) / zoneWidth, 2));
        return weight;
    }

    // Интегрирование плотности методом трапеций
    const integrationIntervals = Math.max(2048, nodeCount * 64);
    const integrationStep = widthHalfMm / integrationIntervals;
    const cumulative = new Float64Array(integrationIntervals + 1);

    let previousWeight = getWeightDensity(0);
    for (let i = 1; i <= integrationIntervals; i++) {
        const pos = i * integrationStep;
        const currentWeight = getWeightDensity(pos);
        cumulative[i] = cumulative[i - 1] + 0.5 * (previousWeight + currentWeight) * integrationStep;
        previousWeight = currentWeight;
    }

    const totalWeight = cumulative[integrationIntervals];
    if (!validPositive(totalWeight)) {
        throw new Error("Invalid Y-grid density integral.");
    }
    // Обратное распределение координат через бинарный поиск
    y[0] = 0.0;
    y[nodeCount - 1] = widthHalfMm;
    const minSpacing = Math.max(MIN_GEOMETRIC_STEP_MM, Number.EPSILON * widthHalfMm * 8);

    for (let j = 1; j < nodeCount - 1; j++) {
        const targetWeight = totalWeight * j / (nodeCount - 1);
        let low = 0;
        let high = integrationIntervals;

        while (high - low > 1) {
            const mid = (low + high) >> 1;
            if (cumulative[mid] < targetWeight) low = mid;
            else high = mid;
        }

        const c0 = cumulative[low];
        const c1 = cumulative[high];
        const fraction = c1 > c0 ? (targetWeight - c0) / (c1 - c0) : 0;
        const rawPosition = (low + fraction) * integrationStep;
        const lowerBound = y[j - 1] + minSpacing;
        const upperBound = widthHalfMm - (nodeCount - 1 - j) * minSpacing;

        if (lowerBound > upperBound) {
            throw new Error("Insufficient Y-grid spacing.");
        }

        y[j] = clamp(rawPosition, lowerBound, upperBound);
    }
// Расчет шагов и обратных интервалов
    const dy = new Float64Array(nodeCount - 1);
    const dyHat = new Float64Array(nodeCount);
    for (let j = 0; j < nodeCount - 1; j++) dy[j] = y[j + 1] - y[j];
    dyHat[0] = 0.5 * dy[0];
    for (let j = 1; j < nodeCount - 1; j++) dyHat[j] = 0.5 * (dy[j - 1] + dy[j]);
    dyHat[nodeCount - 1] = 0.5 * dy[nodeCount - 2];
    const invDyH = new Float64Array(nodeCount);
    const invDyL = new Float64Array(nodeCount);
    const invDyR = new Float64Array(nodeCount);
    for (let j = 0; j < nodeCount; j++) {
        invDyH[j] = 1000.0 / dyHat[j];
        if (j > 0) invDyL[j] = 1000.0 / dy[j - 1];
        if (j < nodeCount - 1) invDyR[j] = 1000.0 / dy[j];
    }
    return { y, dy, dyHat, invDyH, invDyL, invDyR, nodeCount };
}
function create1DStubGridY() {
    return {
        y: new Float64Array([0.0]),
        dy: new Float64Array([0.0]),
        dyHat: new Float64Array([0.0]),
        invDyH: new Float64Array([1000.0 / 0.001]),
        invDyL: new Float64Array([0.0]),
        invDyR: new Float64Array([0.0]),
        nodeCount: 1
    };
}
// ============================================================================
// 4. МОДЕЛЬ МАТЕРИАЛА И ГРАНИЧНЫХ УСЛОВИЙ
// ============================================================================
function getDynamicHeaterTempK(heater, ambT, timeSeconds) {
    // 1. Сначала вычисляем базовую (среднюю) температуру самого ТЭНа
    let effectiveTempC = ambT + heater.heaterTemperatureFactor * (heater.regulatorTemperatureC - ambT);
    const pid = heater.pid;

    // 2. Прибавляем колебания напрямую к температуре ТЭНа без масштабирования
    if (pid && pid.amplitudeC > 0 && pid.periodSeconds > 0) {
        const omega = (2.0 * Math.PI) / pid.periodSeconds;
        const phaseSec = pid.phaseSeconds || 0.0;
        const rawSin = Math.sin(omega * (timeSeconds + phaseSec));

        // Параметр кривизны: 0 -> синусоида, 1 -> прямые линии
        const shape = clamp(pid.shape ?? 0.0, -0.99, 1.0);
        let wave;

        if (Math.abs(shape) < 1e-4) {
            wave = rawSin;
        } else if (shape >= 0.9999) {
            wave = (2.0 / Math.PI) * Math.asin(rawSin);
        } else {
            wave = Math.asin(shape * rawSin) / Math.asin(shape);
        }

        effectiveTempC += pid.amplitudeC * wave;
    }

    return toKelvin(effectiveTempC);
}

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
// ============================================================================
// 5. РЕШАТЕЛЬ ЛЕНТОЧНЫХ СЛАУ (LU-РАЗЛОЖЕНИЕ С ПОДСЧЕТОМ НЕВЯЗКИ)
// ============================================================================
function solveBandMatrixOptimized(A, N, bandWidth, r, x, precalc, origDiag = null, residualOut = null) {
    const abRowStride = bandWidth * 2 + 1;
    const lead = bandWidth;
    const strideU = abRowStride - 1;
    const { iMin: iMinArr, iMax: iMaxArr, kMinI: kMinIArr, kMinJ: kMinJArr, jMin: jMinArr, jMax: jMaxArr } = precalc;
// 1. LU-факторизация
    for (let j = 0; j < N; j++) {
        const iMin = iMinArr[j];
        const iMax = iMaxArr[j];
        const kMinJ = kMinJArr[j];
        const diagIdx = j * abRowStride + lead;
// Верхняя треугольная матрица U
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
                sum -= A[iStride + lead + k - i] * A[k * abRowStride + lead + j - k];
            }
            A[targetIdx] = sum;
        }
        const diagVal = A[diagIdx];
        if (!Number.isFinite(diagVal) || diagVal === 0) return false;
// Нижняя треугольная матрица L
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
                sum -= A[iStride + lead + k - i] * A[k * abRowStride + lead + j - k];
            }
            A[targetIdx] = sum / diagVal;
        }
    }
// 2. Прямая подстановка (Ly = r)
    for (let i = 0; i < N; i++) {
        let sum = r[i];
        const baseIdx = i * abRowStride + lead - i;
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
// 3. Обратная подстановка (Ux = y)
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
// 4. Оценка относительной невязки ||b - Ax|| / (||A||*||x|| + ||b||)
    if (origDiag && residualOut) {
        let maxRes = 0.0;
        let maxNormA = 0.0;
        let maxNormX = 0.0;
        let maxNormB = 0.0;
        for (let idx = 0; idx < N; idx++) {
            const xVal = x[idx];
            const absX = Math.abs(xVal);
            if (absX > maxNormX) maxNormX = absX;
            const bVal = r[idx];
            const absB = Math.abs(bVal);
            if (absB > maxNormB) maxNormB = absB;
            const c = origDiag.c[idx];
            const w = origDiag.w[idx];
            const e = origDiag.e[idx];
            const n = origDiag.n[idx];
            const s = origDiag.s[idx];
            const rowNormA = Math.abs(c) + Math.abs(w) + Math.abs(e) + Math.abs(n) + Math.abs(s);
            if (rowNormA > maxNormA) maxNormA = rowNormA;
            let ax = c * xVal;
            if (w !== 0) ax += w * x[idx - 1];
            if (e !== 0) ax += e * x[idx + 1];
            if (n !== 0) ax += n * x[idx - bandWidth];
            if (s !== 0) ax += s * x[idx + bandWidth];
            const res = Math.abs(bVal - ax);
            if (res > maxRes) maxRes = res;
        }
        const denom = maxNormA * maxNormX + maxNormB;
        residualOut.value = denom > 0 ? (maxRes / denom) : 0.0;
    }
    return true;
}
// ============================================================================
// 6. ВСПОМОГАТЕЛЬНЫЕ ФАБРИКИ ДЛЯ СИМУЛЯЦИИ
// ============================================================================
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
function resolveSimulationConfig(simulation, thicknessMm) {
    const rawMode = simulation?.accuracyMode;
    const isStringMode = typeof rawMode === "string";
    let mode = isStringMode ? rawMode : (rawMode ? "custom" : "optimal");
    if (isStringMode && !ACCURACY_MODES.includes(mode)) mode = "optimal";
    const isCustom = mode === "custom";
    const modeIdx = !isCustom ? ACCURACY_MODES.indexOf(mode) : 1;
    const am = isStringMode ? null : rawMode;
    const activeDensityX = isCustom ? (am?.gridDensityX ?? LIMITS.gridDensityX[modeIdx]) : LIMITS.gridDensityX[modeIdx];
    const activeDensityY = isCustom ? (am?.gridDensityY ?? LIMITS.gridDensityY[modeIdx]) : LIMITS.gridDensityY[modeIdx];
    const stepXMm = densityToGridStepX(activeDensityX, thicknessMm);
    const stepYMm = densityToGridStepY(activeDensityY, simulation.widthHalfMm);
    const targetDeltaT = isCustom
        ? (am?.tempStepK ?? am?.targetDt ?? LIMITS.tempStepK[modeIdx])
        : LIMITS.tempStepK[modeIdx];
    return {
        mode,
        stepXMm,
        stepYMm,
        targetDeltaT,
        nonlinearToleranceK: clamp(0.02 * targetDeltaT * targetDeltaT, 0.001, 0.25),
        shouldCalculateAccuracyError: simulation?.calculateAccuracyError !== false,
        is1D: simulation.widthHalfMm === 0
    };
}
function precomputeSolverIndices(size2D, bandWidth) {
    const precalc = {
        iMin: new Int32Array(size2D),
        iMax: new Int32Array(size2D),
        kMinJ: new Int32Array(size2D),
        kMinI: new Int32Array(size2D),
        jMin: new Int32Array(size2D),
        jMax: new Int32Array(size2D)
    };
    for (let idx = 0; idx < size2D; idx++) {
        precalc.iMin[idx] = idx - bandWidth < 0 ? 0 : idx - bandWidth;
        precalc.iMax[idx] = idx + bandWidth > size2D - 1 ? size2D - 1 : idx + bandWidth;
        precalc.kMinJ[idx] = idx - bandWidth < 0 ? 0 : idx - bandWidth;
        precalc.kMinI[idx] = idx - bandWidth < 0 ? 0 : idx - bandWidth;
        precalc.jMin[idx] = idx - bandWidth < 0 ? 0 : idx - bandWidth;
        precalc.jMax[idx] = idx + bandWidth > size2D - 1 ? size2D - 1 : idx + bandWidth;
    }
    return precalc;
}
function createBoundaryContext(mach, material, gridY, ambT) {
    const Ny = gridY.nodeCount;
    const ambientTemperatureK = toKelvin(ambT);
    const ambientTemperatureK_4 = Math.pow(ambientTemperatureK, 4);

    const epsS = material.emissivity;
    const epsH_top = mach.heaters[0].heaterEmissivity;
    const epsH_bot = mach.heaters[1].heaterEmissivity;
    const epsEffH_top = (epsH_top * epsS) / (epsH_top + epsS - epsH_top * epsS);
    const epsEffH_bot = (epsH_bot * epsS) / (epsH_bot + epsS - epsH_bot * epsS);

    const hTop = mach.heaters[0].convectiveHeatTransferCoefficient;
    const hBot = mach.heaters[1].convectiveHeatTransferCoefficient;

    const precalcConvTopH = new Float64Array(Ny);
    const precalcConvTopAir = new Float64Array(Ny);
    const precalcConvBotH = new Float64Array(Ny);
    const precalcConvBotAir = new Float64Array(Ny);
    const convWeightsTop = new Float64Array(Ny);
    const convWeightsBot = new Float64Array(Ny);

    for (let j = 0; j < Ny; j++) {
        const yMm = gridY.y[j];
        const wTop = smoothStepCosine(yMm, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM);
        convWeightsTop[j] = wTop;
        precalcConvTopH[j] = wTop * hTop + (1 - wTop) * AMBIENT_CONVECTION_H_TOP;

        const wBot = smoothStepCosine(yMm, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM);
        convWeightsBot[j] = wBot;
        precalcConvBotH[j] = wBot * hBot + (1 - wBot) * AMBIENT_CONVECTION_H_BOT;
    }

    const ctx = {
        mach,
        ambT,
        Ny,
        viewFactorsY: getNonlinearViewFactors(gridY.y),
        T_top_K: 0,
        T_bot_K: 0,
        T_top_K_4: 0,
        T_bot_K_4: 0,
        ambientTemperatureK,
        ambientTemperatureK_4,
        radFactorTopBase: mach.heaters[0].radiationGain * epsEffH_top * SIGMA,
        radFactorBotBase: mach.heaters[1].radiationGain * epsEffH_bot * SIGMA,
        radFactorAmbient: epsS * SIGMA,
        convWeightsTop,
        convWeightsBot,
        precalcConvTopH,
        precalcConvTopAir,
        precalcConvBotH,
        precalcConvBotAir
    };

    updateBoundaryContextForTime(ctx, 0);
    return ctx;
}

function updateBoundaryContextForTime(bc, timeSeconds) {
    const T_top_K = getDynamicHeaterTempK(bc.mach.heaters[0], bc.ambT, timeSeconds);
    const T_bot_K = getDynamicHeaterTempK(bc.mach.heaters[1], bc.ambT, timeSeconds);

    bc.T_top_K = T_top_K;
    bc.T_bot_K = T_bot_K;
    bc.T_top_K_4 = Math.pow(T_top_K, 4);
    bc.T_bot_K_4 = Math.pow(T_bot_K, 4);

    const ambK = bc.ambientTemperatureK;
    for (let j = 0; j < bc.Ny; j++) {
        const wTop = bc.convWeightsTop[j];
        bc.precalcConvTopAir[j] = wTop * T_top_K + (1 - wTop) * ambK;

        const wBot = bc.convWeightsBot[j];
        bc.precalcConvBotAir[j] = wBot * T_bot_K + (1 - wBot) * ambK;
    }
}

function buildAccuracyMetrics(mode, maxLinearResidual, maxPicardError, maxTimeError, maxGridError) {
    const totalErrorScore = Math.sqrt(
        maxPicardError ** 2 +
        maxTimeError ** 2 +
        maxGridError ** 2
    );
    return {
        accuracyMode: mode,
        linearResidual: maxLinearResidual,
        picardConvergenceErrorC: maxPicardError,
        timeIntegrationErrorC: maxTimeError,
        spatialGridErrorC: maxGridError,
        totalErrorScore,
        formatted: `Score: ${totalErrorScore.toFixed(2)}`
    };
}

function isTargetReached2D(T, Nx, Ny, target, targetK, outCurrentValue) {
    if (!target || target.type === "time") return false;
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

// ============================================================================
// 7. ГЛАВНЫЙ ЦИКЛ 2D СИМУЛЯЦИИ НАГРЕВА И ОХЛАЖДЕНИЯ
// ============================================================================
export function simulate2DHeating({ thicknessMm, material, machine, simulation, storeHistory = false, onProgress }) {
    const calculationStart = performance.now();

    // --- 7.1. Валидация входных данных ---
    const mach = normalizeMachine(machine);
    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({ thicknessMm, material, machine: mach, simulation });
    if (!validation.isValid) return makeError(validation.errors);

    const matModel = createMaterialModel(material);
    if (!matModel) return makeError("Invalid material model.");

    // --- 7.2. Построение сетки и проверка лимитов памяти ---
    const cfg = resolveSimulationConfig(simulation, thicknessMm);
    const Nx = calculateGridNodeCountX(thicknessMm, cfg.stepXMm);
    const Ny = calculateGridNodeCountY(simulation.widthHalfMm, cfg.stepYMm);

    if (Nx > MAX_NODES_X || Ny > MAX_NODES_Y) {
        return makeError(`Grid dimensions (${Nx}x${Ny}) exceed technical limits.`);
    }

    const size2D = Nx * Ny;
    const bandWidth = Ny;
    const abRowStride = bandWidth * 2 + 1;
    const lead = bandWidth;

    if (size2D * abRowStride > MAX_BAND_MATRIX_ELEMENTS) {
        return makeError(`Band matrix size (${size2D * abRowStride}) exceeds memory safety limit.`);
    }

    const lastX = Nx - 1;
    const lastY = Ny - 1;
    const gridX = createNonlinearGridX(thicknessMm, Nx);
    const gridY = cfg.is1D
        ? create1DStubGridY()
        : createParametricGridY(simulation.widthHalfMm, Ny, DEFAULT_SLOT_HALF_WIDTH_MM, DEFAULT_CONVECTION_TRANSITION_END_MM);
// --- 7.3. Инициализация буферов СЛАУ и предвычислений ---
    const initT = simulation.temperatures.initialC;
    const ambT = simulation.temperatures.ambientC;
    const initTK = toKelvin(initT);
    const buffers = [
        new Float64Array(size2D).fill(initTK),
        new Float64Array(size2D).fill(initTK),
        new Float64Array(size2D).fill(initTK)
    ];
    const matrixA = new Float64Array(size2D * abRowStride);
    const rhsVec = new Float64Array(size2D);
    const solverX = new Float64Array(size2D);
    const origDiag = {
        c: new Float64Array(size2D),
        w: new Float64Array(size2D),
        e: new Float64Array(size2D),
        n: new Float64Array(size2D),
        s: new Float64Array(size2D)
    };
    const residualOut = { value: 0.0 };
    const precalc = precomputeSolverIndices(size2D, bandWidth);
    const bc = createBoundaryContext(mach, material, gridY, ambT);
// Предвычисления для оценки пространственной ошибки по Y и X
    const DIFFUSION_INFLUENCE_RADIUS_MM = 3.5;
    const invDiffRadiusSq = 1.0 / (DIFFUSION_INFLUENCE_RADIUS_MM * DIFFUSION_INFLUENCE_RADIUS_MM);
    const yErrorWeights = new Float64Array(Ny);
    let maxActiveJ = 0;
    if (cfg.is1D) {
        yErrorWeights[0] = 1.0;
    } else if (Ny >= 3) {
        for (let j = 0; j < lastY; j++) {
            const yPos = gridY.y[j];
            const w = j === 0 ? 1.0 : Math.exp(-(yPos * yPos) * invDiffRadiusSq);
            yErrorWeights[j] = w;
            if (w > 1e-3) maxActiveJ = j;
        }
    }
    const invDxSumArr = new Float64Array(Nx);
    const dxProdEighthArr = new Float64Array(Nx);
    for (let i = 1; i < lastX; i++) {
        const dxL = gridX.dx[i - 1];
        const dxR = gridX.dx[i];
        invDxSumArr[i] = 2.0 / (dxL + dxR);
        dxProdEighthArr[i] = (dxL * dxR) * 0.125;
    }
    const dxTopMeters = gridX.dx[0] * 0.001;
    const dxBotMeters = gridX.dx[lastX - 1] * 0.001;
// --- 7.4. Параметры целевого состояния, фаз и счетчики ---
    const target = simulation.target;
    const targetType = target.type;
    const targetValue = target.value;
    const targetK = (targetType === "minTemperature" || targetType === "surfaceTemperature") ? toKelvin(targetValue) : null;
    const maxTimeSeconds = simulation.maxTimeSeconds;
    const simulationMaxTime = targetType === "time" ? Math.min(maxTimeSeconds, targetValue) : maxTimeSeconds;
    const decompTempK = toKelvin(material.decompositionTemp);
    const stopAtMaxTemperature = simulation.stopAtMaxTemperature === true;
    const totalCoolingTime = simulation.cooling?.timeSeconds || 0;
    const hCooling = simulation.cooling?.convectiveHeatTransferCoefficient || 8.0;
    const PICARD_PASS_CPU_COST = size2D * (Ny + 2) + (size2D * 150);
    const MAX_ALLOWED_STEP_CPU_UNITS = PICARD_PASS_CPU_COST * 40;
    let dt = simulation.dtSeconds !== undefined ? simulation.dtSeconds : Math.min(0.5, cfg.targetDeltaT * 0.15);
    let step = 1;
    let stepCountInPhase = 0;
    let time = 0;
    let coolingTimeElapsed = 0;
    let currentPhase = "heating";
// Регистры трехслойной схемы времени для оценки локальной ошибки усечения
    const idxTop = 0;
    const idxMid = ((Nx - 1) >> 1) * Ny;
    const idxBot = lastX * Ny;
    let t_nm1 = 0, t_n = 0;
    let T_nm1_top = initTK, T_nm1_mid = initTK, T_nm1_bot = initTK;
    let T_n_top = initTK, T_n_mid = initTK, T_n_bot = initTK;
// Метрики точности и производительности
    let maxGridErrorC = 0.0;
    let maxPicardConvergenceErrorC = 0.0;
    let maxLinearResidual = 0.0;
    let maxTimeErrorC = 0.0;
    let countTimeSteps = 0;
    let countRejectedSteps = 0;
    let countConsecutiveRejectedSteps = 0;
    let totalPicardIterations = 0;
    let totalCpuUnits = 0;
    let currentStepCpuUnits = 0;
    let heatingProfileC = null;
    let reachedTarget = false;
    let status = null;
// Настройки логирования истории и прогресса UI
    const history = storeHistory ? {
        time: [],
        frontSurfaceC: [],
        centerC: [],
        backSurfaceC: [],
        topHeaterC: [],    // <-- ДОБАВИТЬ
        bottomHeaterC: []  // <-- ДОБАВИТЬ
    } : undefined;

    let lastLoggedTime = -1;

    const logHistoryGlobal = (currentAbsoluteTime, force = false) => {
        if (!storeHistory || !history) return;
        if (history.time.length > 0 && history.time[history.time.length - 1] === currentAbsoluteTime) return;
        if (!force && (currentAbsoluteTime - lastLoggedTime < 1.0)) return;

        const currentBuffer = buffers[step % 3];
        history.time.push(currentAbsoluteTime);
        history.frontSurfaceC.push(currentBuffer[idxTop] - 273.15);
        history.centerC.push(currentBuffer[idxMid] - 273.15);
        history.backSurfaceC.push(currentBuffer[idxBot] - 273.15);

        // ЛОГИРОВАНИЕ ТЕМПЕРАТУРЫ ТЭНОВ:
        if (currentPhase === "heating") {
            // Если время 0, берем начальную температуру ТЭНов из bc
            const topC = (step === 1 && currentAbsoluteTime === 0)
                ? getDynamicHeaterTempK(mach.heaters[0], ambT, 0) - 273.15
                : bc.T_top_K - 273.15;
            const botC = (step === 1 && currentAbsoluteTime === 0)
                ? getDynamicHeaterTempK(mach.heaters[1], ambT, 0) - 273.15
                : bc.T_bot_K - 273.15;

            history.topHeaterC.push(topC);
            history.bottomHeaterC.push(botC);
        } else {
            // В фазе охлаждения ТЭНы отключены (прерываем линию на графике)
            history.topHeaterC.push(null);
            history.bottomHeaterC.push(null);
        }

        lastLoggedTime = currentAbsoluteTime;
    };

    logHistoryGlobal(0, true);
    const maxHeatingPercent = simulation.maxHeatingPercent ?? (totalCoolingTime > 0 ? 95 : 99);
    const coolingWeightRange = 100 - maxHeatingPercent;
    const totalRangeHeating = targetValue - initT;
    const invTargetValueTime = targetValue > 0 ? (1.0 / targetValue) : 0.0;
    const invMaxTimeSeconds = maxTimeSeconds > 0 ? (1.0 / maxTimeSeconds) : 0.0;
    const invTotalCoolingTime = totalCoolingTime > 0 ? (1.0 / totalCoolingTime) : 0.0;
    let lastReportedPercent = -1;
    let lastReportTimeMs = performance.now();
    const switchToCoolingPhase = () => {
        currentPhase = "cooling";
        const currentBuffer = buffers[step % 3];
        heatingProfileC = new Float64Array(size2D);
        for (let i = 0; i < size2D; i++) heatingProfileC[i] = currentBuffer[i] - 273.15;
        stepCountInPhase = 0;
        t_nm1 = 0;
        t_n = 0;
        T_n_top = T_nm1_top = currentBuffer[idxTop];
        T_n_mid = T_nm1_mid = currentBuffer[idxMid];
        T_n_bot = T_nm1_bot = currentBuffer[idxBot];
        dt = cfg.targetDeltaT * 0.15;
        countConsecutiveRejectedSteps = 0;
        currentStepCpuUnits = 0;
        logHistoryGlobal(time + coolingTimeElapsed, true);
    };
    const { invDxH, invDxL, invDxR } = gridX;
    const { invDyH, invDyL, invDyR } = gridY;
// --- 7.5. Основной временной цикл ---
    mainSimulationLoop: while (true) {
        if (totalCpuUnits > MAX_TOTAL_CPU_UNITS) {
            status = { type: "abort", message: "Simulation terminated: Total CPU complexity exceeded safety limit." };
            break;
        }
        if (countTimeSteps > MAX_TOTAL_TIME_STEPS) {
            status = { type: "abort", message: "Simulation terminated: Exceeded maximum time steps limit." };
            break;
        }
        // Ограничение шага по границам фаз
        if (currentPhase === "heating") {
            if (targetType === "time" && time + dt > targetValue) dt = targetValue - time;
            else if (time + dt > simulationMaxTime) dt = simulationMaxTime - time;
        } else if (coolingTimeElapsed + dt > totalCoolingTime) {
            dt = totalCoolingTime - coolingTimeElapsed;
        }
        if (dt < 1e-5) {
            if (currentPhase === "heating" && totalCoolingTime > 0 && reachedTarget && step > 1) {
                switchToCoolingPhase();
                continue;
            }
            const isCoolingFinished = currentPhase === "cooling" && (totalCoolingTime - coolingTimeElapsed) <= 1e-4;
            if (!isCoolingFinished && (step <= 1 || (!reachedTarget && targetType !== "time"))) {
                status = {
                    type: "error",
                    message: `Simulation stalled completely: Time step fell below critical limit (1e-5) on step #${step} (${currentPhase}).`
                };
            }
            break;
        }
        const curIdx = step % 3;
        const newIdx = (step + 1) % 3;
        buffers[newIdx].set(buffers[curIdx]);

        if (currentPhase === "heating") {
            updateBoundaryContextForTime(bc, time + dt);
        }

// --- Итерации Пикара (нелинейная сходимость на текущем шаге dt) ---
        let nonlinearConverged = false;
        let lastIterMaxSignedDiff = 0.0;
        let prevDeltaK = Infinity;
        let consecutiveBadSteps = 0;
        for (let iter = 0; iter < MAX_PICARD_ITERATIONS; iter++) {
            totalPicardIterations++;
            matrixA.fill(0);
            origDiag.c.fill(0);
            origDiag.w.fill(0);
            origDiag.e.fill(0);
            origDiag.n.fill(0);
            origDiag.s.fill(0);
// Сборка ленточной матрицы A и правой части rhsVec
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const idxInvDxH = invDxH[i];
                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = buffers[newIdx][idxRow];
                    const oldTempC = buffers[curIdx][idxRow] - 273.15;
                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const dtkEff = dt * props.k;
                    rhsVec[idxRow] = buffers[curIdx][idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;
                    const matRowOffset = idxRow * abRowStride + lead;
// Диффузия и граничные условия по толщине X
                    if (i > 0 && i < lastX) {
                        const coeffLeft = dtkEff * idxInvDxH * invDxL[i];
                        const coeffRight = dtkEff * idxInvDxH * invDxR[i];
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else {
                        const isTopBound = (i === 0);
                        const coeffNext = isTopBound ? (dtkEff * idxInvDxH * invDxR[i]) : (dtkEff * idxInvDxH * invDxL[i]);
                        matrixA[matRowOffset + (isTopBound ? Ny : -Ny)] = -coeffNext;
                        centerCoeff += coeffNext;
                        const currentTempK_2 = currentTempK * currentTempK;
                        const currentTempK_3 = currentTempK_2 * currentTempK;
                        const currentTempK_4 = currentTempK_2 * currentTempK_2;
                        let q_conv = 0, dq_conv = 0, q_rad = 0, dq_rad = 0;
                        if (currentPhase === "heating") {
                            const fH = bc.viewFactorsY[j];
                            if (isTopBound) {
                                q_conv = bc.precalcConvTopH[j] * (bc.precalcConvTopAir[j] - currentTempK);
                                dq_conv = -bc.precalcConvTopH[j];
                                q_rad = bc.radFactorTopBase * fH * (bc.T_top_K_4 - currentTempK_4);
                                dq_rad = -4 * bc.radFactorTopBase * fH * currentTempK_3;
                            } else {
                                q_conv = bc.precalcConvBotH[j] * (bc.precalcConvBotAir[j] - currentTempK);
                                dq_conv = -bc.precalcConvBotH[j];
                                q_rad = bc.radFactorBotBase * fH * (bc.T_bot_K_4 - currentTempK_4);
                                dq_rad = -4 * bc.radFactorBotBase * fH * currentTempK_3;
                            }
                        } else {
                            q_conv = hCooling * (bc.ambientTemperatureK - currentTempK);
                            dq_conv = -hCooling;
                            q_rad = bc.radFactorAmbient * (bc.ambientTemperatureK_4 - currentTempK_4);
                            dq_rad = -4 * bc.radFactorAmbient * currentTempK_3;
                        }
                        centerCoeff -= (dt * idxInvDxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (dt * idxInvDxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    }
// Диффузия и граничные условия по полуширине Y
                    if (!cfg.is1D) {
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
                            const T_edge_old = buffers[curIdx][idxRow];
                            const T_virtual_extrapolated = T_edge_old - (buffers[curIdx][idxRow - 1] - T_edge_old);
                            const T_target = T_virtual_extrapolated < bc.ambientTemperatureK ? bc.ambientTemperatureK : T_virtual_extrapolated;
                            rhsVec[idxRow] += coeffRightY * (T_target - T_edge_old);
                        }
                    }
                    matrixA[matRowOffset] = centerCoeff;
                    origDiag.c[idxRow] = centerCoeff;
                    if (!cfg.is1D) {
                        if (j > 0) origDiag.w[idxRow] = matrixA[matRowOffset - 1];
                        if (j < lastY) origDiag.e[idxRow] = matrixA[matRowOffset + 1];
                    }
                    if (i > 0) origDiag.n[idxRow] = matrixA[matRowOffset - Ny];
                    if (i < lastX) origDiag.s[idxRow] = matrixA[matRowOffset + Ny];
                }
            }
// Решение СЛАУ
            const solverSuccess = solveBandMatrixOptimized(
                matrixA, size2D, bandWidth, rhsVec, solverX, precalc, origDiag, residualOut
            );
            totalCpuUnits += PICARD_PASS_CPU_COST;
            currentStepCpuUnits += PICARD_PASS_CPU_COST;
            if (currentStepCpuUnits > MAX_ALLOWED_STEP_CPU_UNITS) {
                status = {
                    type: "abort",
                    message: `Simulation killed on the fly: Matrix loop lockdown. CPU workload limit exceeded (${currentStepCpuUnits} units) on a single time coordinate.`
                };
                break mainSimulationLoop;
            }
// Проверка на вырожденность и потерю точности линейного решателя
            if (!solverSuccess || !Number.isFinite(residualOut.value) || residualOut.value > 1e-7) {
                countRejectedSteps++;
                countConsecutiveRejectedSteps++;
                if (countConsecutiveRejectedSteps > MAX_CONSECUTIVE_REJECTIONS) {
                    status = {
                        type: "error",
                        message: !solverSuccess
                            ? `Simulation aborted on the fly: Matrix singularity and consecutive step rejections (${countConsecutiveRejectedSteps} times).`
                            : `Simulation aborted: Linear solver lost precision (residual: ${Number.isFinite(residualOut.value) ? residualOut.value.toExponential(2) : "NaN"}).`
                    };
                    break mainSimulationLoop;
                }
                dt *= DT_SINGULARITY_SHRINK;
                if (dt < 1e-6) {
                    status = {
                        type: "error",
                        message: !solverSuccess
                            ? `Time step reached critical minimum limit due to matrix singularity (${currentPhase}).`
                            : `Time step fell below critical limit due to ill-conditioned matrix (${currentPhase}).`
                    };
                    break mainSimulationLoop;
                }
                continue mainSimulationLoop;
            }
// Оценка невязки итерации Пикара
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
            if (maxDeltaK < cfg.nonlinearToleranceK) {
                nonlinearConverged = true;
                break;
            }
// Контроль расходимости и стагнации Пикара
            if (iter >= 4) {
                if (maxDeltaK > prevDeltaK * 1.20) {
                    consecutiveBadSteps++;
                    if (consecutiveBadSteps >= 2) break;
                } else {
                    consecutiveBadSteps = 0;
                }
                if (iter >= 6 && maxDeltaK >= prevDeltaK * 0.95) break;
            }
            prevDeltaK = maxDeltaK;
        }
// --- Обработка отказа нелинейной сходимости (откат шага dt) ---
        if (!nonlinearConverged) {
            countRejectedSteps++;
            countConsecutiveRejectedSteps++;
            if (currentStepCpuUnits > MAX_ALLOWED_STEP_CPU_UNITS) {
                status = {
                    type: "abort",
                    message: `Simulation killed: Matrix loop lockdown. Step CPU complexity (${currentStepCpuUnits}) exceeded limit on step #${step}.`
                };
                break;
            }
            if (countConsecutiveRejectedSteps > MAX_CONSECUTIVE_REJECTIONS) {
                status = {
                    type: "abort",
                    message: `Simulation aborted on the fly: High numerical friction and consecutive step rejections (${countConsecutiveRejectedSteps} times).`
                };
                break;
            }
            const residualRatio = Number.isFinite(lastIterMaxSignedDiff) && Math.abs(lastIterMaxSignedDiff) > 0
                ? Math.abs(lastIterMaxSignedDiff) / cfg.nonlinearToleranceK
                : DT_FALLBACK_RESIDUAL_RATIO;
            const autoShrink = clamp(DT_SAFETY_FACTOR / Math.sqrt(residualRatio), DT_REJECT_MIN_SHRINK, DT_REJECT_MAX_SHRINK);
            dt *= autoShrink;
            if (dt < 1e-6) {
                status = { type: "error", message: `Time step reached critical minimum limit (${currentPhase}).` };
                break;
            }
            continue;
        }
        countConsecutiveRejectedSteps = 0;
// --- Проверка перегрева (температуры деструкции) ---
        let overHeated = false;
        let maxObservedT = 0;
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
                const fraction = (decompTempK - maxOldT) / deltaTOverheat;
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
                if (totalCoolingTime > 0) {
                    step++;
                    currentStepCpuUnits = 0;
                    switchToCoolingPhase();
                    continue;
                }
                logHistoryGlobal(time + coolingTimeElapsed, true);
                break;
            }
        }
// --- Проверка достижения целевой температуры (с точной подгонкой dt) ---
        let forceStop = false;
        let currentStepCriticalValue = buffers[newIdx][idxTop];
        if (currentPhase === "heating" && targetK != null && targetType !== "time") {
            let criticalNodeIdx = 0;
            let isReached = false;
            if (targetType === "minTemperature") {
                let minValK = Infinity;
                for (let i = 0; i < Nx; i++) {
                    const nodeTempK = buffers[newIdx][i * Ny];
                    if (nodeTempK < minValK) {
                        minValK = nodeTempK;
                        criticalNodeIdx = i * Ny;
                    }
                }
                currentStepCriticalValue = minValK;
                isReached = minValK >= targetK;
            } else if (targetType === "surfaceTemperature") {
                const topK = buffers[newIdx][idxTop];
                const botK = buffers[newIdx][idxBot];
                const maxSurfaceK = topK > botK ? topK : botK;
                criticalNodeIdx = topK >= botK ? idxTop : idxBot;
                currentStepCriticalValue = maxSurfaceK;
                isReached = maxSurfaceK >= targetK;
            }
            if (isReached) {
                const oldNodeT = buffers[curIdx][criticalNodeIdx];
                const newNodeT = buffers[newIdx][criticalNodeIdx];
                const deltaTTarget = newNodeT - oldNodeT;
                if (deltaTTarget > 0.02 && oldNodeT < targetK) {
                    const fraction = (targetK - oldNodeT) / deltaTTarget;
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
// --- Оценка локальных погрешностей (пространственной и временной) ---
        let currentStepTimeErr = 0.0;
        if (nonlinearConverged) {
            const h2 = dt;
            const h1 = t_n - t_nm1;
            if (stepCountInPhase >= 2 && h1 > 1e-5 && h2 > 1e-5) {
                const timeRatio = h2 / h1;
                const currentBuffer = buffers[newIdx];
                const errTimeTop = Math.abs((currentBuffer[idxTop] - T_n_top) - timeRatio * (T_n_top - T_nm1_top));
                const errTimeMid = Math.abs((currentBuffer[idxMid] - T_n_mid) - timeRatio * (T_n_mid - T_nm1_mid));
                const errTimeBot = Math.abs((currentBuffer[idxBot] - T_n_bot) - timeRatio * (T_n_bot - T_nm1_bot));
                let localMaxTimeErr = errTimeTop > errTimeMid ? errTimeTop : errTimeMid;
                if (errTimeBot > localMaxTimeErr) localMaxTimeErr = errTimeBot;
                currentStepTimeErr = localMaxTimeErr;
                if (cfg.shouldCalculateAccuracyError && localMaxTimeErr > maxTimeErrorC) {
                    maxTimeErrorC = localMaxTimeErr;
                }
            }
        }

        if (cfg.shouldCalculateAccuracyError && nonlinearConverged) {
            const lastPicardDeltaK = Math.abs(lastIterMaxSignedDiff);
            if (lastPicardDeltaK > maxPicardConvergenceErrorC) maxPicardConvergenceErrorC = lastPicardDeltaK;
            if (residualOut.value > maxLinearResidual) maxLinearResidual = residualOut.value;
            const convergedT = buffers[newIdx];
            const prevT = buffers[curIdx];
            let stepMaxGridErrorSq = 0.0;
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const isTopBound = (i === 0);
                const isBotBound = (i === lastX);
                const invDxSum = invDxSumArr[i];
                const dxProdEighth = dxProdEighthArr[i];
                for (let j = 0; j <= maxActiveJ; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = convergedT[idxRow];
                    const weightY = yErrorWeights[j];
                    let errX = 0.0;
                    if (isTopBound || isBotBound) {
                        const props = matModel.get(currentTempK - 273.15, prevT[idxRow] - 273.15);
                        const kEff = Math.max(1e-6, props.k);
                        const currentTempK_4 = Math.pow(currentTempK, 4);
                        let qSurf = 0.0;
                        if (currentPhase === "heating") {
                            const fH = bc.viewFactorsY[j];
                            if (isTopBound) {
                                qSurf = bc.precalcConvTopH[j] * (bc.precalcConvTopAir[j] - currentTempK) +
                                    bc.radFactorTopBase * fH * (bc.T_top_K_4 - currentTempK_4);
                            } else {
                                qSurf = bc.precalcConvBotH[j] * (bc.precalcConvBotAir[j] - currentTempK) +
                                    bc.radFactorBotBase * fH * (bc.T_bot_K_4 - currentTempK_4);
                            }
                        } else {
                            qSurf = hCooling * (bc.ambientTemperatureK - currentTempK) +
                                bc.radFactorAmbient * (bc.ambientTemperatureK_4 - currentTempK_4);
                        }
                        const neighborT = isTopBound ? convergedT[idxRow + Ny] : convergedT[idxRow - Ny];
                        const dxMeters = isTopBound ? dxTopMeters : dxBotMeters;
                        errX = 0.25 * Math.abs((neighborT - currentTempK) + (dxMeters * qSurf) / kEff) * weightY;
                    } else {
                        const d2Tdx2 = invDxSum * (
                            (convergedT[idxRow + Ny] - currentTempK) * invDxR[i] * 0.001 -
                            (currentTempK - convergedT[idxRow - Ny]) * invDxL[i] * 0.001
                        );
                        errX = dxProdEighth * Math.abs(d2Tdx2) * weightY;
                    }
                    let errY = 0.0;
                    if (!cfg.is1D && Ny >= 3) {
                        if (j === 0) {
                            errY = 0.25 * Math.abs(convergedT[idxRow + 1] - currentTempK);
                        } else {
                            const dy1 = gridY.dy[j - 1];
                            const dy2 = gridY.dy[j];
                            const slope1 = (currentTempK - convergedT[idxRow - 1]) / dy1;
                            const slope2 = (convergedT[idxRow + 1] - currentTempK) / dy2;
                            const d2Tdy2 = 2.0 * (slope2 - slope1) / (dy1 + dy2);
                            errY = (dy1 * dy2 * 0.125) * Math.abs(d2Tdy2) * weightY;
                        }
                    }
                    const nodeErrSq = errX * errX + errY * errY;
                    if (nodeErrSq > stepMaxGridErrorSq) stepMaxGridErrorSq = nodeErrSq;
                }
            }
            const stepMaxGridError = Math.sqrt(stepMaxGridErrorSq);
            if (stepMaxGridError > maxGridErrorC) maxGridErrorC = stepMaxGridError;
        }

        // --- Фиксация принятого шага и обновление регистров времени ---
        t_nm1 = currentPhase === "heating" ? time : coolingTimeElapsed;
        t_n = t_nm1 + dt;
        T_nm1_top = T_n_top;
        T_nm1_mid = T_n_mid;
        T_nm1_bot = T_n_bot;
        const nextBuffer = buffers[newIdx];
        T_n_top = nextBuffer[idxTop];
        T_n_mid = nextBuffer[idxMid];
        T_n_bot = nextBuffer[idxBot];
        stepCountInPhase++;
        countTimeSteps++;
        if (currentPhase === "heating") time += dt;
        else coolingTimeElapsed += dt;
        logHistoryGlobal(time + coolingTimeElapsed, forceStop);
        // --- Отчет о прогрессе в UI ---
        if (onProgress) {
            let currentPercent = 0;
            if (currentPhase === "heating") {
                let heatingProgressFraction = 0;
                if (targetType === "time" && targetValue > 0) {
                    heatingProgressFraction = time * invTargetValueTime;
                } else if ((targetType === "minTemperature" || targetType === "surfaceTemperature") && targetValue > initT) {
                    const maxCurrentC = maxObservedT - 273.15;
                    const minCurrentC = currentStepCriticalValue - 273.15;
                    const surfaceFraction = clamp((maxCurrentC - initT) / (targetValue - initT), 0.0, 1.0);
                    const coreFraction = clamp((minCurrentC - initT) / totalRangeHeating, 0.0, 1.0);
                    if (targetType === "minTemperature") {
                        heatingProgressFraction = (surfaceFraction * (1.0 - coreFraction)) + (coreFraction * coreFraction);
                    } else {
                        heatingProgressFraction = surfaceFraction;
                    }
                } else if (maxTimeSeconds > 0) {
                    heatingProgressFraction = time * invMaxTimeSeconds;
                }
                currentPercent = Math.floor(clamp(heatingProgressFraction, 0, 1.0) * maxHeatingPercent);
            } else {
                const coolingProgressFraction = totalCoolingTime > 0 ? clamp(coolingTimeElapsed * invTotalCoolingTime, 0, 1.0) : 1.0;
                currentPercent = Math.floor(maxHeatingPercent + (coolingProgressFraction * coolingWeightRange));
            }
            const nowMs = performance.now();
            if ((currentPercent > lastReportedPercent && (nowMs - lastReportTimeMs >= UI_PROGRESS_THROTTLE_MS)) || currentPercent === 100) {
                const accuracyMetrics = cfg.shouldCalculateAccuracyError
                    ? buildAccuracyMetrics(cfg.mode, maxLinearResidual, maxPicardConvergenceErrorC, maxTimeErrorC, maxGridErrorC)
                    : null;
                const shouldAbort = onProgress(currentPercent, {
                    calculationTimeMs: nowMs - calculationStart,
                    cpuWorkloadUnits: totalCpuUnits,
                    accuracy: accuracyMetrics,
                    iterations: {
                        totalTimeSteps: countTimeSteps,
                        rejectedTimeSteps: countRejectedSteps,
                        totalGridPointsProcessed: totalCpuUnits,
                        totalPicardIterations
                    }
                });
                if (shouldAbort === true) {
                    status = { type: "abort", message: `Abort: outer load limit at ${currentPercent}% (${currentPhase})` };
                    if (cfg.shouldCalculateAccuracyError) {
                        const lastPicardDeltaK = Math.abs(lastIterMaxSignedDiff);
                        if (lastPicardDeltaK > maxPicardConvergenceErrorC) maxPicardConvergenceErrorC = lastPicardDeltaK;
                    }
                    break;
                }
                lastReportedPercent = currentPercent;
                lastReportTimeMs = nowMs;
            }
        }
// --- Переключение фазы или завершение ---
        if (forceStop && currentPhase === "heating") {
            if (totalCoolingTime > 0) {
                reachedTarget = true;
                switchToCoolingPhase();
                continue;
            }
            break;
        }
// --- PI-регулятор следующего шага времени dt ---
        const maxStepTempChange = Math.max(
            Math.abs(buffers[newIdx][idxTop] - buffers[curIdx][idxTop]),
            Math.abs(buffers[newIdx][idxMid] - buffers[curIdx][idxMid]),
            Math.abs(buffers[newIdx][idxBot] - buffers[curIdx][idxBot])
        );
        const dtTemperature = maxStepTempChange > 1e-6
            ? dt * DT_SAFETY_FACTOR * (cfg.targetDeltaT / maxStepTempChange)
            : dt * DT_MAX_GROWTH_FACTOR;
        const targetTimeTol = Math.max(cfg.nonlinearToleranceK, cfg.targetDeltaT * 0.2);
        const dtAccuracy = (currentStepTimeErr > 1e-6)
            ? dt * DT_SAFETY_FACTOR * Math.sqrt(targetTimeTol / currentStepTimeErr)
            : dt * DT_MAX_GROWTH_FACTOR;
        let dtPhysical = Infinity;
        if (currentPhase === "heating") {
            const p1 = mach.heaters[0].pid?.periodSeconds || Infinity;
            const p2 = mach.heaters[1].pid?.periodSeconds || Infinity;
            const minPeriod = Math.min(p1, p2);
            if (Number.isFinite(minPeriod) && minPeriod > 0) {
                dtPhysical = Math.min(dtPhysical, minPeriod / 8.0);
            }

            if (maxStepTempChange > 1e-6) {
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
        }
        const maxGrowthAllowed = residualOut.value > 1e-11 ? 1.0 : DT_MAX_GROWTH_FACTOR;
        const rawNextDt = Math.min(dtTemperature, dtAccuracy, dtPhysical);
        dt = clamp(rawNextDt, dt * DT_MIN_SUCCESS_SHRINK, dt * maxGrowthAllowed);
        step++;
        currentStepCpuUnits = 0;
    }
// --- 7.6. Формирование итоговых температурных профилей и отчета ---
    const finalCurIdx = step % 3;
    if (!heatingProfileC) {
        heatingProfileC = new Float64Array(size2D);
        for (let i = 0; i < size2D; i++) {
            heatingProfileC[i] = buffers[finalCurIdx][i] - 273.15;
        }
    }
    const pauseProfileC = new Float64Array(size2D);
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
            status
        });
    }
    const accuracyMetrics = cfg.shouldCalculateAccuracyError
        ? buildAccuracyMetrics(cfg.mode, maxLinearResidual, maxPicardConvergenceErrorC, maxTimeErrorC, maxGridErrorC)
        : null;
    return {
        heatingTimeSeconds: time,
        coolingTimeSeconds: coolingTimeElapsed,
        reachedTarget,
        status: status || { type: "ok" },
        ...(storeHistory && { history }),
        temperatureProfile: {
            xCoordinatesMm: Array.from(gridX.x),
            yCoordinatesMm: Array.from(gridY.y),
            Nx,
            Ny,
            heating: heatingProfileC,
            pause: pauseProfileC
        },
        technicalMetrics: {
            calculationTimeMs: performance.now() - calculationStart,
            cpuWorkloadUnits: totalCpuUnits,
            accuracy: accuracyMetrics,
            iterations: {
                totalTimeSteps: countTimeSteps,
                rejectedTimeSteps: countRejectedSteps,
                totalPicardIterations,
                totalGridPointsProcessed: totalCpuUnits
            }
        }
    };
}