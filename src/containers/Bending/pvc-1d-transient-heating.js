/**
 * Optimized 1D transient implicit finite-difference heating model for opaque plastics (PVC).
 * Configuration: Semi-enclosed heater box with ultra-narrow gap (5-6mm).
 * Always 2 heaters active (top and bottom).
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 */

export const GRID_CELLS_PER_THICKNESS = 20;
export const MIN_DX_MM = 0.25;
export const MAX_DX_MM = 1.5;
export const DEFAULT_DT_SECONDS = 0.25;
export const MAX_NONLINEAR_ITERATIONS = 3;
export const NONLINEAR_TOLERANCE_K = 0.1;
export const SIGMA = 5.670374419e-8;

/* =========================
 * MATHEMATICAL HELPERS
 * ========================= */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toKelvin = c => c + 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;

const getProperty = (property, temperatureC) =>
    typeof property === "function" ? property(temperatureC) : property;

function createMaterialModel(material) {
    if (!material || typeof material !== "object") return null;

    const tg = material.glassTransitionTemp;
    const jumpFactor = material.tgSpecificHeatJumpFactor;
    const width = material.tgTransitionWidthC;
    const halfWidth = width / 2;
    const tStart = tg - halfWidth;
    const tEnd = tg + halfWidth;

    return {
        constant: false,
        properties: null,
        get: temperatureC => {
            let cp = getProperty(material.specificHeat, temperatureC);
            const maxCp = cp * jumpFactor;

            if (temperatureC > tStart && temperatureC <= tEnd) {
                cp = cp + ((maxCp - cp) / width) * (temperatureC - tStart);
            } else if (temperatureC > tEnd) {
                cp = maxCp;
            }

            return {
                density: getProperty(material.density, temperatureC),
                k: getProperty(material.thermalConductivity, temperatureC),
                cp
            };
        }
    };
}

const makeError = (message, extra = {}) => ({
    status: { type: "error", message },
    heatingTimeSeconds: 0,
    reachedTarget: false,
    stoppedByMaxTemperature: false,
    temperatureProfile: [],
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

/* =========================
 * VALIDATION
 * ========================= */
export function validateSimulationParams({ thicknessMm, material, machine, simulation, dxMm, dtSeconds }) {
    if (!validPositive(thicknessMm)) return { isValid: false, error: "Invalid thickness." };
    if (!material || typeof material !== "object") return { isValid: false, error: "Invalid material model." };
    if (!machine || typeof machine !== "object") return { isValid: false, error: "Invalid machine." };
    if (!Array.isArray(machine.heaters) || machine.heaters.length !== 2) return { isValid: false, error: "Exactly two heaters are required." };
    if (!simulation || typeof simulation !== "object") return { isValid: false, error: "Simulation parameters are missing." };

    const validateHeater = (heater, name) => {
        if (!heater || typeof heater !== "object") return `${name} heater is invalid.`;
        if (!Number.isFinite(heater.regulatorTemperatureC)) return `${name} heater regulator temperature is invalid.`;
        if (!Number.isFinite(heater.heaterTemperatureFactor)) return `${name} heater temperature factor is invalid.`;
        if (!Number.isFinite(heater.heaterEmissivity) || heater.heaterEmissivity < 0 || heater.heaterEmissivity > 1) return `${name} heater emissivity is invalid.`;
        if (!Number.isFinite(heater.boxEmissivity) || heater.boxEmissivity < 0 || heater.boxEmissivity > 1) return `${name} box emissivity is invalid.`;
        if (!Number.isFinite(heater.viewFactor) || heater.viewFactor < 0 || heater.viewFactor > 1) return `${name} view factor is invalid.`;
        if (!Number.isFinite(heater.radiationGain) || heater.radiationGain < 0) return `${name} radiation gain is invalid.`;
        if (!Number.isFinite(heater.convectiveHeatTransferCoefficient) || heater.convectiveHeatTransferCoefficient < 0) return `${name} convective heat transfer coefficient is invalid.`;
        if (!Number.isFinite(heater.boxEfficiency) || heater.boxEfficiency < 0 || heater.boxEfficiency > 1) return `${name} box efficiency is invalid.`;
        if (heater.ambientViewFactor !== undefined &&
            (!Number.isFinite(heater.ambientViewFactor) || heater.ambientViewFactor < 0 || heater.ambientViewFactor > 1)) {
            return `${name} ambient view factor is invalid.`;
        }
        return null;
    };

    const topError = validateHeater(machine.heaters[0], "Top");
    if (topError) return { isValid: false, error: topError };

    const bottomError = validateHeater(machine.heaters[1], "Bottom");
    if (bottomError) return { isValid: false, error: bottomError };

    if (!Number.isFinite(material.density) && typeof material.density !== "function") return { isValid: false, error: "Invalid material density." };
    if (!Number.isFinite(material.thermalConductivity) && typeof material.thermalConductivity !== "function") return { isValid: false, error: "Invalid material thermal conductivity." };
    if (!Number.isFinite(material.specificHeat) && typeof material.specificHeat !== "function") return { isValid: false, error: "Invalid material specific heat." };
    if (!Number.isFinite(material.emissivity) || material.emissivity < 0 || material.emissivity > 1) return { isValid: false, error: "Invalid material emissivity." };
    if (!Number.isFinite(material.glassTransitionTemp)) return { isValid: false, error: "Invalid glass transition temperature." };
    if (!Number.isFinite(material.tgSpecificHeatJumpFactor) || material.tgSpecificHeatJumpFactor <= 0) return { isValid: false, error: "Invalid Tg specific heat jump factor." };
    if (!Number.isFinite(material.tgTransitionWidthC) || material.tgTransitionWidthC <= 0) return { isValid: false, error: "Invalid Tg transition width." };
    if (!Number.isFinite(material.maxFormingTemp)) return { isValid: false, error: "Max forming temperature is not defined for the material." };
    if (!Number.isFinite(material.decompositionTemp)) return { isValid: false, error: "Decomposition temperature is not defined for the material." };

    const target = simulation.target;
    if (!target || typeof target !== "object") return { isValid: false, error: "Invalid simulation target object." };

    const targetType = target.type;
    if (targetType !== "minTemperature" && targetType !== "surfaceTemperature" && targetType !== "time") {
        return { isValid: false, error: "Invalid simulation target type." };
    }

    const targetValue = target.value;
    if (!Number.isFinite(targetValue)) return { isValid: false, error: "Invalid simulation target value." };
    if (targetType === "time" && targetValue <= 0) return { isValid: false, error: "Target time must be greater than 0." };

    const temperatures = simulation.temperatures;
    if (!temperatures || typeof temperatures !== "object") return { isValid: false, error: "Simulation temperatures configuration is missing." };
    if (!Number.isFinite(temperatures.initialC)) return { isValid: false, error: "Invalid initial temperature." };
    if (!Number.isFinite(temperatures.ambientC)) return { isValid: false, error: "Invalid ambient temperature." };
    if (!Number.isFinite(temperatures.ambientRadiationC)) return { isValid: false, error: "Invalid ambient radiation temperature." };

    const maxTimeSeconds = simulation.maxTimeSeconds;
    if (!validPositive(maxTimeSeconds)) return { isValid: false, error: "Invalid maximum simulation time." };

    const cooling = simulation.cooling;
    if (!cooling || typeof cooling !== "object") return { isValid: false, error: "Cooling configuration is missing." };
    if (!Number.isFinite(cooling.timeSeconds) || cooling.timeSeconds < 0) return { isValid: false, error: "Cooldown time cannot be negative." };
    if (!Number.isFinite(cooling.convectiveHeatTransferCoefficient) || cooling.convectiveHeatTransferCoefficient < 0) return { isValid: false, error: "Invalid convective cooling coefficient." };

    let finalDt = dtSeconds;
    let finalDx = dxMm;

    if (finalDt === undefined) {
        finalDt = DEFAULT_DT_SECONDS;
    } else if (!Number.isFinite(finalDt) || finalDt <= 0) {
        return { isValid: false, error: "Invalid time step (dtSeconds)." };
    }

    if (finalDx === undefined) {
        finalDx = clamp(thicknessMm / GRID_CELLS_PER_THICKNESS, MIN_DX_MM, MAX_DX_MM);
    } else if (!Number.isFinite(finalDx) || finalDx <= 0) {
        return { isValid: false, error: "Invalid spatial step (dxMm)." };
    }

    return {
        isValid: true,
        dtSeconds: finalDt,
        dxMm: finalDx
    };
}

function createGrid(thicknessM, requestedDxM) {
    const nodeCount = Math.max(5, Math.round(thicknessM / requestedDxM) + 1);
    const dx = thicknessM / (nodeCount - 1);
    return { nodeCount, dx };
}

/* =========================
 * THERMAL PHYSICS MODEL
 * ========================= */
export function getHeaterTemperatureC({ side, ambientTemperatureC }) {
    return ambientTemperatureC + side.heaterTemperatureFactor * (side.regulatorTemperatureC - ambientTemperatureC);
}

export function calculateIncidentHeaterFlux({ side, surfaceTemperatureC, ambientTemperatureC = 20 }) {
    const T_heater_C = getHeaterTemperatureC({ side, ambientTemperatureC });
    const Th = toKelvin(T_heater_C);
    const Ts = toKelvin(surfaceTemperatureC);

    const epsilon = side.heaterEmissivity;
    const F = side.viewFactor;
    const gain = side.radiationGain;

    return Math.max(0, gain * epsilon * F * SIGMA * (Th * Th * Th * Th - Ts * Ts * Ts * Ts));
}

export function calculateEffectiveIncidentFlux({ side, material, surfaceTemperatureC, ambientTemperatureC = 20 }) {
    const incidentWm2 = calculateIncidentHeaterFlux({ side, surfaceTemperatureC, ambientTemperatureC });
    const reflectance = material.surfaceReflectance;

    return {
        incidentWm2,
        reflectedWm2: incidentWm2 * reflectance,
        effectiveWm2: incidentWm2 * (1 - reflectance)
    };
}

/**
 * Оптимизированный расчет линеаризованных параметров потока без аллокации объектов.
 */
function fillLinearizedFluxParams(side, TsK, ambientTemperatureC, ambRadT, sheetEmissivity, out) {
    const T_heater_C = getHeaterTemperatureC({ side, ambientTemperatureC });
    const T_heater_K = T_heater_C + 273.15;

    const etaBox = side.boxEfficiency;

    const T_box_envC = ambientTemperatureC + etaBox * (T_heater_C - ambientTemperatureC);
    const T_box_envK = T_box_envC + 273.15;

    const h = side.convectiveHeatTransferCoefficient;
    const q_conv = h * (T_box_envK - TsK);
    const dq_conv_dTs = -h;

    const fH = side.viewFactor;
    const envF = side.ambientViewFactor ?? (1 - fH);
    const epsH = side.heaterEmissivity;
    const gain = side.radiationGain;

    const denomH = epsH + sheetEmissivity - epsH * sheetEmissivity;
    const epsEffH = denomH > 0 ? (epsH * sheetEmissivity) / denomH : 0;

    const radA = gain * epsEffH * fH * SIGMA;
    const TsK3 = TsK * TsK * TsK;
    const TsK4 = TsK3 * TsK;

    const q_rad_heater = radA * (T_heater_K * T_heater_K * T_heater_K * T_heater_K - TsK4);
    const dq_rad_heater_dTs = -4 * radA * TsK3;

    const epsBox = side.boxEmissivity;
    const denom = epsBox + sheetEmissivity - epsBox * sheetEmissivity;
    const eps_priv = denom > 0 ? (epsBox * sheetEmissivity) / denom : 0;

    const radEnv = eps_priv * envF * SIGMA;
    const q_rad_box = radEnv * (T_box_envK * T_box_envK * T_box_envK * T_box_envK - TsK4);
    const dq_rad_box_dTs = -4 * radEnv * TsK3;

    const total_q = q_rad_heater + q_conv + q_rad_box;
    const total_dq_dTs = dq_rad_heater_dTs + dq_conv_dTs + dq_rad_box_dTs;

    out.g1 = total_dq_dTs;
    out.g0 = total_q - total_dq_dTs * TsK;
}

function fillCooldownBoundary(tSurfK, epsS, convectiveHeatTransferCoefficient, T_room_K, T_rad_room_K, T_rad_room_K_2, out) {
    const h_rad = epsS * SIGMA * (T_rad_room_K_2 + tSurfK * tSurfK) * (T_rad_room_K + tSurfK);
    out.g0 = convectiveHeatTransferCoefficient * T_room_K + h_rad * T_rad_room_K;
    out.g1 = -(convectiveHeatTransferCoefficient + h_rad);
}

/* =========================
 * TRIDIAGONAL MATRIX SOLVER (OPTIMIZED)
 * ========================= */
function solveTridiagonal(lower, diagonal, upper, rhs, result, cPrime, dPrime) {
    const n = diagonal.length;
    let denom = diagonal[0];

    if (Math.abs(denom) < 1e-20) return false;

    cPrime[0] = upper[0] / denom;
    dPrime[0] = rhs[0] / denom;

    for (let i = 1; i < n; i++) {
        denom = diagonal[i] - lower[i] * cPrime[i - 1];
        if (Math.abs(denom) < 1e-20) return false;

        cPrime[i] = i < n - 1 ? upper[i] / denom : 0;
        dPrime[i] = (rhs[i] - lower[i] * dPrime[i - 1]) / denom;
    }

    result[n - 1] = dPrime[n - 1];
    for (let i = n - 2; i >= 0; i--) {
        result[i] = dPrime[i] - cPrime[i] * result[i + 1];
    }

    return true;
}

/* =========================
 * TARGET TARGETS
 * ========================= */
function isTargetReached(T, target, timeSeconds) {
    if (!target) return false;

    if (target.type === "minTemperature") {
        return T.every(t => t >= target.value);
    }
    if (target.type === "surfaceTemperature") {
        return T[0] >= target.value || T[T.length - 1] >= target.value;
    }
    if (target.type === "time") {
        return timeSeconds >= target.value;
    }
    return false;
}

/* =========================
 * HEATING CORE
 * ========================= */
export function simulateHeating({
                                    nodeCount,
                                    dx,
                                    dt,
                                    matModel,
                                    topSide,
                                    botSide,
                                    ambT,
                                    ambRadT,
                                    epsS,
                                    targetType,
                                    targetValue,
                                    targetK,
                                    decompTempK,
                                    stopAtMaxTemperature = false,
                                    maxTimeSeconds = 1800,
                                    sampleEverySeconds = 1,
                                    storeHistory = false,
                                    initialTemperatureC = 20,
                                    buffers = null
                                }) {
    let status = null;
    let time = 0;
    let decompositionReached = false;

    const simulationMaxTime = targetType === "time" && Number.isFinite(targetValue)
        ? Math.min(maxTimeSeconds, targetValue)
        : maxTimeSeconds;

    const bufs = buffers || {
        lower: new Float64Array(nodeCount),
        diagonal: new Float64Array(nodeCount),
        upper: new Float64Array(nodeCount),
        rhs: new Float64Array(nodeCount),
        Tnext: new Float64Array(nodeCount),
        oldT: new Float64Array(nodeCount),
        cPrime: new Float64Array(nodeCount),
        dPrime: new Float64Array(nodeCount)
    };

    const lower = bufs.lower;
    const diagonal = bufs.diagonal;
    const upper = bufs.upper;
    const rhs = bufs.rhs;
    const cPrime = bufs.cPrime;
    const dPrime = bufs.dPrime;

    let T = new Float64Array(nodeCount).fill(initialTemperatureC + 273.15);
    let oldT = bufs.oldT;
    let Tnext = bufs.Tnext;

    oldT.set(T);
    Tnext.set(T);

    const history = storeHistory ? [] : null;
    const centerIndex = (nodeCount - 1) >> 1;
    const last = nodeCount - 1;

    const fluxBuf = { g0: 0, g1: 0 };

    const getMinC = values => {
        let min = Infinity;
        for (let i = 0; i < values.length; i++) {
            if (values[i] < min) min = values[i];
        }
        return min - 273.15;
    };

    const pushHistory = () => {
        if (!storeHistory) return;
        history.push({
            timeSeconds: time,
            frontSurfaceC: Number(T[0]) - 273.15,
            centerC: Number(T[centerIndex]) - 273.15,
            backSurfaceC: Number(T[last]) - 273.15,
            minTemperatureC: getMinC(T)
        });
    };

    if (storeHistory) pushHistory();

    const dt_div_dx = dt / dx;
    const dt_div_dx2 = dt / (dx * dx);

    while (time < simulationMaxTime) {
        const tempPtr = oldT;
        oldT = T;
        T = tempPtr;

        T.set(oldT);

        let converged = false;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            for (let i = 1; i < last; i++) {
                const props = matModel.get(T[i] - 273.15);
                const r = (dt_div_dx2 * props.k) / (props.density * props.cp);

                lower[i] = upper[i] = -r;
                diagonal[i] = 1 + 2 * r;
                rhs[i] = oldT[i];
            }

            // Top boundary
            const propsTop = matModel.get(T[0] - 273.15);
            fillLinearizedFluxParams(topSide, T[0], ambT, ambRadT, epsS, fluxBuf);
            const invVolTop = 1 / (propsTop.density * propsTop.cp);
            const factorTop = 2 * dt_div_dx * invVolTop;
            const condTop = 2 * propsTop.k * dt_div_dx2 * invVolTop;

            diagonal[0] = 1 + condTop - factorTop * fluxBuf.g1;
            rhs[0] = oldT[0] + factorTop * fluxBuf.g0;
            upper[0] = -condTop;

            // Bottom boundary
            const propsBot = matModel.get(T[last] - 273.15);
            fillLinearizedFluxParams(botSide, T[last], ambT, ambRadT, epsS, fluxBuf);
            const invVolBot = 1 / (propsBot.density * propsBot.cp);
            const factorBot = 2 * dt_div_dx * invVolBot;
            const condBot = 2 * propsBot.k * dt_div_dx2 * invVolBot;

            diagonal[last] = 1 + condBot - factorBot * fluxBuf.g1;
            rhs[last] = oldT[last] + factorBot * fluxBuf.g0;
            lower[last] = -condBot;

            if (!solveTridiagonal(lower, diagonal, upper, rhs, Tnext, cPrime, dPrime)) {
                break;
            }

            converged = true;
            for (let i = 0; i < nodeCount; i++) {
                if (Math.abs(Tnext[i] - T[i]) > NONLINEAR_TOLERANCE_K) {
                    converged = false;
                    break;
                }
            }

            T.set(Tnext);
            if (converged) break;
        }

        if (!converged) {
            status = { type: "error", message: `Diverged at ${time.toFixed(2)}s.` };
            break;
        }

        T.set(Tnext);

        /* =========================
         * DECOMPOSITION
         * ========================= */
        if (decompTempK != null && !decompositionReached) {
            let fraction = 1;
            let reached = false;

            for (let i = 0; i < nodeCount; i++) {
                if (oldT[i] < decompTempK && Tnext[i] >= decompTempK) {
                    const dT = Tnext[i] - oldT[i];
                    if (dT > 0) {
                        const f = (decompTempK - oldT[i]) / dT;
                        if (f >= 0 && f < fraction) fraction = f;
                        reached = true;
                    }
                }
                if (oldT[i] >= decompTempK) {
                    fraction = 0;
                    reached = true;
                }
            }

            if (reached) {
                decompositionReached = true;
                status = { type: "error", message: `Degradation! Temperature  > ${(decompTempK - 273.15).toFixed(0)}°C.` };

                if (stopAtMaxTemperature === true) {
                    time += fraction * dt;
                    for (let i = 0; i < nodeCount; i++) {
                        T[i] = oldT[i] + fraction * (Tnext[i] - oldT[i]);
                    }
                    pushHistory();
                    break;
                }
            }
        }

        /* =========================
         * TARGET
         * ========================= */
        if (targetK != null && targetType !== "time") {
            let fraction = 0;

            if (targetType === "minTemperature") {
                let canReach = true;
                for (let i = 0; i < nodeCount; i++) {
                    if (oldT[i] >= targetK) continue;
                    if (Tnext[i] < targetK) {
                        canReach = false;
                        break;
                    }

                    const dT = Tnext[i] - oldT[i];
                    if (dT <= 0) {
                        canReach = false;
                        break;
                    }
                    fraction = Math.max(fraction, (targetK - oldT[i]) / dT);
                }

                if (canReach && fraction <= 1) {
                    time += fraction * dt;
                    for (let i = 0; i < nodeCount; i++) {
                        T[i] = oldT[i] + fraction * (Tnext[i] - oldT[i]);
                    }
                    pushHistory();
                    break;
                }
            }

            if (targetType === "surfaceTemperature") {
                const surfaces = [0, last];
                for (const i of surfaces) {
                    if (oldT[i] < targetK && Tnext[i] >= targetK) {
                        const dT = Tnext[i] - oldT[i];
                        if (dT > 0) {
                            const f = (targetK - oldT[i]) / dT;
                            if (fraction === 0 || f < fraction) fraction = f;
                        }
                    }
                }

                if (oldT[0] >= targetK || oldT[last] >= targetK) fraction = 0;

                if (fraction >= 0 && fraction <= 1 &&
                    (oldT[0] >= targetK || oldT[last] >= targetK || Tnext[0] >= targetK || Tnext[last] >= targetK)) {
                    time += fraction * dt;
                    for (let i = 0; i < nodeCount; i++) {
                        T[i] = oldT[i] + fraction * (Tnext[i] - oldT[i]);
                    }
                    pushHistory();
                    break;
                }
            }
        }

        time += dt;

        if (storeHistory && (Math.abs(time % sampleEverySeconds) < dt / 2 || time >= simulationMaxTime)) {
            pushHistory();
        }
    }

    const reachedTarget = targetType === "time"
        ? time >= targetValue
        : targetK == null ? false : isTargetReached(T, { type: targetType, value: targetK }, time);

    if (!status && !reachedTarget && time >= simulationMaxTime) {
        if (targetType === "time") {
            status = { type: "error", message: `Timeout: Target time ${targetValue}s not reached.` };
        } else if (targetType) {
            status = { type: "error", message: `Timeout: Target ${targetValue}°C not reached.` };
        }
    }

    if (!status) {
        status = { type: "ok", message: "Compiled successfully." };
    }

    return {
        temperatureProfileK: new Float64Array(T),
        heatingTimeSeconds: time,
        reachedTarget,
        status,
        history,
        buffers: bufs
    };
}

/* =========================
 * COOLDOWN
 * ========================= */
export function simulateCooldown({
                                     initialProfileK,
                                     nodeCount,
                                     dx,
                                     dt,
                                     matModel,
                                     epsS,
                                     ambT,
                                     ambRadT,
                                     cooldownTimeSeconds = 10,
                                     convectiveHeatTransferCoefficient = 7.5,
                                     maxNonlinearIterations = 3,
                                     nonlinearToleranceK = 0.1,
                                     buffers
                                 }) {
    let cooldownTime = 0;

    const lower = buffers.lower;
    const diagonal = buffers.diagonal;
    const upper = buffers.upper;
    const rhs = buffers.rhs;
    const T_cool_next = buffers.Tnext;
    const oldT_cool = buffers.oldT;
    const cPrime = buffers.cPrime;
    const dPrime = buffers.dPrime;

    const T_cool = new Float64Array(initialProfileK);
    const T_room_K = ambT + 273.15;
    const T_rad_room_K = ambRadT + 273.15;
    const T_rad_room_K_2 = T_rad_room_K * T_rad_room_K;

    const last = nodeCount - 1;
    const dt_div_dx = dt / dx;
    const dt_div_dx2 = dt / (dx * dx);

    const fluxBuf = { g0: 0, g1: 0 };

    while (cooldownTime < cooldownTimeSeconds) {
        oldT_cool.set(T_cool);
        let converged = false;

        for (let iter = 0; iter < maxNonlinearIterations; iter++) {
            for (let i = 1; i < last; i++) {
                const props = matModel.get(T_cool[i] - 273.15);
                const r = (dt_div_dx2 * props.k) / (props.density * props.cp);

                lower[i] = upper[i] = -r;
                diagonal[i] = 1 + 2 * r;
                rhs[i] = oldT_cool[i];
            }

            // Top cooldown
            const propsTop = matModel.get(T_cool[0] - 273.15);
            fillCooldownBoundary(T_cool[0], epsS, convectiveHeatTransferCoefficient, T_room_K, T_rad_room_K, T_rad_room_K_2, fluxBuf);
            const invVolTop = 1 / (propsTop.density * propsTop.cp);
            const factorTop = 2 * dt_div_dx * invVolTop;
            const condTop = 2 * propsTop.k * dt_div_dx2 * invVolTop;

            diagonal[0] = 1 + condTop - factorTop * fluxBuf.g1;
            rhs[0] = oldT_cool[0] + factorTop * fluxBuf.g0;
            upper[0] = -condTop;

            // Bottom cooldown
            const propsBot = matModel.get(T_cool[last] - 273.15);
            fillCooldownBoundary(T_cool[last], epsS, convectiveHeatTransferCoefficient, T_room_K, T_rad_room_K, T_rad_room_K_2, fluxBuf);
            const invVolBot = 1 / (propsBot.density * propsBot.cp);
            const factorBot = 2 * dt_div_dx * invVolBot;
            const condBot = 2 * propsBot.k * dt_div_dx2 * invVolBot;

            diagonal[last] = 1 + condBot - factorBot * fluxBuf.g1;
            rhs[last] = oldT_cool[last] + factorBot * fluxBuf.g0;
            lower[last] = -condBot;

            if (!solveTridiagonal(lower, diagonal, upper, rhs, T_cool_next, cPrime, dPrime)) {
                break;
            }

            converged = true;
            for (let i = 0; i < nodeCount; i++) {
                if (Math.abs(T_cool_next[i] - T_cool[i]) > nonlinearToleranceK) {
                    converged = false;
                    break;
                }
            }

            T_cool.set(T_cool_next);
            if (converged) break;
        }

        if (!converged) break;
        cooldownTime += dt;
    }

    return {
        temperatureProfileK: new Float64Array(T_cool),
        cooldownTimeSeconds: cooldownTime
    };
}

/* =========================
 * MAIN SIMULATION
 * ========================= */
export function simulate1DHeating({
                                      thicknessMm,
                                      material,
                                      machine,
                                      simulation,
                                      dxMm,
                                      dtSeconds,
                                      sampleEverySeconds = 1,
                                      storeHistory = false,
                                      includeBreakdown = false
                                  }) {
    const mach = normalizeMachine(machine);

    if (!mach) return makeError("Invalid machine.");

    const validation = validateSimulationParams({
        thicknessMm,
        material,
        machine: mach,
        simulation,
        dxMm,
        dtSeconds
    });

    if (!validation.isValid) return makeError(validation.error);

    const dt = validation.dtSeconds;
    const dx = validation.dxMm / 1000;

    const { nodeCount } = createGrid(thicknessMm / 1000, dx);

    const target = simulation.target;
    const targetType = target.type;
    const targetValue = target.value;

    const temperatures = simulation.temperatures;
    const initT = temperatures.initialC;
    const ambT = temperatures.ambientC;
    const ambRadT = temperatures.ambientRadiationC;

    const maxTimeSeconds = simulation.maxTimeSeconds;

    const cooling = simulation.cooling;
    const cooldownTimeSeconds = cooling.timeSeconds;
    const coolingH = cooling.convectiveHeatTransferCoefficient;

    const stopAtMaxTemperature = simulation.stopAtMaxTemperature === true;

    const maxFormingTemp = material.maxFormingTemp;
    const decompTemp = material.decompositionTemp;
    const decompTempK = toKelvin(decompTemp);

    const matModel = createMaterialModel(material);
    if (!matModel) return makeError("Invalid material model.");

    const buffers = {
        lower: new Float64Array(nodeCount),
        diagonal: new Float64Array(nodeCount),
        upper: new Float64Array(nodeCount),
        rhs: new Float64Array(nodeCount),
        Tnext: new Float64Array(nodeCount),
        oldT: new Float64Array(nodeCount),
        cPrime: new Float64Array(nodeCount),
        dPrime: new Float64Array(nodeCount)
    };

    const targetK = targetType === "minTemperature" || targetType === "surfaceTemperature"
        ? toKelvin(targetValue)
        : null;

    /* =========================
     * HEATING
     * ========================= */
    const heating = simulateHeating({
        nodeCount,
        dx,
        dt,
        matModel,
        topSide: mach.heaters[0],
        botSide: mach.heaters[1],
        ambT,
        ambRadT,
        epsS: material.emissivity,
        targetType,
        targetValue,
        targetK,
        decompTempK,
        stopAtMaxTemperature,
        maxTimeSeconds,
        sampleEverySeconds,
        storeHistory,
        initialTemperatureC: initT,
        buffers
    });

    let status = heating.status;

    if (status?.type === "error" && heating.heatingTimeSeconds === 0) {
        return makeError(status.message);
    }

    const heatingProfileK = heating.temperatureProfileK;

    /* =========================
     * COOLDOWN
     * ========================= */
    const cooldown = simulateCooldown({
        initialProfileK: heatingProfileK,
        nodeCount,
        dx,
        dt,
        matModel,
        epsS: material.emissivity,
        ambT,
        ambRadT,
        cooldownTimeSeconds,
        convectiveHeatTransferCoefficient: coolingH,
        maxNonlinearIterations: MAX_NONLINEAR_ITERATIONS,
        nonlinearToleranceK: NONLINEAR_TOLERANCE_K,
        buffers
    });

    const cooldownProfileK = cooldown.temperatureProfileK;
    const heatingProfileC = new Float64Array(nodeCount);
    const cooldownProfileC = new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
        heatingProfileC[i] = heatingProfileK[i] - 273.15;
        cooldownProfileC[i] = cooldownProfileK[i] - 273.15;
    }

    const centerIndex = (nodeCount - 1) >> 1;
    const centerC = heatingProfileC[centerIndex];
    const frontC = heatingProfileC[0];
    const backC = heatingProfileC[nodeCount - 1];

    let minTemperatureC = Infinity;
    for (let i = 0; i < nodeCount; i++) {
        if (heatingProfileC[i] < minTemperatureC) minTemperatureC = heatingProfileC[i];
    }

    const res = {
        heatingTimeSeconds: heating.heatingTimeSeconds,
        cooldownTimeSec: cooldownTimeSeconds,
        heaterTemperaturesC: {
            top: mach.heaters[0].regulatorTemperatureC,
            bottom: mach.heaters[1].regulatorTemperatureC
        },
        reachedTarget: heating.reachedTarget,
        status,
        temperatureProfile: {
            temperaturesC: heatingProfileC,
            cooldownProfileC,
            dxMm: dx * 1000
        },
        history: heating.history
    };

    if (includeBreakdown) {
        const propsCenter = matModel.get(centerC);
        const diff = propsCenter.k / (propsCenter.density * propsCenter.cp);

        res.diagnostics = {
            nodeCount,
            dxMm: dx * 1000,
            requestedDxMm: validation.dxMm,
            dtSeconds: dt,
            maxStableDtSeconds: 0.5 * dx * dx / diff,
            thermalDiffusivityM2s: diff,
            numericalControl: {
                gridCellsPerThickness: GRID_CELLS_PER_THICKNESS,
                minDxMm: MIN_DX_MM,
                maxDxMm: MAX_DX_MM,
                nonlinearIterations: MAX_NONLINEAR_ITERATIONS,
                nonlinearToleranceK: NONLINEAR_TOLERANCE_K,
                fourierNumber: diff * dt / (dx * dx)
            },
            simulation: {
                target: { type: targetType, value: targetValue },
                ambientTemperatureC: ambT,
                ambientRadiationTemperatureC: ambRadT,
                initialTemperatureC: initT,
                stopAtMaxTemperature,
                maxFormingTemperatureC: maxFormingTemp,
                maxTimeSeconds,
                cooldownTimeSeconds
            },
            target: {
                type: targetType,
                value: targetValue,
                actualCenterC: centerC,
                actualMinTemperatureC: minTemperatureC,
                actualFrontSurfaceC: frontC,
                actualBackSurfaceC: backC,
                maxFormingTemperatureC: maxFormingTemp,
                decompositionC: decompTemp
            },
            heatBalance: {
                top: calculateEffectiveIncidentFlux({
                    side: mach.heaters[0],
                    material,
                    surfaceTemperatureC: frontC,
                    ambientTemperatureC: ambT
                }),
                bottom: calculateEffectiveIncidentFlux({
                    side: mach.heaters[1],
                    material,
                    surfaceTemperatureC: backC,
                    ambientTemperatureC: ambT
                }),
                topRegulatorTemperatureC: mach.heaters[0].regulatorTemperatureC,
                bottomRegulatorTemperatureC: mach.heaters[1].regulatorTemperatureC,
                topHeaterTemperatureC: getHeaterTemperatureC({
                    side: mach.heaters[0],
                    ambientTemperatureC: ambT
                }),
                bottomHeaterTemperatureC: getHeaterTemperatureC({
                    side: mach.heaters[1],
                    ambientTemperatureC: ambT
                }),
                convectionCoefficient: machine.heatTransferCoefficient
            }
        };
    }

    return res;
}

/* =========================
 * ERROR ANALYSIS
 * ========================= */
export function calculateFitError({ simulation, measurements, weights = { surface: 1, center: 1 } }) {
    if (!measurements?.length || !simulation?.history?.length) {
        return { rmseC: Infinity };
    }

    const history = simulation.history;
    let squaredError = 0;
    let count = 0;

    for (const m of measurements) {
        if (!Number.isFinite(m?.timeSeconds)) continue;

        let low = 0;
        let high = history.length - 1;

        while (low < high - 1) {
            const mid = (low + high) >> 1;
            if (history[mid].timeSeconds < m.timeSeconds) low = mid;
            else high = mid;
        }

        const sim = Math.abs(history[low].timeSeconds - m.timeSeconds) < Math.abs(history[high].timeSeconds - m.timeSeconds)
            ? history[low]
            : history[high];

        if (Number.isFinite(m.frontSurfaceC)) {
            squaredError += weights.surface * ((sim.frontSurfaceC - m.frontSurfaceC) ** 2);
            count++;
        }

        if (Number.isFinite(m.centerC)) {
            squaredError += weights.center * ((sim.centerC - m.centerC) ** 2);
            count++;
        }

        if (Number.isFinite(m.backSurfaceC)) {
            squaredError += weights.surface * ((sim.backSurfaceC - m.backSurfaceC) ** 2);
            count++;
        }
    }

    return count === 0
        ? { rmseC: Infinity }
        : { rmseC: Math.sqrt(squaredError / count), sse: squaredError, samples: count };
}

/* =========================
 * CALIBRATION
 * ========================= */
export function fitHeatingParameters({
                                         thicknessMm,
                                         material,
                                         machine,
                                         simulation,
                                         measurements,
                                         dxMm,
                                         dtSeconds,
                                         initial = { radiationGain: 1, heatTransferCoefficient: 10 },
                                         bounds = { radiationGain: [0.05, 5], heatTransferCoefficient: [2, 40] }
                                     }) {
    const validTimes = measurements.map(m => m?.timeSeconds).filter(Number.isFinite);

    if (!validTimes.length) {
        return makeError("Calibration requires at least one valid experimental data check-point.");
    }

    const maxMTime = Math.max(...validTimes);

    const baseSimulation = {
        ...(simulation || {}),
        stopAtMaxTemperature: false,
        target: { type: "time", value: maxMTime },
        maxTimeSeconds: Math.max(Number(simulation?.maxTimeSeconds) || 0, maxMTime + 2)
    };

    const evaluate = (rg, htc) => {
        const fitMachine = {
            ...machine,
            heatTransferCoefficient: htc,
            heaters: machine.heaters.map(h => ({ ...h, radiationGain: rg }))
        };

        const sim = simulate1DHeating({
            thicknessMm,
            material,
            machine: fitMachine,
            simulation: baseSimulation,
            dxMm,
            dtSeconds,
            storeHistory: true
        });

        return calculateFitError({ simulation: sim, measurements }).rmseC;
    };

    let bestRg = clamp(initial.radiationGain, bounds.radiationGain[0], bounds.radiationGain[1]);
    let bestHtc = clamp(initial.heatTransferCoefficient, bounds.heatTransferCoefficient[0], bounds.heatTransferCoefficient[1]);
    let bestErr = evaluate(bestRg, bestHtc);

    let stepRg = 0.2;
    let stepHtc = 2.0;
    const eps = 0.01;

    while (stepRg > eps || stepHtc > eps) {
        let improved = false;

        const dirs = [
            [stepRg, 0],
            [-stepRg, 0],
            [0, stepHtc],
            [0, -stepHtc],
            [stepRg, stepHtc],
            [-stepRg, -stepHtc]
        ];

        for (const [dRg, dHtc] of dirs) {
            const nRg = clamp(bestRg + dRg, bounds.radiationGain[0], bounds.radiationGain[1]);
            const nHtc = clamp(bestHtc + dHtc, bounds.heatTransferCoefficient[0], bounds.heatTransferCoefficient[1]);
            const err = evaluate(nRg, nHtc);

            if (err < bestErr) {
                bestErr = err;
                bestRg = nRg;
                bestHtc = nHtc;
                improved = true;
            }
        }

        if (!improved) {
            stepRg *= 0.5;
            stepHtc *= 0.5;
        }
    }

    return {
        status: { type: "ok", message: "Calibration finished successfully." },
        parameters: { radiationGain: bestRg, heatTransferCoefficient: bestHtc },
        rmseC: bestErr
    };
}
