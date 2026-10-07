/**
 * Optimized 2D transient FULLY IMPLICIT finite-difference heating and cooling model for opaque plastics (PVC).
 * Features dynamic spatial grid generation concentrated around intense physical gradient zones (5-8 mm).
 * Includes seamless fallback to efficient 1D calculation mode when width is 0.
 *
 * COMPACT VERSION: Eliminates grid redundancy. Coordinates are stored once under 'temperatureProfile',
 * while thermal fields are split into 'heating' (after oven) and 'pause' (after transfer cooling).
 */

/* ========================================================
 * НАСТРОЙКИ СЕТКИ И СХОДИМОСТИ СОЛВЕРА
 * ======================================================== */
export const GRID_X_STEP_MM = 0.2;
export const GRID_Y_STEP_MM = 0.8;
export const DEFAULT_DT_SECONDS = 0.1;
export const MAX_NONLINEAR_ITERATIONS = 3;
export const NONLINEAR_TOLERANCE_K = 0.1;
export const MIN_GRID_STEP_MM = 0.05;

/* ========================================================
 * ГЕОМЕТРИЯ И ФИЗИКА СТЕНДА
 * ======================================================== */
export const SIGMA = 5.670374419e-8;
export const HEATER_RADIUS_MM = 3.0;
export const DISTANCE_TO_SHEET_MM = 8.0;
const EFFECTIVE_H_MM = DISTANCE_TO_SHEET_MM + HEATER_RADIUS_MM;

// Асимметрия естественной конвекции вне зоны щели нагревателя (при нагреве)
const AMBIENT_CONVECTION_H_TOP = 10.0;
const AMBIENT_CONVECTION_H_BOT = 5.0;

/* ========================================================
 * АДАПТИВНЫЙ ВРЕМЕННОЙ ШАГ
 * ======================================================== */
const ADAPTIVE_MAX_DT = 2.5;
const TARGET_DELTA_T = 2.0;
const ADAPTIVE_GROWTH_FACTOR = 1.15;
const ADAPTIVE_SHRINK_FACTOR = 0.60;

const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
const toKelvin = c => c + 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;
const getProperty = (property, temperatureC) =>
    typeof property === "function" ? property(temperatureC) : property;

/**
 * Рассчитывает избыточную энтальпию фазового перехода (интеграл от избыточной Cp).
 */
function getExcessEnthalpy(t, tg, jumpFactor, width, baseCp) {
    const halfWidth = width / 2;
    const tStart = tg - halfWidth;
    const tEnd = tg + halfWidth;
    const deltaCpMax = baseCp * (jumpFactor - 1.0);

    if (t <= tStart) return 0.0;
    if (t >= tEnd) {
        return deltaCpMax * (t - (tStart + tEnd) / 2.0);
    }
    return (deltaCpMax / (2.0 * width)) * Math.pow(t - tStart, 2);
}

function createMaterialModel(material) {
    if (!material || typeof material !== "object") return null;
    const tg = material.glassTransitionTemp;
    const jumpFactor = material.tgSpecificHeatJumpFactor;
    const width = material.tgTransitionWidthC;

    return {
        constant: false,
        properties: null,
        get: (temperatureC, oldTemperatureC = null) => {
            const density = getProperty(material.density, temperatureC);
            const k = getProperty(material.thermalConductivity, temperatureC);
            const baseCp = getProperty(material.specificHeat, temperatureC);

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

function createNonlinearGridX(thicknessMm, nodeCount) {
    const x = new Float64Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) {
        const fraction = i / (nodeCount - 1);
        x[i] = thicknessMm * 0.5 * (1.0 - Math.cos(fraction * Math.PI));
    }

    const dx = new Float64Array(nodeCount - 1);
    const dxHat = new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount - 1; i++) {
        const diff = x[i + 1] - x[i];
        dx[i] = diff < MIN_GRID_STEP_MM ? MIN_GRID_STEP_MM : diff;
    }

    dxHat[0] = 0.5 * dx[0];
    for (let i = 1; i < nodeCount - 1; i++) {
        dxHat[i] = 0.5 * (dx[i - 1] + dx[i]);
    }
    dxHat[nodeCount - 1] = 0.5 * dx[nodeCount - 2];

    return { x, dx, dxHat, nodeCount };
}

function createParametricGridY(widthHalfMm, nodeCount, slotHalfWidthMm, convectionTransitionEndMm) {
    let y = new Float64Array(nodeCount);

    const yCenter = (slotHalfWidthMm + convectionTransitionEndMm) / 2.0;
    const yChangePrincipleMm = slotHalfWidthMm + 3.0;

    function getWeightDensity(posMm) {
        let weight = 1.0;
        weight += 2.0 * Math.exp(-Math.pow(posMm / 3.0, 2));
        const zoneWidth = (convectionTransitionEndMm - slotHalfWidthMm) * 0.5 || 1.5;
        weight += 8.0 * Math.exp(-Math.pow((posMm - yCenter) / zoneWidth, 2));
        return weight;
    }

    const intervals = 500;
    const stepInt = widthHalfMm / intervals;
    let totalWeightIntegral = 0;
    for (let i = 0; i < intervals; i++) {
        totalWeightIntegral += getWeightDensity(i * stepInt) * stepInt;
    }

    let currentWeightPos = 0.0;
    let targetWeightPerNode = totalWeightIntegral / (nodeCount - 1);
    let currentMm = 0.0;
    const searchStep = widthHalfMm / 2000.0;

    for (let j = 1; j < nodeCount - 1; j++) {
        let neededWeight = j * targetWeightPerNode;
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
        if (baseDy < MIN_GRID_STEP_MM) baseDy = MIN_GRID_STEP_MM;

        const q = 1.12;
        let currentDy = baseDy;
        for (let j = changeIndex; j < nodeCount - 1; j++) {
            currentDy *= q;
            if (currentDy < MIN_GRID_STEP_MM) currentDy = MIN_GRID_STEP_MM;
            y[j + 1] = y[j] + currentDy;
        }

        if (y[nodeCount - 1] !== widthHalfMm) {
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
            y[j] = y[j - 1] + MIN_GRID_STEP_MM;
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

    return { y, dy, dyHat, nodeCount };
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

function isTargetReached2D(T, Nx, Ny, target, targetK) {
    if (!target) return false;
    if (target.type === "time") return false;
    if (target.type === "minTemperature") {
        for (let i = 0; i < Nx; i++) {
            if (T[i * Ny] < targetK) return false;
        }
        return true;
    }
    if (target.type === "surfaceTemperature") {
        return T[0] >= targetK || T[(Nx - 1) * Ny] >= targetK;
    }
    return false;
}

export function simulate2DHeating({ thicknessMm, material, machine, simulation, dtSeconds, storeHistory = false }) {
    const calculationStart = performance.now();
    const mach = normalizeMachine(machine);
    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({ thicknessMm, material, machine: mach, simulation, dtSeconds });
    if (!validation.isValid) return makeError(validation.error);

    const is1D = simulation.widthHalfMm === 0;

    const slotHalfWidthMm = simulation.slotHalfWidthMm !== undefined ? simulation.slotHalfWidthMm : 5.0;
    const convectionTransitionEndMm = simulation.convectionTransitionEndMm !== undefined ? simulation.convectionTransitionEndMm : 8.0;

    const isAdaptive = dtSeconds === undefined;
    let dt = validation.dtSeconds;

    const Nx = Math.max(5, Math.round(thicknessMm / GRID_X_STEP_MM)) + 1;
    const Ny = is1D ? 1 : (Math.max(12, Math.round(simulation.widthHalfMm / GRID_Y_STEP_MM)) + 1);

    const lastX = Nx - 1;
    const lastY = Ny - 1;

    const gridX = createNonlinearGridX(thicknessMm, Nx);
    const gridY = is1D
        ? { y: new Float64Array([0.0]), dy: new Float64Array([0.0]), dyHat: new Float64Array([0.0]), nodeCount: 1 }
        : createParametricGridY(simulation.widthHalfMm, Ny, slotHalfWidthMm, convectionTransitionEndMm);

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
    const hTop = mach.heaters[0].convectiveHeatTransferCoefficient;
    const hBot = mach.heaters[1].convectiveHeatTransferCoefficient;
    const ambientTemperatureK = ambT + 273.15;

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
        if (!force && (time - lastLoggedTime < 1.0) && time < simulationMaxTime) return;

        history.time.push(time);
        history.frontSurfaceC.push(T[0] - 273.15); // x=0, y=0
        history.centerC.push(T[((Nx - 1) >> 1) * Ny] - 273.15); // x=center, y=0
        history.backSurfaceC.push(T[lastX * Ny] - 273.15); // x=thickness, y=0
        lastLoggedTime = time;
    };

    logHistory(true);

    let status = null;
    let forceStop = false;

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

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const dxH = gridX.dxHat[i] / 1000.0;
                const dxL = i > 0 ? (gridX.dx[i - 1] / 1000.0) : 0;
                const dxR = i < lastX ? (gridX.dx[i] / 1000.0) : 0;

                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = currentIterT[idxRow];
                    const oldTempC = oldT[idxRow] - 273.15;

                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const kEff = props.k;

                    const dyH = (gridY.dyHat[j] / 1000.0) || 0.001;
                    const dyL = (j > 0 ? (gridY.dy[j - 1] / 1000.0) : 0) || 0.001;
                    const dyR = (j < lastY ? (gridY.dy[j] / 1000.0) : 0) || 0.001;

                    rhsVec[idxRow] = oldT[idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;

                    const matRowOffset = idxRow * abRowStride + lead;

                    if (i > 0 && i < lastX) {
                        const coeffLeft = (dt * kEff) / (dxH * dxL);
                        const coeffRight = (dt * kEff) / (dxH * dxR);
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else if (i === 0) {
                        const coeffRight = (dt * kEff) / (dxH * dxR);
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += coeffRight;

                        const fH = viewFactorsY[j];
                        const radATop = radFactorTopBase * fH;
                        const currentTempK_3 = currentTempK * currentTempK * currentTempK;

                        const q_conv = precalcConvTopH[j] * (precalcConvTopAir[j] - currentTempK);
                        const dq_conv = -precalcConvTopH[j];
                        const q_rad = radATop * (Math.pow(T_top_K, 4) - Math.pow(currentTempK, 4));
                        const dq_rad = -4 * radATop * currentTempK_3;

                        centerCoeff -= (dt / dxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (dt / dxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    } else if (i === lastX) {
                        const coeffLeft = (dt * kEff) / (dxH * dxL);
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        centerCoeff += coeffLeft;

                        const fH = viewFactorsY[j];
                        const radABot = radFactorBotBase * fH;
                        const currentTempK_3 = currentTempK * currentTempK * currentTempK;

                        const q_conv = precalcConvBotH[j] * (precalcConvBotAir[j] - currentTempK);
                        const dq_conv = -precalcConvBotH[j];
                        const q_rad = radABot * (Math.pow(T_bot_K, 4) - Math.pow(currentTempK, 4));
                        const dq_rad = -4 * radABot * currentTempK_3;

                        centerCoeff -= (dt / dxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (dt / dxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    }

                    if (!is1D) {
                        if (j > 0 && j < lastY) {
                            const coeffLeftY = (dt * kEff) / (dyH * dyL);
                            const coeffRightY = (dt * kEff) / (dyH * dyR);
                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            matrixA[matRowOffset + 1] = -coeffRightY;
                            centerCoeff += (coeffLeftY + coeffRightY);
                        } else if (j === 0) {
                            const coeffRightY = (dt * kEff) / (dyH * dyR);
                            matrixA[matRowOffset + 1] = -2 * coeffRightY;
                            centerCoeff += 2 * coeffRightY;
                        } else if (j === lastY) {
                            const coeffLeftY = (dt * kEff) / (dyH * dyL);
                            matrixA[matRowOffset - 1] = -2 * coeffLeftY;
                            centerCoeff += 2 * coeffLeftY;
                        }
                    }

                    matrixA[matRowOffset] = centerCoeff;
                }
            }

            matrixAClone.set(matrixA);
            solveBandMatrixOptimized(matrixAClone, size2D, bandWidth, rhsVec, solverX, precalc);

            let maxDeltaK = 0;
            for (let k = 0; k < size2D; k++) {
                const diff = Math.abs(solverX[k] - currentIterT[k]);
                if (diff > maxDeltaK) maxDeltaK = diff;
            }
            currentIterT.set(solverX);
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

        let maxStepTempChange = 0;
        for (let k = 0; k < size2D; k++) {
            const stepChange = Math.abs(currentIterT[k] - T[k]);
            if (stepChange > maxStepTempChange) maxStepTempChange = stepChange;
        }

        T.set(currentIterT);
        time += dt;
        logHistory(false);

        if (forceStop) break;

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
    // ФАЗА 2: ПАУЗА (ОСТЫВАНИЕ ПРИ ПЕРЕНОСЕ ЛИСТА)
    // ========================================================
    const coolingTime = simulation.cooling?.timeSeconds || 0;
    const hCooling = simulation.cooling?.convectiveHeatTransferCoefficient || 8.0;
    const radFactorAmbient = epsS * SIGMA;

    let coolingTimeElapsed = 0;
    let coolingDt = 0.05;
    let lastCoolingLoggedTime = -1.0;

    const logCoolingHistory = (force = false) => {
        if (!storeHistory) return;
        if (!force && (coolingTimeElapsed - lastCoolingLoggedTime < 1.0) && coolingTimeElapsed < coolingTime) return;

        history.time.push(time + coolingTimeElapsed);
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

        for (let iter = 0; iter < 2; iter++) {
            for (let i = 0; i <= lastX; i++) {
                const iNy = i * Ny;
                const dxH = gridX.dxHat[i] / 1000.0;
                const dxL = i > 0 ? (gridX.dx[i - 1] / 1000.0) : 0;
                const dxR = i < lastX ? (gridX.dx[i] / 1000.0) : 0;

                for (let j = 0; j <= lastY; j++) {
                    const idxRow = iNy + j;
                    const currentTempK = currentIterT[idxRow];
                    const oldTempC = oldT[idxRow] - 273.15;

                    const props = matModel.get(currentTempK - 273.15, oldTempC);
                    const volHeatCap = props.density * props.cp;
                    const kEff = props.k;

                    const dyH = (gridY.dyHat[j] / 1000.0) || 0.001;
                    const dyL = (j > 0 ? (gridY.dy[j - 1] / 1000.0) : 0) || 0.001;
                    const dyR = (j < lastY ? (gridY.dy[j] / 1000.0) : 0) || 0.001;

                    rhsVec[idxRow] = oldT[idxRow] * volHeatCap;
                    let centerCoeff = volHeatCap;
                    const matRowOffset = idxRow * abRowStride + lead;

                    if (i > 0 && i < lastX) {
                        const coeffLeft = (coolingDt * kEff) / (dxH * dxL);
                        const coeffRight = (coolingDt * kEff) / (dxH * dxR);
                        matrixA[matRowOffset - Ny] = -coeffLeft;
                        matrixA[matRowOffset + Ny] = -coeffRight;
                        centerCoeff += (coeffLeft + coeffRight);
                    } else if (i === 0 || i === lastX) {
                        const coeffNext = i === 0 ? (coolingDt * kEff) / (dxH * dxR) : (coolingDt * kEff) / (dxH * dxL);
                        matrixA[matRowOffset + (i === 0 ? Ny : -Ny)] = -coeffNext;
                        centerCoeff += coeffNext;

                        const currentTempK_3 = currentTempK * currentTempK * currentTempK;
                        const q_conv = hCooling * (ambientTemperatureK - currentTempK);
                        const dq_conv = -hCooling;
                        const q_rad = radFactorAmbient * (Math.pow(ambientTemperatureK, 4) - Math.pow(currentTempK, 4));
                        const dq_rad = -4 * radFactorAmbient * currentTempK_3;

                        centerCoeff -= (coolingDt / dxH) * (dq_conv + dq_rad);
                        rhsVec[idxRow] += (coolingDt / dxH) * ((q_conv + q_rad) - (dq_conv + dq_rad) * currentTempK);
                    }

                    if (!is1D) {
                        if (j > 0 && j < lastY) {
                            const coeffLeftY = (coolingDt * kEff) / (dyH * dyL);
                            const coeffRightY = (coolingDt * kEff) / (dyH * dyR);
                            matrixA[matRowOffset - 1] = -coeffLeftY;
                            matrixA[matRowOffset + 1] = -coeffRightY;
                            centerCoeff += (coeffLeftY + coeffRightY);
                        } else if (j === 0) {
                            const coeffRightY = (coolingDt * kEff) / (dyH * dyR);
                            matrixA[matRowOffset + 1] = -2 * coeffRightY;
                            centerCoeff += 2 * coeffRightY;
                        } else if (j === lastY) {
                            const coeffLeftY = (coolingDt * kEff) / (dyH * dyL);
                            matrixA[matRowOffset - 1] = -2 * coeffLeftY;
                            centerCoeff += 2 * coeffLeftY;
                        }
                    }
                    matrixA[matRowOffset] = centerCoeff;
                }
            }
            matrixAClone.set(matrixA);
            solveBandMatrixOptimized(matrixAClone, size2D, bandWidth, rhsVec, solverX, precalc);
            currentIterT.set(solverX);
        }
        T.set(currentIterT);
        coolingTimeElapsed += coolingDt;

        logCoolingHistory(false);
    }

    logCoolingHistory(true);

    const pauseProfileC = new Float64Array(size2D);
    for (let i = 0; i < size2D; i++) {
        pauseProfileC[i] = T[i] - 273.15;
    }

    return {
        heatingTimeSeconds: time,
        coolingTimeSeconds: coolingTimeElapsed,
        calculationTimeMs: performance.now() - calculationStart,
        reachedTarget,
        status,
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

export function getVerticalSlicePoints(profile, yMm, phase = "heating") {
    if (!profile || !profile[phase]) return [];
    const { xCoordinatesMm, yCoordinatesMm, Nx, Ny } = profile;
    const temperaturesC = profile[phase];

    const targetY = clamp(yMm, yCoordinatesMm[0], yCoordinatesMm[Ny - 1]);
    let minDiff = Infinity;
    let targetJ = 0;
    for (let j = 0; j < Ny; j++) {
        const diff = Math.abs(yCoordinatesMm[j] - targetY);
        if (diff < minDiff) {
            minDiff = diff;
            targetJ = j;
        }
    }

    const points = new Array(Nx);
    for (let i = 0; i < Nx; i++) {
        points[i] = [xCoordinatesMm[i], Number(temperaturesC[i * Ny + targetJ])];
    }
    return points;
}

export function getHorizontalSlicePoints(profile, xMm, phase = "heating") {
    if (!profile || !profile[phase]) return [];
    const { xCoordinatesMm, yCoordinatesMm, Nx, Ny } = profile;
    const temperaturesC = profile[phase];

    const targetX = clamp(xMm, xCoordinatesMm[0], xCoordinatesMm[Nx - 1]);
    let minDiff = Infinity;
    let targetI = 0;
    for (let i = 0; i < Nx; i++) {
        const diff = Math.abs(xCoordinatesMm[i] - targetX);
        if (diff < minDiff) {
            minDiff = diff;
            targetI = i;
        }
    }

    const points = new Array(Ny);
    const rowOffset = targetI * Ny;
    for (let j = 0; j < Ny; j++) {
        points[j] = [yCoordinatesMm[j], Number(temperaturesC[rowOffset + j])];
    }
    return points;
}
