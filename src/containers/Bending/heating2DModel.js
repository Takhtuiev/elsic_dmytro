/**
 * Optimized 2D transient FULLY IMPLICIT finite-difference heating and cooling model for opaque plastics (PVC).
 * Features dynamic spatial grid generation concentrated around intense physical gradient zones (5-8 mm).
 * Includes seamless fallback to efficient 1D calculation mode when width is 0.
 *
 * COMPACT VERSION: Eliminates grid redundancy. Coordinates are stored once under 'temperatureProfile',
 * while thermal fields are split into 'heating' (after oven) and 'pause' (after transfer cooling).
 */

/* ========================================================
 * ГЛОБАЛЬНЫЙ БЛОК НАСТРОЕК ТОЧНОСТИ (ОБЪЕКТНАЯ СТРУКТУРА ПРЕСЕТОВ)
 * ======================================================== */

/**
 * ВЫБОР РЕЖИМА ТОЧНОСТИ
 * "fast"      — Быстрый (крупная сетка, мгновенный черновик)
 * "optimal"   — Оптимальный (ВАШИ ПЕРВЫЕ ИСХОДНЫЕ ПАРАМЕТРЫ НА 100%)
 * "accurate"  — Точный (плотная сетка для детального анализа)
 */
export const ACCURACY_MODE = "fast";

/**
 * ФЛАГ ОЦЕНКИ ПОГРЕШНОСТИ (Вкл/Выкл анализа неточности)
 * true  — собирает полную ошибку (Пикар + dt + сетка), тратит чуть больше ресурсов.
 * false — полностью отключает трекинг ошибок, работает с максимальной скоростью.
 */
export const CALCULATE_ACCURACY_ERROR = true;

/* ========================================================
 * МАТРИЦА НАСТРОЕК ТОЧНОСТИ (ОБЪЕКТНАЯ СТРУКТУРА ПРЕСЕТОВ)
 * ======================================================== */
const LIMITS = {
    gridX: { fast: 0.35, optimal: 0.2, accurate: 0.12 },
    gridY: { fast: 1.30, optimal: 0.8, accurate: 0.45 },
    minGrid: { fast: 0.06, optimal: 0.05, accurate: 0.02 },
    maxIter: { fast: 4,    optimal: 6,    accurate: 12 },

    // Критерий остановки итераций Пикара (невязка в Кельвинах)
    tolerance: { fast: 0.25, optimal: 0.05, accurate: 0.01 },

    // Жесткий верхний потолок адаптивного шага времени в секундах
    maxDt: { fast: 2.5,  optimal: 1.5,  accurate: 0.6 },

    // Целевой перепад температуры за одну временную итерацию (К)
    targetDt: { fast: 2.0,  optimal: 0.8,  accurate: 0.4 },

    // Коэффициент ускорения шага времени при хорошей сходимости (рост dt)
    growthFactor: { fast: 1.30, optimal: 1.10, accurate: 1.05 },

    shrinkFactor: { fast: 0.50, optimal: 0.60, accurate: 0.75 }
};

export const DEFAULT_DT_SECONDS = 0.1;

/* ========================================================
 * ГЕОМЕТРИЯ И ФИЗИКА СТЕНДА
 * ======================================================== */
export const SIGMA = 5.670374419e-8;
export const HEATER_RADIUS_MM = 3.0;
export const DISTANCE_TO_SHEET_MM = 8.0;
const EFFECTIVE_H_MM = DISTANCE_TO_SHEET_MM + HEATER_RADIUS_MM;

const AMBIENT_CONVECTION_H_TOP = 8.0;
const AMBIENT_CONVECTION_H_BOT = 7.0;

const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
const toKelvin = c => c + 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;

function getExcessEnthalpy(t, tg, jumpFactor, width, baseCp) {
    const halfWidth = width / 2;
    const tStart = tg - halfWidth;
    const tEnd = tg + halfWidth;
    const deltaCpMax = baseCp * (jumpFactor - 1.0);

    if (t <= tStart) return 0.0;
    if (t >= tEnd) {
        return deltaCpMax * (t - (tStart + tEnd) / 2.0);
    }
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
export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object") return null;
    if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) return null;
    return {
        ...machine,
        heaters: [
            { ...machine.heaters[0] },
            { ...machine.heaters[0], ...machine.heaters[1] }
        ]
    };
}

export function validateSimulationParams({ thicknessMm, material, machine, simulation, dtSeconds }) {
    if (!validPositive(thicknessMm)) return { isValid: false, error: "Invalid thickness." };
    if (!material || typeof material !== "object") return { isValid: false, error: "Invalid material model." };
    if (!machine || typeof machine !== "object") return { isValid: false, error: "Invalid machine." };
    if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) {
        return { isValid: false, error: "Exactly two heaters are required." };
    }
    if (!simulation || typeof simulation !== "object") return { isValid: false, error: "Simulation parameters are missing." };

    const finalDt = dtSeconds === undefined ? DEFAULT_DT_SECONDS : dtSeconds;
    return { isValid: true, dtSeconds: finalDt };
}

function createNonlinearGridX(thicknessMm, nodeCount, minGridStepMm) {
    const x = new Float64Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
        const fraction = i / (nodeCount - 1);
        x[i] = thicknessMm * 0.5 * (1.0 - Math.cos(fraction * Math.PI));
    }

    const dx = new Float64Array(nodeCount - 1);
    const dxHat = new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount - 1; i++) {
        const diff = x[i + 1] - x[i];
        // 👇 Заменили старую константу на переданный аргумент
        dx[i] = diff < minGridStepMm ? minGridStepMm : diff;
    }

    dxHat[0] = 0.5 * dx[0];
    for (let i = 1; i < nodeCount - 1; i++) {
        dxHat[i] = 0.5 * (dx[i - 1] + dx[i]);
    }
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
// 👇 Добавили пятый аргумент minGridStepMm
function createParametricGridY(widthHalfMm, nodeCount, slotHalfWidthMm, convectionTransitionEndMm, minGridStepMm) {
    const y = new Float64Array(nodeCount);
    const yCenter = (slotHalfWidthMm + convectionTransitionEndMm) / 2.0;
    const yChangePrincipleMm = slotHalfWidthMm + 3.0;

    function getWeightDensity(posMm) {
        let weight = 1.0;
        weight += 2.0 * Math.exp(-Math.pow(posMm / 3.0, 2));
        const zoneWidth = (convectionTransitionEndMm - slotHalfWidthMm) * 0.5 || 1.5;
        weight += 8.0 * Math.exp(-Math.pow((posMm - yCenter) / zoneWidth, 2));
        return weight;
    }

    const intervals = nodeCount * 20;
    const stepInt = widthHalfMm / intervals;

    let totalWeightIntegral = 0;
    for (let i = 0; i < intervals; i++) {
        totalWeightIntegral += getWeightDensity(i * stepInt) * stepInt;
    }

    let currentWeightPos = 0.0;
    const targetWeightPerNode = totalWeightIntegral / (nodeCount - 1);
    let currentMm = 0.0;
    const searchStep = stepInt / 4.0;

    y[0] = 0.0;
    for (let j = 1; j < nodeCount - 1; j++) {
        const neededWeight = j * targetWeightPerNode;
        while (currentWeightPos < neededWeight && currentMm < widthHalfMm) {
            currentWeightPos += getWeightDensity(currentMm) * searchStep;
            currentMm += searchStep;
        }
        y[j] = currentMm;
    }
    y[nodeCount - 1] = widthHalfMm;

    y.sort();

    let changeIndex = 0;
    for (let j = 0; j < nodeCount; j++) {
        if (y[j] >= yChangePrincipleMm) {
            changeIndex = j;
            break;
        }
    }

    if (changeIndex > 0 && changeIndex < nodeCount - 2) {
        let baseDy = y[changeIndex] - y[changeIndex - 1];
        // 👇 Заменили MIN_GRID_STEP_MM на аргумент minGridStepMm
        if (baseDy < minGridStepMm) baseDy = minGridStepMm;

        const q = 1.12;
        let currentDy = baseDy;
        for (let j = changeIndex; j < nodeCount - 1; j++) {
            currentDy *= q;
            // 👇 Заменили MIN_GRID_STEP_MM на аргумент minGridStepMm
            if (currentDy < minGridStepMm) currentDy = minGridStepMm;
            y[j + 1] = y[j] + currentDy;
        }

        if (Math.abs(y[nodeCount - 1] - widthHalfMm) > 1e-5) {
            const yStartZone = y[changeIndex];
            const oldLength = y[nodeCount - 1] - yStartZone;
            const newLength = widthHalfMm - yStartZone;

            if (oldLength > 1e-7 && newLength > 0) {
                const scale = newLength / oldLength;
                for (let j = changeIndex + 1; j < nodeCount; j++) {
                    y[j] = yStartZone + (y[j] - yStartZone) * scale;
                }
            }
        }
    }

    for (let j = 1; j < nodeCount; j++) {
        if (y[j] <= y[j - 1] + 1e-6) {
            // 👇 Заменили MIN_GRID_STEP_MM на аргумент minGridStepMm
            y[j] = y[j - 1] + minGridStepMm;
        }
    }
    y[nodeCount - 1] = widthHalfMm;

    const dy = new Float64Array(nodeCount - 1);
    const dyHat = new Float64Array(nodeCount);

    for (let j = 0; j < nodeCount - 1; j++) {
        dy[j] = y[j + 1] - y[j];
    }

    dyHat[0] = 0.5 * dy[0];
    for (let j = 1; j < nodeCount - 1; j++) {
        dyHat[j] = 0.5 * (dy[j - 1] + dy[j]);
    }
    dyHat[nodeCount - 1] = 0.5 * dy[nodeCount - 2];

    const invDyH = new Float64Array(nodeCount);
    const invDyL = new Float64Array(nodeCount);
    const invDyR = new Float64Array(nodeCount);
    for (let j = 0; j < nodeCount; j++) {
        invDyH[j] = 1000.0 / (dyHat[j] || 0.001);
        if (j > 0) invDyL[j] = 1000.0 / (dy[j - 1] || 0.001);
        if (j < nodeCount - 1) invDyR[j] = 1000.0 / (dy[j] || 0.001);
    }

    return { y, dy, dyHat, invDyH, invDyL, invDyR, nodeCount };
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
    const abRowStride = bandWidth + bandWidth + 1;
    const lead = bandWidth;

    const iMinArr = precalc.iMin;
    const iMaxArr = precalc.iMax;
    const kMinJArr = precalc.kMinJ;
    const kMinIArr = precalc.kMinI;
    const jMinArr = precalc.jMin;
    const jMaxArr = precalc.jMax;

    for (let j = 0; j < N; j++) {
        const iMin = iMinArr[j];
        const iMax = iMaxArr[j];
        const kMinJ = kMinJArr[j];

        for (let i = iMin; i <= j; i++) {
            const iStride = i * abRowStride;
            let sum = A[iStride + (lead + j - i)];
            const kMinI = kMinIArr[i];

            let k = kMinI < kMinJ ? kMinJ : kMinI;
            for (; k < i - 3; k += 4) {
                sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
                sum -= A[iStride + (lead + k + 1 - i)] * A[(k + 1) * abRowStride + (lead + j - (k + 1))];
                sum -= A[iStride + (lead + k + 2 - i)] * A[(k + 2) * abRowStride + (lead + j - (k + 2))];
                sum -= A[iStride + (lead + k + 3 - i)] * A[(k + 3) * abRowStride + (lead + j - (k + 3))];
            }
            for (; k < i; k++) {
                sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
            }
            A[iStride + (lead + j - i)] = sum;
        }

        for (let i = j + 1; i <= iMax; i++) {
            const iStride = i * abRowStride;
            let sum = A[iStride + (lead + j - i)];
            const kMinI = kMinIArr[i];

            let k = kMinI < kMinJ ? kMinJ : kMinI;
            for (; k < j - 3; k += 4) {
                sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
                sum -= A[iStride + (lead + k + 1 - i)] * A[(k + 1) * abRowStride + (lead + j - (k + 1))];
                sum -= A[iStride + (lead + k + 2 - i)] * A[(k + 2) * abRowStride + (lead + j - (k + 2))];
                sum -= A[iStride + (lead + k + 3 - i)] * A[(k + 3) * abRowStride + (lead + j - (k + 3))];
            }
            for (; k < j; k++) {
                sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
            }
            A[iStride + (lead + j - i)] = sum / A[j * abRowStride + lead];
        }
    }

    for (let i = 0; i < N; i++) {
        let sum = r[i];
        const jMin = jMinArr[i];
        const iStride = i * abRowStride;

        let j = jMin;
        for (; j < i - 3; j += 4) {
            sum -= A[iStride + (lead + j - i)] * x[j];
            sum -= A[iStride + (lead + j + 1 - i)] * x[j + 1];
            sum -= A[iStride + (lead + j + 2 - i)] * x[j + 2];
            sum -= A[iStride + (lead + j + 3 - i)] * x[j + 3];
        }
        for (; j < i; j++) {
            sum -= A[iStride + (lead + j - i)] * x[j];
        }
        x[i] = sum;
    }

    for (let i = N - 1; i >= 0; i--) {
        let sum = x[i];
        const jMax = jMaxArr[i];
        const iStride = i * abRowStride;

        let j = i + 1;
        for (; j <= jMax - 3; j += 4) {
            sum -= A[iStride + (lead + j - i)] * x[j];
            sum -= A[iStride + (lead + j + 1 - i)] * x[j + 1];
            sum -= A[iStride + (lead + j + 2 - i)] * x[j + 2];
            sum -= A[iStride + (lead + j + 3 - i)] * x[j + 3];
        }
        for (; j <= jMax; j++) {
            sum -= A[iStride + (lead + j - i)] * x[j];
        }
        x[i] = sum / A[iStride + lead];
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

export function simulate2DHeating({ thicknessMm, material, machine, simulation, dtSeconds, storeHistory = false, onProgress }) {
    const calculationStart = performance.now();
    const mach = normalizeMachine(machine);
    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({ thicknessMm, material, machine: mach, simulation, dtSeconds });
    if (!validation.isValid) return makeError(validation.error);

    // 👇 ДОБАВИТЬ ЭТОТ БЛОК ДИНАМИЧЕСКОГО РАСЧЕТА ПАРАМЕТРОВ ЯДРА
    const userMode = simulation.accuracyMode;
    const mode = ["fast", "optimal", "accurate"].includes(userMode) ? userMode : "optimal";

    const GRID_X_STEP_MM = LIMITS.gridX[mode];
    const GRID_Y_STEP_MM = LIMITS.gridY[mode];
    const MIN_GRID_STEP_MM = LIMITS.minGrid[mode];
    const MAX_NONLINEAR_ITERATIONS = LIMITS.maxIter[mode];
    const NONLINEAR_TOLERANCE_K = LIMITS.tolerance[mode];
    const ADAPTIVE_MAX_DT = LIMITS.maxDt[mode];
    const TARGET_DELTA_T = LIMITS.targetDt[mode];
    const ADAPTIVE_GROWTH_FACTOR = LIMITS.growthFactor[mode];
    const ADAPTIVE_SHRINK_FACTOR = LIMITS.shrinkFactor[mode];

    const is1D = simulation.widthHalfMm === 0;

    const slotHalfWidthMm = simulation.slotHalfWidthMm !== undefined ? simulation.slotHalfWidthMm : 5.0;
    const convectionTransitionEndMm = simulation.convectionTransitionEndMm !== undefined ? simulation.convectionTransitionEndMm : 8.0;

    const isAdaptive = dtSeconds === undefined;
    let dt = validation.dtSeconds;

    const Nx = Math.max(5, Math.round(thicknessMm / GRID_X_STEP_MM)) + 1;
    const Ny = is1D ? 1 : (Math.max(12, Math.round(simulation.widthHalfMm / GRID_Y_STEP_MM)) + 1);

    const lastX = Nx - 1;
    const lastY = Ny - 1;

    const gridX = createNonlinearGridX(thicknessMm, Nx, MIN_GRID_STEP_MM);
    const gridY = is1D
        ? { y: new Float64Array([0.0]), dy: new Float64Array([0.0]), dyHat: new Float64Array([0.0]), invDyH: new Float64Array([1000.0/0.001]), invDyL: new Float64Array([0.0]), invDyR: new Float64Array([0.0]), nodeCount: 1 }
        : createParametricGridY(simulation.widthHalfMm, Ny, slotHalfWidthMm, convectionTransitionEndMm, MIN_GRID_STEP_MM);


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

    const size2D = Nx * Ny;
    let T = new Float64Array(size2D).fill(initT + 273.15);
    let oldT = new Float64Array(size2D).fill(initT + 273.15);
    let currentIterT = new Float64Array(size2D);

// Память скоростей для двух главных точек: верх (0) и низ (lastX * Ny)
    let prevTopRate = 0.0;
    let prevBotRate = 0.0;

    const bandWidth = Ny;
    const abRowStride = bandWidth + bandWidth + 1;
    const lead = bandWidth;

    const matrixA = new Float64Array(size2D * abRowStride);
    const matrixAClone = new Float64Array(size2D * abRowStride);
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
        const cTop = getLocalConvection(yMm, T_top_K, ambientTemperatureK, hTop, slotHalfWidthMm, convectionTransitionEndMm, AMBIENT_CONVECTION_H_TOP);
        precalcConvTopH[j] = cTop.h;
        precalcConvTopAir[j] = cTop.airTemperatureK;

        const cBot = getLocalConvection(yMm, T_bot_K, ambientTemperatureK, hBot, slotHalfWidthMm, convectionTransitionEndMm, AMBIENT_CONVECTION_H_BOT);
        precalcConvBotH[j] = cBot.h;
        precalcConvBotAir[j] = cBot.airTemperatureK;
    }

    let time = 0;
    const simulationMaxTime = targetType === "time" ? (maxTimeSeconds < targetValue ? maxTimeSeconds : targetValue) : maxTimeSeconds;
    let history = storeHistory ? { time: [], frontSurfaceC: [], centerC: [], backSurfaceC: [] } : null;

    let lastLoggedTime = -1;
    const logHistory = (force = false) => {
        if (!storeHistory) return;
        if (history.time.length > 0 && history.time[history.time.length - 1] === time) return;
        if (!force && (time - lastLoggedTime < 1.0) && time < simulationMaxTime) return;

        history.time.push(time);
        history.frontSurfaceC.push(T[0] - 273.15);
        history.centerC.push(T[((Nx - 1) >> 1) * Ny] - 273.15);
        history.backSurfaceC.push(T[lastX * Ny] - 273.15);
        lastLoggedTime = time;
    };

    logHistory(true);

    let status = null;
    let forceStop = false;

    const invDxH = gridX.invDxH;
    const invDxL = gridX.invDxL;
    const invDxR = gridX.invDxR;
    const invDyH = gridY.invDyH;
    const invDyL = gridY.invDyL;
    const invDyR = gridY.invDyR;

    let lastReportedPercent = -1;
    const totalCoolingTime = simulation.cooling?.timeSeconds || 0;

    // --- ПЕРЕМЕННЫЕ ДЛЯ АНАЛИЗА ПОГРЕШНОСТЕЙ ---
    let accumulatedSolverError = 0.0;
    let accumulatedTimeErrorSum = 0.0;

    // ========================================================
    // ФАЗА 1: ИНТЕНСИВНЫЙ НАГРЕВ
    // ========================================================
    while (time < simulationMaxTime && !forceStop) {
        if (targetType === "time" && time + dt > targetValue) {
            dt = targetValue - time;
        } else if (time + dt > simulationMaxTime) {
            dt = simulationMaxTime - time;
        }
        if (dt < 1e-5) break;

        oldT.set(T);
        currentIterT.set(T);
        let nonlinearConverged = false;
        let lastIterMaxSignedDiff = 0.0;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const idxInvDxH = invDxH[i];

                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = currentIterT[idxRow];
                    const oldTempC = oldT[idxRow] - 273.15;

                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const kEff = props.k;

                    rhsVec[idxRow] = oldT[idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;

                    const matRowOffset = idxRow * abRowStride + lead;
                    const dtkEff = dt * kEff;

                    if (i > 0 && i < lastX) {
                        const coeffLeft = dtkEff * idxInvDxH * invDxL[i];
                        const coeffRight = dtkEff * idxInvDxH * invDxR[i];
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else if (i === 0) {
                        const coeffRight = dtkEff * idxInvDxH * invDxR[i];
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += coeffRight;

                        const fH = viewFactorsY[j];
                        const radATop = radFactorTopBase * fH;

                        const currentTempK_2 = currentTempK * currentTempK;
                        const currentTempK_3 = currentTempK_2 * currentTempK;
                        const currentTempK_4 = currentTempK_2 * currentTempK_2;

                        const q_conv = precalcConvTopH[j] * (precalcConvTopAir[j] - currentTempK);
                        const dq_conv = -precalcConvTopH[j];
                        const q_rad = radATop * (T_top_K_4 - currentTempK_4);
                        const dq_rad = -4 * radATop * currentTempK_3;

                        centerCoeff -= (dt * idxInvDxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (dt * idxInvDxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    } else if (i === lastX) {
                        const coeffLeft = dtkEff * idxInvDxH * invDxL[i];
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        centerCoeff += coeffLeft;

                        const fH = viewFactorsY[j];
                        const radABot = radFactorBotBase * fH;

                        const currentTempK_2 = currentTempK * currentTempK;
                        const currentTempK_3 = currentTempK_2 * currentTempK;
                        const currentTempK_4 = currentTempK_2 * currentTempK_2;

                        const q_conv = precalcConvBotH[j] * (precalcConvBotAir[j] - currentTempK);
                        const dq_conv = -precalcConvBotH[j];
                        const q_rad = radABot * (T_bot_K_4 - currentTempK_4);
                        const dq_rad = -4 * radABot * currentTempK_3;

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

                            const T_edge_old = oldT[idxRow];
                            const T_virtual_extrapolated = T_edge_old - (oldT[idxRow - 1] - T_edge_old);
                            const T_target = T_virtual_extrapolated < ambientTemperatureK ? ambientTemperatureK : T_virtual_extrapolated;

                            rhsVec[idxRow] += coeffRightY * (T_target - T_edge_old);
                        }
                    }

                    matrixA[matRowOffset] = centerCoeff;
                }
            }

            matrixAClone.set(matrixA);
            solveBandMatrixOptimized(matrixAClone, size2D, bandWidth, rhsVec, solverX, precalc);

            let maxDeltaK = 0;
            let localMaxSignedDiff = 0.0;

            for (let k = 0; k < size2D; k++) {
                const diffSigned = solverX[k] - currentIterT[k];
                const diffAbs = Math.abs(diffSigned);
                if (diffAbs > maxDeltaK) {
                    maxDeltaK = diffAbs;
                    localMaxSignedDiff = diffSigned;
                }
            }

            currentIterT.set(solverX);
            lastIterMaxSignedDiff = localMaxSignedDiff;

            if (maxDeltaK < NONLINEAR_TOLERANCE_K) {
                nonlinearConverged = true;
                break;
            }
        }

        if (isAdaptive && !nonlinearConverged) {
            dt *= ADAPTIVE_SHRINK_FACTOR;
            if (dt < 1e-5) {
                status = { type: "error", message: "Degradation! Temperature limits reached with minimum allowable time step." };
                break;
            }
            T.set(oldT);
            continue;
        }

        let overHeated = false;
        let maxObservedT = 0;
        for (let i = 0; i < size2D; i++) {
            if (currentIterT[i] > maxObservedT) maxObservedT = currentIterT[i];
            if (currentIterT[i] >= decompTempK) overHeated = true;
        }

        if (overHeated) {
            let maxOldT = 0;
            for (let i = 0; i < size2D; i++) {
                if (oldT[i] > maxOldT) maxOldT = oldT[i];
            }
            if (maxObservedT - maxOldT > 0.02 && maxOldT < decompTempK) {
                const fraction = (decompTempK - maxOldT) / (maxObservedT - maxOldT);
                const nextDt = dt * clamp(fraction, 0.05, 0.95);

                if (nextDt >= 1e-5) {
                    dt = nextDt;
                    T.set(oldT);
                    continue;
                }
            }
            status = { type: "error", message: `Degradation! Temperature > ${material.decompositionTemp}°C.` };
            if (stopAtMaxTemperature) {
                T.set(currentIterT);
                time += dt;
                logHistory(true);
                break;
            }
        }

        if (targetK != null && targetType !== "time" && isTargetReached2D(currentIterT, Nx, Ny, target, targetK)) {
            let criticalNodeIdx = 0;
            if (targetType === "minTemperature") {
                let minVal = Infinity;
                for (let i = 0; i < Nx; i++) {
                    if (currentIterT[i * Ny] < minVal) {
                        minVal = currentIterT[i * Ny];
                        criticalNodeIdx = i * Ny;
                    }
                }
            } else if (targetType === "surfaceTemperature") {
                criticalNodeIdx = currentIterT[0] >= targetK ? 0 : (lastX * Ny);
            }

            const oldNodeT = oldT[criticalNodeIdx];
            const newNodeT = currentIterT[criticalNodeIdx];

            if (newNodeT - oldNodeT > 0.02 && oldNodeT < targetK) {
                const fraction = (targetK - oldNodeT) / (newNodeT - oldNodeT);
                const nextDt = dt * clamp(fraction, 0.05, 0.95);
                if (nextDt >= 1e-5) {
                    dt = nextDt;
                    T.set(oldT);
                    continue;
                }
            }
            forceStop = true;
        }

        if (forceStop) break;

        const currentThermalState = { v: initT + 273.15 };
        if (targetK != null && (targetType === "minTemperature" || targetType === "surfaceTemperature")) {
            isTargetReached2D(currentIterT, Nx, Ny, target, targetK, currentThermalState);
        }

        if (onProgress) {
            let heatingProgressFraction = 0;

            if (targetType === "minTemperature" || targetType === "surfaceTemperature") {
                const currentC = currentThermalState.v - 273.15;
                const totalRange = targetValue - initT;
                if (totalRange > 0) {
                    heatingProgressFraction = (currentC - initT) / totalRange;
                }
            } else if (targetType === "time") {
                if (targetValue > 0) {
                    heatingProgressFraction = time / targetValue;
                }
            }

            heatingProgressFraction = Math.max(0, Math.min(1.0, heatingProgressFraction));

            const maxHeatingPercent = simulation.maxHeatingPercent ?? (totalCoolingTime > 0 ? 95 : 99);
            let currentPercent = Math.floor(heatingProgressFraction * maxHeatingPercent);

            if (currentPercent > lastReportedPercent && currentPercent <= maxHeatingPercent) {
                onProgress(currentPercent);
                lastReportedPercent = currentPercent;
            }
        }

        let maxStepTempChange = 0;
        for (let k = 0; k < size2D; k++) {
            const stepChange = Math.abs(currentIterT[k] - T[k]);
            if (stepChange > maxStepTempChange) maxStepTempChange = stepChange;
        }

// --- СТРОГИЙ ДВУХТОЧЕЧНЫЙ АНАЛИЗ ОШИБКИ ВРЕМЕНИ (ВЕРХ И НИЗ) ---
        if (CALCULATE_ACCURACY_ERROR && nonlinearConverged) {
            accumulatedSolverError += lastIterMaxSignedDiff;

            const idxBot = lastX * Ny; // Индекс нижнего центрального узла

            // Вычисляем текущие скорости нагрева (градусы в секунду)
            const currentTopRate = (currentIterT[0] - T[0]) / dt;
            const currentBotRate = (currentIterT[idxBot] - T[idxBot]) / dt;

            // Вычисляем ускорения процесса (изменение скорости)
            const accelTop = Math.abs(currentTopRate - prevTopRate);
            const accelBot = Math.abs(currentBotRate - prevBotRate);

            // Считаем ошибку для каждой точки по формуле (dt^2 / 2) * acceleration
            const errorTop = (dt * dt * 0.5) * accelTop;
            const errorBot = (dt * dt * 0.5) * accelBot;

            // Выбираем худший вариант
            const maxLocalTimeError = errorTop > errorBot ? errorTop : errorBot;
            accumulatedTimeErrorSum += maxLocalTimeError;

            // Сохраняем скорости для следующего временного шага
            prevTopRate = currentTopRate;
            prevBotRate = currentBotRate;
        }

        T.set(currentIterT);


        time += dt;
        logHistory(false);

        if (isAdaptive) {
            if (maxStepTempChange > 0) {
                const stepRatio = TARGET_DELTA_T / maxStepTempChange;
                if (stepRatio > 1.0) {
                    dt *= Math.min(ADAPTIVE_GROWTH_FACTOR, stepRatio);
                    if (dt > ADAPTIVE_MAX_DT) dt = ADAPTIVE_MAX_DT;
                } else {
                    dt *= Math.max(ADAPTIVE_SHRINK_FACTOR, stepRatio);
                }
            } else {
                dt = ADAPTIVE_MAX_DT;
            }
        }
    }

    logHistory(true);

    const heatingProfileC = new Float64Array(size2D);
    for (let i = 0; i < size2D; i++) {
        heatingProfileC[i] = T[i] - 273.15;
    }
    const reachedTarget = targetType === "time" ? time >= targetValue : (targetK == null ? false : isTargetReached2D(T, Nx, Ny, target, targetK));

    // ========================================================
    // ФАЗА 2: ПАУЗА (ОСТЫВАНИЕ С АДАПТИВНЫМ ШАГОМ)
    // ========================================================
    const coolingTime = simulation.cooling?.timeSeconds || 0;
    const hCooling = simulation.cooling?.convectiveHeatTransferCoefficient || 8.0;
    const radFactorAmbient = epsS * SIGMA;

    let coolingTimeElapsed = 0;
    let coolingDt = dtSeconds === undefined ? DEFAULT_DT_SECONDS : dtSeconds;
    let lastCoolingLoggedTime = -1.0;

    const logCoolingHistory = (force = false) => {
        if (!storeHistory) return;
        const currentAbsoluteTime = time + coolingTimeElapsed;

        if (history.time.length > 0 && history.time[history.time.length - 1] === currentAbsoluteTime) return;
        if (!force && (coolingTimeElapsed - lastCoolingLoggedTime < 1.0) && coolingTimeElapsed < coolingTime) return;

        history.time.push(currentAbsoluteTime);
        history.frontSurfaceC.push(T[0] - 273.15);
        history.centerC.push(T[((Nx - 1) >> 1) * Ny] - 273.15);
        history.backSurfaceC.push(T[lastX * Ny] - 273.15);
        lastCoolingLoggedTime = coolingTimeElapsed;
    };

    logCoolingHistory(true);

    while (coolingTimeElapsed < coolingTime) {
        if (coolingTimeElapsed + coolingDt > coolingTime) {
            coolingDt = coolingTime - coolingTimeElapsed;
        }
        if (coolingDt < 1e-5) break;

        oldT.set(T);
        currentIterT.set(T);
        let coolingConverged = false;
        let coolingLastIterMaxSignedDiff = 0.0;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const idxInvDxH = invDxH[i];

                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = currentIterT[idxRow];
                    const oldTempC = oldT[idxRow] - 273.15;

                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const kEff = props.k;

                    rhsVec[idxRow] = oldT[idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;
                    const matRowOffset = idxRow * abRowStride + lead;
                    const coolingDtkEff = coolingDt * kEff;

                    if (i > 0 && i < lastX) {
                        const coeffLeft = coolingDtkEff * idxInvDxH * invDxL[i];
                        const coeffRight = coolingDtkEff * idxInvDxH * invDxR[i];
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else if (i === 0 || i === lastX) {
                        const coeffNext = i === 0 ? (coolingDtkEff * idxInvDxH * invDxR[i]) : (coolingDtkEff * idxInvDxH * invDxL[i]);
                        matrixA[matRowOffset + (i === 0 ? Ny : -Ny)] = -coeffNext;
                        centerCoeff += coeffNext;

                        const currentTempK_2 = currentTempK * currentTempK;
                        const currentTempK_3 = currentTempK_2 * currentTempK;
                        const currentTempK_4 = currentTempK_2 * currentTempK_2;

                        const q_conv = hCooling * (ambientTemperatureK - currentTempK);
                        const dq_conv = -hCooling;
                        const q_rad = radFactorAmbient * (ambientTemperatureK_4 - currentTempK_4);
                        const dq_rad = -4 * radFactorAmbient * currentTempK_3;

                        centerCoeff -= (coolingDt * idxInvDxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (coolingDt * idxInvDxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    }

                    if (!is1D) {
                        const idxInvDyH = invDyH[j];
                        if (j > 0 && j < lastY) {
                            const coeffLeftY = coolingDtkEff * idxInvDyH * invDyL[j];
                            const coeffRightY = coolingDtkEff * idxInvDyH * invDyR[j];
                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            matrixA[matRowOffset + 1] = -coeffRightY;
                            centerCoeff += (coeffLeftY + coeffRightY);
                        } else if (j === 0) {
                            const coeffRightY = coolingDtkEff * idxInvDyH * invDyR[j];
                            matrixA[matRowOffset + 1] = -2 * coeffRightY;
                            centerCoeff += 2 * coeffRightY;
                        } else if (j === lastY) {
                            const coeffLeftY = coolingDtkEff * idxInvDyH * invDyL[j];
                            const coeffRightY = coolingDtkEff * idxInvDyH * invDyL[j];

                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            centerCoeff += coeffLeftY;
                            matrixA[matRowOffset] = centerCoeff;

                            const T_edge_old = oldT[idxRow];
                            const T_virtual_extrapolated = T_edge_old - (oldT[idxRow - 1] - T_edge_old);
                            const T_target = T_virtual_extrapolated < ambientTemperatureK ? ambientTemperatureK : T_virtual_extrapolated;

                            rhsVec[idxRow] += coeffRightY * (T_target - T_edge_old);
                        }
                    }
                    matrixA[matRowOffset] = centerCoeff;
                }
            }
            matrixAClone.set(matrixA);
            solveBandMatrixOptimized(matrixAClone, size2D, bandWidth, rhsVec, solverX, precalc);

            let maxCoolingDeltaK = 0;
            let coolingLocalMaxSignedDiff = 0.0;

            for (let k = 0; k < size2D; k++) {
                const diffSigned = solverX[k] - currentIterT[k];
                const diffAbs = Math.abs(diffSigned);
                if (diffAbs > maxCoolingDeltaK) {
                    maxCoolingDeltaK = diffAbs;
                    coolingLocalMaxSignedDiff = diffSigned;
                }
            }

            currentIterT.set(solverX);
            coolingLastIterMaxSignedDiff = coolingLocalMaxSignedDiff;

            if (maxCoolingDeltaK < NONLINEAR_TOLERANCE_K) {
                coolingConverged = true;
                break;
            }
        }

        if (isAdaptive && !coolingConverged) {
            coolingDt *= ADAPTIVE_SHRINK_FACTOR;
            if (coolingDt < 1e-5) {
                status = { type: "error", message: "Degradation! Cooling step limits reached." };
                break;
            }
            T.set(oldT);
            continue;
        }

        let maxStepCoolingChange = 0;
        for (let k = 0; k < size2D; k++) {
            const stepChange = Math.abs(currentIterT[k] - T[k]);
            if (stepChange > maxStepCoolingChange) maxStepCoolingChange = stepChange;
        }

// --- СТРОГИЙ ДВУХТОЧЕЧНЫЙ АНАЛИЗ ОШИБКИ ВРЕМЕНИ НА ФАЗЕ ПАУЗЫ ---
        if (CALCULATE_ACCURACY_ERROR && coolingConverged) {
            accumulatedSolverError += coolingLastIterMaxSignedDiff;

            const idxBot = lastX * Ny;

            const currentTopRate = (currentIterT[0] - T[0]) / coolingDt;
            const currentBotRate = (currentIterT[idxBot] - T[idxBot]) / coolingDt;

            const accelTop = Math.abs(currentTopRate - prevTopRate);
            const accelBot = Math.abs(currentBotRate - prevBotRate);

            const errorTop = (coolingDt * coolingDt * 0.5) * accelTop;
            const errorBot = (coolingDt * coolingDt * 0.5) * accelBot;

            const maxLocalTimeError = errorTop > errorBot ? errorTop : errorBot;
            accumulatedTimeErrorSum += maxLocalTimeError;

            prevTopRate = currentTopRate;
            prevBotRate = currentBotRate;
        }

        T.set(currentIterT);

        coolingTimeElapsed += coolingDt;
        logCoolingHistory(false);

        if (onProgress && coolingTime > 0) {
            const coolingFraction = Math.max(0, Math.min(1.0, coolingTimeElapsed / coolingTime));

            const startPercent = simulation.maxHeatingPercent ?? 95;
            const remainingRange = 99 - startPercent;
            let currentPercent = Math.floor(startPercent + (coolingFraction * remainingRange));

            if (currentPercent > lastReportedPercent && currentPercent <= 99) {
                onProgress(currentPercent);
                lastReportedPercent = currentPercent;
            }
        }

        if (isAdaptive) {
            if (maxStepCoolingChange > 0) {
                const stepRatio = TARGET_DELTA_T / maxStepCoolingChange;
                if (stepRatio > 1.0) {
                    coolingDt *= Math.min(ADAPTIVE_GROWTH_FACTOR, stepRatio);
                    if (coolingDt > ADAPTIVE_MAX_DT) coolingDt = ADAPTIVE_MAX_DT;
                } else {
                    coolingDt *= Math.max(ADAPTIVE_SHRINK_FACTOR, stepRatio);
                }
            } else {
                coolingDt = ADAPTIVE_MAX_DT;
            }
        }
    }

    logCoolingHistory(true);

    const pauseProfileC = new Float64Array(size2D);
    for (let i = 0; i < size2D; i++) {
        pauseProfileC[i] = T[i] - 273.15;
    }

    // ========================================================
    // ФИНАЛЬНЫЙ СБОР МЕТРИК ПОГРЕШНОСТЕЙ (ТОЛЬКО ЕСЛИ ВКЛЮЧЕНО)
    // ========================================================
    let accuracyMetrics = null;

    if (CALCULATE_ACCURACY_ERROR) {
        const finalTimeError = accumulatedTimeErrorSum;
       // 2. Погрешность аппроксимации пространственной сетки по толщине X
        const localDx = gridX.x[1] - gridX.x[0]; // Физическое расстояние между слоями 0 и 1
        const gradX = localDx > 0 ? (Math.abs(pauseProfileC[Ny] - pauseProfileC[0]) / localDx) : 0;

        // Умножаем локальный градиент на квадрат ЛОКАЛЬНОГО шага, а не глобального GRID_X_STEP_MM
        const finalGridError = gradX * Math.pow(localDx, 2) * 0.25;
        const totalUncertaintyC = Math.abs(accumulatedSolverError) + Math.sqrt(Math.pow(finalTimeError, 2) + Math.pow(finalGridError, 2));

        accuracyMetrics = {
            accuracyMode: mode,
            solverErrorC: accumulatedSolverError,
            timeIntegrationErrorC: finalTimeError,
            spatialGridErrorC: finalGridError,
            totalUncertaintyC: totalUncertaintyC,
            formatted: `± ${totalUncertaintyC.toFixed(2)} °C`
        };
    }

    return {
        heatingTimeSeconds: time,
        coolingTimeSeconds: coolingTimeElapsed,
        calculationTimeMs: performance.now() - calculationStart,
        reachedTarget,
        status,
        accuracyMetrics,
        temperatureProfile: {
            xCoordinatesMm: Array.from(gridX.x),
            yCoordinatesMm: Array.from(gridY.y),
            Nx, Ny,
            heating: heatingProfileC,
            pause: pauseProfileC
        },
        history
    };
}
