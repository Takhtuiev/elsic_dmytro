/**
 * Optimized 1D transient implicit finite-difference heating model for opaque plastics (PVC).
 * Configuration: Semi-enclosed heater box with ultra-narrow gap (5-6mm).
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 */

export const GRID_CELLS_PER_THICKNESS = 22;
export const MIN_DX_MM = 0.25;
export const MAX_DX_MM = 1.5;
export const DEFAULT_DT_SECONDS = 0.2;
export const MAX_NONLINEAR_ITERATIONS = 3;
export const NONLINEAR_TOLERANCE_K = 0.1;
export const SIGMA = 5.670374419e-8;

/* =========================
 * MATHEMATICAL HELPERS
 * ========================= */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const toKelvin = c => c + 273.15;
const toCelsius = k => k - 273.15;
const validPositive = v => Number.isFinite(v) && v > 0;

const getProperty = (property, temperatureC) =>
    typeof property === "function" ? property(temperatureC) : property;

function getMaterialProperties(material, temperatureC) {
    return {
        density: getProperty(material?.density, temperatureC),
        k: getProperty(material?.thermalConductivity, temperatureC),
        cp: getProperty(material?.specificHeat, temperatureC)
    };
}

function createMaterialModel(material) {
    if (!material || typeof material !== "object") return null;
    const constant =
        typeof material.density !== "function" &&
        typeof material.thermalConductivity !== "function" &&
        typeof material.specificHeat !== "function";
    const properties = constant ? getMaterialProperties(material, 20) : null;
    return {
        constant,
        properties,
        get: temperatureC => constant ? properties : getMaterialProperties(material, temperatureC)
    };
}

const makeError = (message, extra = {}) => ({
    status: { type: "error", message },
    heatingTimeSeconds: 0,
    reachedTarget: false,
    temperatureProfile: [],
    ...extra
});

export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object") return null;
    if (!Array.isArray(machine.heaters) || machine.heaters.length < 1 || machine.heaters.length > 2) return null;
    const top = { ...machine.heaters[0] };
    const bottom = machine.heaters.length === 2 ? { ...top, ...(machine.heaters[1] || {}) } : null;
    return { ...machine, top, bottom };
}

function calculateDxMm(thicknessMm) {
    return clamp(thicknessMm / GRID_CELLS_PER_THICKNESS, MIN_DX_MM, MAX_DX_MM);
}

function createGrid(thicknessM, requestedDxM) {
    const nodeCount = Math.max(5, Math.round(thicknessM / requestedDxM) + 1);
    const dx = thicknessM / (nodeCount - 1);
    const x = new Float64Array(nodeCount);
    for (let i = 0; i < nodeCount; i++) x[i] = i * dx;
    return { nodeCount, dx, x };
}

/* =========================
 * THERMAL PHYSICS MODEL
 * ========================= */
export function getHeaterTemperatureC({ side, ambientTemperatureC }) {
    const regulatorTemperatureC = Number.isFinite(side.regulatorTemperatureC) ? side.regulatorTemperatureC : ambientTemperatureC;
    const heaterTemperatureFactor = Number.isFinite(side.heaterTemperatureFactor) ? side.heaterTemperatureFactor : 1;
    return ambientTemperatureC + heaterTemperatureFactor * (regulatorTemperatureC - ambientTemperatureC);
}

export function calculateIncidentHeaterFlux({ side, surfaceTemperatureC, ambientTemperatureC = 20 }) {
    if (!side.enabled) return 0;
    if (side.radiationMode === "heatFlux") return Math.max(0, Number(side.heatFluxWm2) || 0);

    const Th = toKelvin(getHeaterTemperatureC({ side, ambientTemperatureC }));
    const Ts = toKelvin(surfaceTemperatureC);
    const epsilon = clamp(Number.isFinite(side.heaterEmissivity) ? side.heaterEmissivity : 0, 0, 1);
    const F = clamp(Number.isFinite(side.viewFactor) ? side.viewFactor : 0, 0, 1);
    const gain = Number.isFinite(side.radiationGain) ? side.radiationGain : 1;

    return Math.max(0, gain * epsilon * F * SIGMA * (Th ** 4 - Ts ** 4));
}

export function calculateEffectiveIncidentFlux({ side, material, surfaceTemperatureC, ambientTemperatureC = 20 }) {
    const incidentWm2 = calculateIncidentHeaterFlux({ side, surfaceTemperatureC, ambientTemperatureC });
    const reflectance = clamp(
        Number.isFinite(side.surfaceReflectance) ? side.surfaceReflectance : Number(material?.surfaceReflectance) || 0,
        0, 0.999999
    );
    return { incidentWm2, reflectedWm2: incidentWm2 * reflectance, effectiveWm2: incidentWm2 * (1 - reflectance) };
}

/**
 * Физически точная линеаризация потоков для закрытого сзади короба с узким зазором 5мм.
 */
function getLinearizedFluxParams(side, TsK, ambientTemperatureC, ambientRadiationTemperatureC, sheetEmissivity, viewFactor) {
    if (!side.enabled) return { g0: 0, g1: 0 };

    const h = Math.max(0, Number(side.convectiveHeatTransferCoefficient) || 0);
    const TboxK = toKelvin(Number.isFinite(side.regulatorTemperatureC) ? side.regulatorTemperatureC : ambientTemperatureC);

    const q_conv = h * (TboxK - TsK);
    const dq_conv_dTs = -h;

    let q_rad_heater = 0;
    let dq_rad_heater_dTs = 0;

    const ThK = toKelvin(getHeaterTemperatureC({ side, ambientTemperatureC }));
    const epsH = clamp(Number.isFinite(side.heaterEmissivity) ? side.heaterEmissivity : 0, 0, 1);

    // ИСПОЛЬЗУЕМ ВНЕШНИЙ АРГУМЕНТ viewFactor ТУТ:
    const fH = clamp(viewFactor, 0, 1);
    const radA = (Number.isFinite(side.radiationGain) ? side.radiationGain : 1) * epsH * fH * SIGMA;

    if (side.radiationMode !== "heatFlux") {
        q_rad_heater = Math.max(0, radA * (ThK ** 4 - TsK ** 4));
        if (ThK > TsK) dq_rad_heater_dTs = -4 * radA * (TsK ** 3);
    } else {
        q_rad_heater = Math.max(0, Number(side.heatFluxWm2) || 0);
    }

    // И ТУТ ТОЖЕ ИСПОЛЬЗУЕМ ЕГО ДЛЯ ОСТАТКА ПОЛУСФЕРЫ:
    const envF = clamp(side.ambientViewFactor ?? (1 - fH), 0, 1);
    const radEnv = sheetEmissivity * envF * SIGMA;

    const q_rad_box = radEnv * (TboxK ** 4 - TsK ** 4);
    const dq_rad_box_dTs = -4 * radEnv * (TsK ** 3);

    return {
        g1: dq_rad_heater_dTs + dq_conv_dTs + dq_rad_box_dTs,
        g0: (q_rad_heater + q_conv + q_rad_box) - (dq_rad_heater_dTs + dq_conv_dTs + dq_rad_box_dTs) * TsK
    };
}


/* =========================
 * TRIDIAGONAL MATRIX SOLVER (THOMAS ALGORITHM)
 * ========================= */
function solveTridiagonal(lower, diagonal, upper, rhs, result) {
    const n = diagonal.length;
    const cPrime = new Float64Array(n);
    const dPrime = new Float64Array(n);
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
 * MAIN SIMULATION RUNNER
 * ========================= */
export function simulate1DHeating({
                                      thicknessMm, material, machine, thermalConditions, sides = "both", dxMm, dtSeconds,
                                      maxTimeSeconds = 1800, target = { minCenterC: null, maxSurfaceC: null },
                                      sampleEverySeconds = 1, storeHistory = false, includeBreakdown = false
                                  }) {
    let status = null, time = 0, dt = dtSeconds > 0 ? dtSeconds : DEFAULT_DT_SECONDS;
    const { initialTemperatureC: initT = 20, ambientTemperatureC: ambT = 20, ambientRadiationTemperatureC: ambRadT = 20 } = thermalConditions || {};

    if (!validPositive(thicknessMm) || !validPositive(maxTimeSeconds)) status = { type: "error", message: "Invalid geometry/limits." };
    const mach = normalizeMachine(machine);
    if (!status && !mach) status = { type: "error", message: "Invalid machine." };
    const matModel = createMaterialModel(material);
    if (!status && !matModel) status = { type: "error", message: "Invalid material model." };

    const dx = (Number.isFinite(dxMm) && dxMm > 0 ? dxMm : calculateDxMm(status ? 2 : thicknessMm)) / 1000;
    const { nodeCount } = createGrid((status ? 2 : thicknessMm) / 1000, dx);
    const centerIndex = Math.floor((nodeCount - 1) / 2), decompTemp = Number(material?.decompositionTemp);

    const [useTop, useBot] = ["both", sides].flatMap(s => [sides === s || sides === "top" || sides === "one-sided-top", sides === s || sides === "bottom" || sides === "one-sided-bottom"]);
    const topSide = mach ? { ...(mach.top || {}), enabled: useTop && !!mach.top } : { enabled: false };
    const botSide = mach ? { ...(mach.bottom || {}), enabled: useBot && !!mach.bottom } : { enabled: false };
    const epsS = clamp(material?.emissivity ?? 0.93, 0, 1);

    const T = new Float64Array(nodeCount).fill(toKelvin(initT)), Tnext = new Float64Array(nodeCount), oldT = new Float64Array(nodeCount);
    const [lower, diagonal, upper, rhs] = Array.from({ length: 4 }, () => new Float64Array(nodeCount));
    const history = storeHistory ? [] : null;

    const getBoundary = (side, tVal) => getLinearizedFluxParams(side, tVal, ambT, ambRadT, epsS, clamp(side.ambientViewFactor ?? (1 - clamp(side.viewFactor ?? 0, 0, 1)), 0, 1));
    const checkTarget = () => target.minCenterC == null || toCelsius(T[centerIndex]) >= target.minCenterC;

    if (storeHistory) history.push({ timeSeconds: 0, frontSurfaceC: toCelsius(T[0]), centerC: toCelsius(T[centerIndex]), backSurfaceC: toCelsius(T[nodeCount - 1]) });

    while (!status && time < maxTimeSeconds) {
        if (checkTarget()) break;
        oldT.set(T);
        let converged = false;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            for (let i = 1; i < nodeCount - 1; i++) {
                const { density, k, cp } = matModel.get(toCelsius(T[i]));
                const r = dt * k / (density * cp * dx * dx);
                lower[i] = upper[i] = -r; diagonal[i] = 1 + 2 * r; rhs[i] = oldT[i];
            }
            [[0, topSide, 1], [nodeCount - 1, botSide, -1]].forEach(([i, side, sign]) => {
                const props = matModel.get(toCelsius(T[i])), flux = getBoundary(side, T[i]);
                const factor = 2 * dt / (props.density * props.cp * dx), cond = 2 * props.k * dt / (props.density * props.cp * dx * dx);
                diagonal[i] = 1 + cond - factor * flux.g1; rhs[i] = oldT[i] + factor * flux.g0;
                if (sign === 1) upper[0] = -cond; else lower[i] = -cond;
            });

            if (!solveTridiagonal(lower, diagonal, upper, rhs, Tnext)) break;
            if ((converged = Tnext.every((val, i) => Math.abs(val - T[i]) <= NONLINEAR_TOLERANCE_K))) { T.set(Tnext); break; }
            T.set(Tnext);
        }

        if (!converged) status = { type: "error", message: `Diverged at ${time.toFixed(2)}s.` };
        else if (decompTemp && (toCelsius(T[0]) >= decompTemp || toCelsius(T[nodeCount - 1]) >= decompTemp)) status = { type: "error", message: `Degradation! Surface > ${decompTemp}°C.` };
        else {
            time += dt;
            if (storeHistory && Math.abs(time % sampleEverySeconds) < dt / 2) history.push({ timeSeconds: time, frontSurfaceC: toCelsius(T[0]), centerC: toCelsius(T[centerIndex]), backSurfaceC: toCelsius(T[nodeCount - 1]) });
        }
    }

    const [reachedTarget, centerC, frontC, backC] = [checkTarget(), toCelsius(T[centerIndex]), toCelsius(T[0]), toCelsius(T[nodeCount - 1])];
    const surfC = Math.max(frontC, backC);

    if (!status) {
        status = { type: "ok", message: "Compiled successfully." };
        if (!reachedTarget && time >= maxTimeSeconds) status = { type: "error", message: `Timeout: Center (${target.minCenterC}°C) not reached within ${(maxTimeSeconds / 60).toFixed(0)} min. Current: ${centerC.toFixed(1)}°C.` };
        else if (reachedTarget && target.maxSurfaceC && surfC > target.maxSurfaceC) status = { type: "warning", message: `Warning: Surface (${surfC.toFixed(1)}°C) > limit (${target.maxSurfaceC}°C).` };
    }

    const res = { heatingTimeSeconds: time, reachedTarget, status, temperatureProfile: Array.from(T, (tk, i) => ({ xMm: i * dx * 1000, temperatureC: toCelsius(tk) })), history };

    if (includeBreakdown) {
        const { density = 1400, k = 0.16, cp = 1000 } = matModel?.get(centerC) || {};
        const diff = k / (density * cp), zeroF = { incidentWm2: 0, reflectedWm2: 0, effectiveWm2: 0 };
        res.diagnostics = {
            nodeCount, dxMm: dx * 1000, requestedDxMm: dxMm || dx * 1000, dtSeconds: dt, maxStableDtSeconds: 0.5 * dx * dx / diff, thermalDiffusivityM2s: diff,
            numericalControl: { gridCellsPerThickness: GRID_CELLS_PER_THICKNESS, minDxMm: MIN_DX_MM, maxDxMm: MAX_DX_MM, nonlinearIterations: MAX_NONLINEAR_ITERATIONS, nonlinearToleranceK: NONLINEAR_TOLERANCE_K, fourierNumber: diff * dt / (dx * dx) },
            target: { centerC: target.minCenterC, surfaceC: target.maxSurfaceC, actualCenterC: centerC, actualFrontSurfaceC: frontC, actualBackSurfaceC: backC, decompositionC: decompTemp },
            heatBalance: {
                top: topSide.enabled ? calculateEffectiveIncidentFlux({ side: topSide, material, surfaceTemperatureC: frontC, ambientTemperatureC: ambT }) : zeroF,
                bottom: botSide.enabled ? calculateEffectiveIncidentFlux({ side: botSide, material, surfaceTemperatureC: backC, ambientTemperatureC: ambT }) : zeroF,
                topRegulatorTemperatureC: topSide.regulatorTemperatureC ?? null, bottomRegulatorTemperatureC: botSide.regulatorTemperatureC ?? null,
                topHeaterTemperatureC: topSide.enabled ? getHeaterTemperatureC({ side: topSide, ambientTemperatureC: ambT }) : null, bottomHeaterTemperatureC: botSide.enabled ? getHeaterTemperatureC({ side: botSide, ambientTemperatureC: ambT }) : null,
                convectionCoefficient: mach ? Math.max(0, Number(mach.heatTransferCoefficient) || 0) : 0
            }
        };
    }
    return res;
}

/* =========================
 * OPTIMIZED ERROR ANALYSIS (BINARY SEARCH MATCHING)
 * ========================= */
export function calculateFitError({ simulation, measurements, weights = { surface: 1, center: 1 } }) {
    if (!measurements?.length || !simulation?.history?.length) return { rmseC: Infinity };

    const history = simulation.history;
    let squaredError = 0;
    let count = 0;

    for (const m of measurements) {
        if (!Number.isFinite(m?.timeSeconds)) continue;

        let low = 0, high = history.length - 1;
        while (low < high - 1) {
            const mid = (low + high) >> 1;
            if (history[mid].timeSeconds < m.timeSeconds) low = mid;
            else high = mid;
        }
        const sim = Math.abs(history[low].timeSeconds - m.timeSeconds) < Math.abs(history[high].timeSeconds - m.timeSeconds)
            ? history[low] : history[high];

        if (Number.isFinite(m.frontSurfaceC)) { squaredError += weights.surface * ((sim.frontSurfaceC - m.frontSurfaceC) ** 2); count++; }
        if (Number.isFinite(m.centerC)) { squaredError += weights.center * ((sim.centerC - m.centerC) ** 2); count++; }
        if (Number.isFinite(m.backSurfaceC)) { squaredError += weights.surface * ((sim.backSurfaceC - m.backSurfaceC) ** 2); count++; }
    }

    return count === 0 ? { rmseC: Infinity } : { rmseC: Math.sqrt(squaredError / count), sse: squaredError, samples: count };
}

/* =========================
 * METRIC CALIBRATION ALGORITHM (HOOKE-JEEVES OPTIMIZATION)
 * ========================= */
export function fitHeatingParameters({
                                         thicknessMm, material, machine, thermalConditions, sides = "both", measurements,
                                         initial = { radiationGain: 1, heatTransferCoefficient: 10 },
                                         bounds = { radiationGain: [0.05, 5], heatTransferCoefficient: [2, 40] }
                                     }) {
    const validTimes = measurements.map(m => m?.timeSeconds).filter(Number.isFinite);
    if (!validTimes.length) return makeError("Calibration requires at least one valid experimental data check-point.");
    const maxMTime = Math.max(...validTimes);

    const evaluate = (rg, htc) => {
        const fitMachine = {
            ...machine, heatTransferCoefficient: htc,
            heaters: machine.heaters.map(h => ({ ...h, radiationGain: rg }))
        };
        const sim = simulate1DHeating({
            thicknessMm, material, machine: fitMachine, thermalConditions, sides,
            maxTimeSeconds: maxMTime + 2, storeHistory: true, target: { minCenterC: null }
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
            [stepRg, 0], [-stepRg, 0], [0, stepHtc], [0, -stepHtc],
            [stepRg, stepHtc], [-stepRg, -stepHtc]
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
