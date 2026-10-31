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

const LIMITS = {
    gridX:        { fast: 0.35, optimal: 0.17, accurate: 0.12 }, // Шаг сетки по горизонтали X (мм)
    gridY:        { fast: 1.30, optimal: 0.88, accurate: 0.45 }, // Шаг сетки по вертикали Y (мм)
    minGrid:      { fast: 0.06, optimal: 0.02, accurate: 0.02 }, // Минимальный предел размера ячейки (мм)
    maxIter:      { fast: 4,    optimal: 7,    accurate: 12 }, // Макс. число итераций Пикара в солвере

    tolerance:    { fast: 0.25, optimal: 0.23, accurate: 0.01 }, // Критерий остановки итераций солвера (К)
    maxDt:        { fast: 2.5,  optimal: 2.0,  accurate: 0.6 }, // Жесткий верхний потолок шага времени (с)
    targetDt:     { fast: 2.0,  optimal: 0.65,  accurate: 0.4 }, // Целевой шаг изменения температуры за итерацию (К)

    growthFactor: { fast: 1.30, optimal: 1.09, accurate: 1.05 }, // Коэффициент ускорения шага времени (рост dt)
    shrinkFactor: { fast: 0.50, optimal: 0.83, accurate: 0.75 }  // Коэффициент замедления шага времени (сжатие dt)
};

export const DEFAULT_DT_SECONDS = 0.1;
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
    if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) return { isValid: false, error: "Exactly two heaters are required." };
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
    for (let i = 0; i < nodeCount - 1; i++) {
        const diff = x[i + 1] - x[i];
        dx[i] = diff < minGridStepMm ? minGridStepMm : diff;
    }

    x[0] = 0.0;
    for (let i = 0; i < nodeCount - 1; i++) {
        x[i + 1] = x[i] + dx[i];
    }

    const actualTotalLength = x[nodeCount - 1];
    if (actualTotalLength > 1e-7 && Math.abs(actualTotalLength - thicknessMm) > 1e-5) {
        const scale = thicknessMm / actualTotalLength;
        for (let i = 1; i < nodeCount; i++) {
            x[i] *= scale;
        }
        for (let i = 0; i < nodeCount - 1; i++) {
            dx[i] = x[i + 1] - x[i];
        }
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
    for (let i = 0; i < intervals; i++) totalWeightIntegral += getWeightDensity(i * stepInt) * stepInt;

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
        if (y[j] >= yChangePrincipleMm) { changeIndex = j; break; }
    }

    if (changeIndex > 0 && changeIndex < nodeCount - 2) {
        let baseDy = y[changeIndex] - y[changeIndex - 1];
        if (baseDy < minGridStepMm) baseDy = minGridStepMm;
        const q = 1.12;
        let currentDy = baseDy;
        for (let j = changeIndex; j < nodeCount - 1; j++) {
            currentDy *= q;
            if (currentDy < minGridStepMm) currentDy = minGridStepMm;
            y[j + 1] = y[j] + currentDy;
        }
        if (Math.abs(y[nodeCount - 1] - widthHalfMm) > 1e-5) {
            const yStartZone = y[changeIndex];
            const oldLength = y[nodeCount - 1] - yStartZone;
            const newLength = widthHalfMm - yStartZone;
            if (oldLength > 1e-7 && newLength > 0) {
                const scale = newLength / oldLength;
                for (let j = changeIndex + 1; j < nodeCount; j++) y[j] = yStartZone + (y[j] - yStartZone) * scale;
            }
        }
    }

    for (let j = 1; j < nodeCount; j++) {
        if (y[j] <= y[j - 1] + 1e-6) y[j] = y[j - 1] + minGridStepMm;
    }
    y[nodeCount - 1] = widthHalfMm;

    const dy = new Float64Array(nodeCount - 1);
    const dyHat = new Float64Array(nodeCount);

    for (let j = 0; j < nodeCount - 1; j++) {
        dy[j] = y[j + 1] - y[j];
        if (dy[j] < minGridStepMm) dy[j] = minGridStepMm;
    }
    y[0] = 0.0;
    for (let j = 0; j < nodeCount - 1; j++) {
        y[j + 1] = y[j] + dy[j];
    }
    const actualWidthHalf = y[nodeCount - 1];
    if (actualWidthHalf > 1e-7 && Math.abs(actualWidthHalf - widthHalfMm) > 1e-5) {
        const scaleY = widthHalfMm / actualWidthHalf;
        for (let j = 1; j < nodeCount; j++) y[j] *= scaleY;
        for (let j = 0; j < nodeCount - 1; j++) dy[j] = y[j + 1] - y[j];
    }

    dyHat[0] = 0.5 * dy[0];
    for (let j = 1; j < nodeCount - 1; j++) dyHat[j] = 0.5 * (dy[j - 1] + dy[j]);
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
            for (; k < i; k++) sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
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
            for (; k < j; k++) sum -= A[iStride + (lead + k - i)] * A[k * abRowStride + (lead + j - k)];
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
        for (; j < i; j++) sum -= A[iStride + (lead + j - i)] * x[j];
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
        for (; j <= jMax; j++) sum -= A[iStride + (lead + j - i)] * x[j];
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

export function simulate2DHeating({ thicknessMm, material, machine, simulation, storeHistory = false, onProgress }) {
    const calculationStart = performance.now();
    const mach = normalizeMachine(machine);
    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({ thicknessMm, material, machine: mach, simulation});
    if (!validation.isValid) return makeError(validation.error);

    const rawMode = simulation?.accuracyMode;
    const isStringMode = typeof rawMode === "string";
    let mode = isStringMode ? rawMode : (rawMode ? "custom" : "optimal");
    if (isStringMode && !["fast", "optimal", "accurate"].includes(mode)) mode = "optimal";

    const isCustom = mode === "custom";
    const fallbackBase = LIMITS.optimal;
    const am = isStringMode ? null : rawMode;

    const GRID_X_STEP_MM           = isCustom ? (am?.gridX        ?? fallbackBase.gridX)        : LIMITS.gridX[mode];
    const GRID_Y_STEP_MM           = isCustom ? (am?.gridY        ?? fallbackBase.gridY)        : LIMITS.gridY[mode];
    const MIN_GRID_STEP_MM         = isCustom ? (am?.minGrid      ?? fallbackBase.minGrid)      : LIMITS.minGrid[mode];
    const MAX_NONLINEAR_ITERATIONS = isCustom ? (am?.maxIter      ?? fallbackBase.maxIter)      : LIMITS.maxIter[mode];
    const NONLINEAR_TOLERANCE_K    = isCustom ? (am?.tolerance    ?? fallbackBase.tolerance)    : LIMITS.tolerance[mode];
    const ADAPTIVE_MAX_DT          = isCustom ? (am?.maxDt        ?? fallbackBase.maxDt)        : LIMITS.maxDt[mode];
    const TARGET_DELTA_T           = isCustom ? (am?.targetDt     ?? fallbackBase.targetDt)     : LIMITS.targetDt[mode];
    const ADAPTIVE_GROWTH_FACTOR   = isCustom ? (am?.growthFactor ?? fallbackBase.growthFactor) : LIMITS.growthFactor[mode];
    const ADAPTIVE_SHRINK_FACTOR   = isCustom ? (am?.shrinkFactor ?? fallbackBase.shrinkFactor) : LIMITS.shrinkFactor[mode];

    const shouldCalculateAccuracyError = simulation?.calculateAccuracyError !== false;
    const is1D = simulation.widthHalfMm === 0;
    const slotHalfWidthMm = simulation.slotHalfWidthMm !== undefined ? simulation.slotHalfWidthMm : 5.0;
    const convectionTransitionEndMm = simulation.convectionTransitionEndMm !== undefined ? simulation.convectionTransitionEndMm : 8.0;

    let dt = TARGET_DELTA_T * 0.2;

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
    let countRejectedSteps = 0;
    let countPicardIters = 0;

    let heatingProfileC = null;
    let pauseProfileC;
    let reachedTarget = false;
    let status = null;

    const totalRangeHeating = targetValue - initT;
    const invTargetValueTime = targetValue > 0 ? (1.0 / targetValue) : 0.0;
    const invMaxTimeSeconds = maxTimeSeconds > 0 ? (1.0 / maxTimeSeconds) : 0.0;
    const invTotalCoolingTime = totalCoolingTime > 0 ? (1.0 / totalCoolingTime) : 0.0;

    let lastReportTimeMs = 0;
    let currentPhase = "heating";
    let coolingTimeElapsed = 0;

    const idxTop = 0;
    const idxMid = ((Nx - 1) >> 1) * Ny;
    const idxBot = lastX * Ny;

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
        logHistoryGlobal(time + coolingTimeElapsed, true);
    };


    while (true) {
        let currentMaxDt = ADAPTIVE_MAX_DT;

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
            if (currentPhase === "heating" && totalCoolingTime > 0) {
                const curIdx = step % 3;
                reachedTarget = targetType === "time"
                    ? time >= targetValue
                    : (targetK == null ? false : isTargetReached2D(buffers[curIdx], Nx, Ny, target, targetK));

                switchToCoolingPhase();
                continue;
            } else {
                break;
            }
        }

        const curIdx = step % 3;
        const newIdx = (step + 1) % 3;

        buffers[newIdx].set(buffers[curIdx]);

        let nonlinearConverged = false;
        let lastIterMaxSignedDiff = 0.0;
        let stepMaxGridError = 0.0;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
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

            matrixAClone.set(matrixA);
            solveBandMatrixOptimized(matrixAClone, size2D, bandWidth, rhsVec, solverX, precalc);
            countPicardIters++;

            let maxDeltaK = 0;
            let localMaxSignedDiff = 0.0;
            for (let k = 0; k < size2D; k++) {
                const diffSigned = solverX[k] - buffers[newIdx][k];
                const diffAbs = Math.abs(diffSigned);
                if (diffAbs > maxDeltaK) { maxDeltaK = diffAbs; localMaxSignedDiff = diffSigned; }
            }
            buffers[newIdx].set(solverX);
            lastIterMaxSignedDiff = localMaxSignedDiff;

            if (maxDeltaK < NONLINEAR_TOLERANCE_K) {
                nonlinearConverged = true;
                stepMaxGridError = iterMaxGridError;
                break;
            }
        }

        if (!nonlinearConverged) {
            countRejectedSteps++;
            dt *= ADAPTIVE_SHRINK_FACTOR;
            if (dt < 1e-5) { status = { type: "error", message: `Degradation! Min time step reached in ${currentPhase} phase.` }; break; }
            continue;
        }

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
                const fraction = (decompTempK - maxOldT) * (1.0 / deltaTOverheat);
                const nextDt = dt * clamp(fraction, 0.05, 0.95);

                if (nextDt >= 1e-5) {
                    countRejectedSteps++;
                    dt = nextDt;
                    continue;
                }
            }
            status = { type: "error", message: `Degradation! Temperature > ${material.decompositionTemp}°C.` };
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
                // Оптимизация: Выносим общий инвариант формулы наружу.
                // Математически: 0.5 * (2.0 / (h1 + h2)) * h2 * h2  упрощается до (h2 * h2) / (h1 + h2)
                const errorTimeMultiplier = (h2 * h2) / (h1 + h2);
                const invH1 = 1.0 / h1;
                const invH2 = 1.0 / h2;

                const currentBuffer = buffers[newIdx];

                // Точка Top (используем T_n_top и T_nm1_top)
                const dT_dt2_top = (currentBuffer[idxTop] - T_n_top) * invH2 - (T_n_top - T_nm1_top) * invH1;
                const errTimeTop = Math.abs(dT_dt2_top) * errorTimeMultiplier;

                // Точка Mid (используем T_n_mid и T_nm1_mid)
                const dT_dt2_mid = (currentBuffer[idxMid] - T_n_mid) * invH2 - (T_n_mid - T_nm1_mid) * invH1;
                const errTimeMid = Math.abs(dT_dt2_mid) * errorTimeMultiplier;

                // Точка Bot (используем T_n_bot и T_nm1_bot)
                const dT_dt2_bot = (currentBuffer[idxBot] - T_n_bot) * invH2 - (T_n_bot - T_nm1_bot) * invH1;
                const errTimeBot = Math.abs(dT_dt2_bot) * errorTimeMultiplier;

                // Быстрый поиск максимума без создания промежуточных массивов
                let localMaxTimeErr = errTimeTop > errTimeMid ? errTimeTop : errTimeMid;
                if (errTimeBot > localMaxTimeErr) localMaxTimeErr = errTimeBot;

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
                    // Оптимизировано: быстрая замена деления на pre-calc умножение
                    heatingProgressFraction = time * invTargetValueTime;
                } else if ((targetType === "minTemperature" || targetType === "surfaceTemperature") && targetValue > initT) {
                    const activeBuffer = buffers[newIdx];

                    // Берутся только крайние точки поверхности (О(1)), никаких циклов по всей сетке!
                    const topC = activeBuffer[0] - 273.15;
                    const botC = activeBuffer[(Nx - 1) * Ny] - 273.15;
                    const maxSurfaceC = topC > botC ? topC : botC;

                    // Математическое выпрямление кривой нагрева поверхности
                    // Избавляет от медленного старта до 20% и не тормозит CPU
                    const currentDiff = maxSurfaceC - initT;
                    const totalDiff = (targetValue * 1.25) - initT; // примерный предел нагрева поверхности

                    if (totalDiff > 0 && currentDiff > 0) {
                        heatingProgressFraction = Math.sqrt(currentDiff / totalDiff);
                    }
                    const triggerNodeFraction = (currentStepCriticalValue - 273.15 - initT) / totalRangeHeating;

                    heatingProgressFraction = Math.max(heatingProgressFraction, triggerNodeFraction);
                } else if (maxTimeSeconds > 0) {
                    heatingProgressFraction = time * invMaxTimeSeconds;
                }

                heatingProgressFraction = Math.max(0, Math.min(1.0, heatingProgressFraction));
                currentPercent = Math.floor(heatingProgressFraction * maxHeatingPercent);
            } else {
                // Линейное охлаждение по времени (тоже O(1))
                let coolingProgressFraction = totalCoolingTime > 0 ? (coolingTimeElapsed * invTotalCoolingTime) : 1.0;
                coolingProgressFraction = Math.max(0, Math.min(1.0, coolingProgressFraction));
                currentPercent = Math.floor(maxHeatingPercent + (coolingProgressFraction * coolingWeightRange));
            }

            const nowMs = performance.now();
            if (currentPercent !== lastReportedPercent && (nowMs - lastReportTimeMs > 40 || currentPercent === 100)) {
                const currentLoad = countPicardIters * size2D;
                const shouldAbort = onProgress(currentPercent, currentLoad);

                if (shouldAbort === true) {
                    status = {
                        type: "abort",
                        message: `Simulation aborted by outer load limit control at ${currentPercent}% (${currentPhase}).`
                    };
                    if (shouldCalculateAccuracyError) {
                        const lastPicardDeltaK = Math.abs(lastIterMaxSignedDiff);
                        if (lastPicardDeltaK > maxSolverErrorC) maxSolverErrorC = lastPicardDeltaK;
                        if (stepMaxGridError > maxGridErrorC) maxGridErrorC = stepMaxGridError;
                    }
                    break;
                }

                lastReportedPercent = currentPercent;
                lastReportTimeMs = nowMs;
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

        let maxStepTempChange = Math.max(
            Math.abs(buffers[newIdx][idxTop] - buffers[curIdx][idxTop]),
            Math.abs(buffers[newIdx][idxMid] - buffers[curIdx][idxMid]),
            Math.abs(buffers[newIdx][idxBot] - buffers[curIdx][idxBot])
        );

        if (maxStepTempChange > 0) {
            const stepRatio = TARGET_DELTA_T / maxStepTempChange;
            dt *= stepRatio > 1.0 ? Math.min(ADAPTIVE_GROWTH_FACTOR, stepRatio) : Math.max(ADAPTIVE_SHRINK_FACTOR, stepRatio);
            if (dt > currentMaxDt) dt = currentMaxDt;
        } else {
            dt = currentMaxDt;
        }

        step++;
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
            accuracy: shouldCalculateAccuracyError ? accuracyMetrics : null,
            iterations: {
                totalTimeSteps: countTimeSteps,
                rejectedTimeSteps: countRejectedSteps,
                totalPicardIterations: countPicardIters,
                totalGridPointsProcessed: countPicardIters * size2D
            }
        }
    };
}
