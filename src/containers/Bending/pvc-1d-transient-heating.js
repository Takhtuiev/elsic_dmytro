/**
 * Optimized 1D transient implicit finite-difference heating model for opaque plastics (PVC).
 * Configuration: Semi-enclosed heater box with ultra-narrow gap (5-6mm).
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 */

export const GRID_CELLS_PER_THICKNESS = 22;
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

    // Если датчик из-за зазора занижает температуру, реальный ТЭН пропорционально горячее (в °C)
    return regulatorTemperatureC * heaterTemperatureFactor;
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
const getLinearizedFluxParams = (side, TsK, ambientTemperatureC, ambientRadiationTemperatureC, sheetEmissivity) => {
    if (!side || !side.enabled) return { g0: 0, g1: 0 };

    const SIGMA = 5.67e-8;

    // --- 1. РЕАЛЬНАЯ ТЕМПЕРАТУРА ТЭНа (С учетом зазора датчика) ---
    const T_heater_C = getHeaterTemperatureC({ side, ambientTemperatureC });
    const T_heater_K = T_heater_C + 273.15;

    // --- 2. ЕДИНЫЙ КОЭФФИЦИЕНТ ЭФФЕКТИВНОСТИ СРЕДЫ КОРОБА (boxEfficiency) ---
    let etaBox = Number.isFinite(side.boxEfficiency) ? side.boxEfficiency : null;
    if (etaBox == null) {
        const isTopBox = side.position === "top" || side.isTop;
        etaBox = isTopBox ? 0.45 : 0.60;
    }
    etaBox = clamp(etaBox, 0, 1);

    // Эмпирическая эффективная температура lumped-модели короба
    const T_box_envC = ambientTemperatureC + etaBox * (T_heater_C - ambientTemperatureC);
    const T_box_envK = T_box_envC + 273.15;

    // --- 3. КОНВЕКТИВНЫЙ ТЕПЛООБМЕН (lumped) ---
    const h = Math.max(0, Number(side.convectiveHeatTransferCoefficient) || 0);
    const q_conv = h * (T_box_envK - TsK);
    const dq_conv_dTs = -h;

    // --- 4. ГЕОМЕТРИЯ ЗАКРЫТОЙ ПОЛОСТИ (Sichtaktoren) ---
    const fH = clamp(Number.isFinite(side.viewFactor) ? side.viewFactor : 0.80, 0, 1);
    const envF = clamp(side.ambientViewFactor ?? (1 - fH), 0, 1);

    // --- 5. ПРЯМОЕ ИЗЛУЧЕНИЕ ТЭНа ---
    const epsH = clamp(Number.isFinite(side.heaterEmissivity) ? side.heaterEmissivity : 0.90, 0, 1);

    // Защищенный коэффициент усиления излучения
    const gain = Math.max(0, Number.isFinite(side.radiationGain) ? side.radiationGain : 1);

    const radA = gain * epsH * sheetEmissivity * fH * SIGMA;
    const q_rad_heater = radA * (T_heater_K ** 4 - TsK ** 4);
    const dq_rad_heater_dTs = -4 * radA * (TsK ** 3);

    // --- 6. ВТОРИЧНОЕ ИЗЛУЧЕНИЕ СТЕНOК КОРОБА ---
    const epsBox = clamp(Number.isFinite(side.boxEmissivity) ? side.boxEmissivity : 0.55, 0, 1);

    const denom = epsBox + sheetEmissivity - epsBox * sheetEmissivity;
    const eps_priv = denom > 0 ? (epsBox * sheetEmissivity) / denom : 0;
    const radEnv = eps_priv * envF * SIGMA;

    const q_rad_box = radEnv * (T_box_envK ** 4 - TsK ** 4);
    const dq_rad_box_dTs = -4 * radEnv * (TsK ** 3);

    // --- 7. РЕЗУЛЬТИРУЮЩИЙ ЛИНЕЙНЫЙ БАЛАНС ДЛЯ МАТРИЦЫ ТОМАСА ---
    const total_q = q_rad_heater + q_conv + q_rad_box;
    const total_dq_dTs = dq_rad_heater_dTs + dq_conv_dTs + dq_rad_box_dTs;

    return {
        g1: total_dq_dTs,
        g0: total_q - total_dq_dTs * TsK
    };
};





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


export function simulateHeating({
                                    nodeCount, dx, dt, matModel, topSide, botSide, ambT, ambRadT, epsS,
                                    targetMinCenterK, decompTempK, maxTimeSeconds = 1800, sampleEverySeconds = 1,
                                    storeHistory = false, initialTemperatureC = 20,
                                    // Передаем буферы памяти снаружи для переиспользования во всех фазах (нагрев + остывание)
                                    buffers = null
                                }) {
    let status = null, time = 0;

    // Инициализируем буферы локально, если они не были переданы снаружи
    const bufs = buffers || {
        lower: new Float64Array(nodeCount),
        diagonal: new Float64Array(nodeCount),
        upper: new Float64Array(nodeCount),
        rhs: new Float64Array(nodeCount),
        Tnext: new Float64Array(nodeCount),
        oldT: new Float64Array(nodeCount)
    };

    const lower = bufs.lower;
    const diagonal = bufs.diagonal;
    const upper = bufs.upper;
    const rhs = bufs.rhs;
    const Tnext = bufs.Tnext;
    const oldT = bufs.oldT;

    const T = new Float64Array(nodeCount).fill(initialTemperatureC + 273.15); // in-place toKelvin
    const history = storeHistory ? [] : null;
    const centerIndex = (nodeCount - 1) >> 1; // Быстрое деление пополам битовым сдвигом
    const last = nodeCount - 1;

    const getBoundary = (side, tVal) => getLinearizedFluxParams(side, tVal, ambT, ambRadT, epsS);

    const getMinC = values => {
        let min = Infinity;
        for (let i = 0; i < values.length; i++) { if (values[i] < min) min = values[i]; }
        return min - 273.15; // in-place toCelsius
    };

    if (storeHistory) {
        history.push({
            timeSeconds: 0,
            frontSurfaceC: T[0] - 273.15,
            centerC: T[centerIndex] - 273.15,
            backSurfaceC: T[last] - 273.15,
            minTemperatureC: getMinC(T)
        });
    }

    const dt_div_dx = dt / dx;
    const dt_div_dx2 = dt / (dx * dx);

    while (time < maxTimeSeconds) {
        // Ранний выход
        if (targetMinCenterK != null && T[0] >= targetMinCenterK) {
            let reached = true;
            for (let i = 1; i < nodeCount; i++) {
                if (T[i] < targetMinCenterK) { reached = false; break; }
            }
            if (reached) break;
        }

        oldT.set(T);
        let converged = false;

        for (let iter = 0; iter < MAX_NONLINEAR_ITERATIONS; iter++) {
            // Внутренние узлы (Оптимизировано арифметикой без вызова toCelsius)
            for (let i = 1; i < last; i++) {
                const props = matModel.get(T[i] - 273.15);
                const r = dt_div_dx2 * props.k / (props.density * props.cp);
                lower[i] = upper[i] = -r;
                diagonal[i] = 1.0 + 2.0 * r;
                rhs[i] = oldT[i];
            }

            // Граничные условия: ВЕРХ (Узел 0)
            const propsTop = matModel.get(T[0] - 273.15);
            const fluxTop = getBoundary(topSide, T[0]);
            const invVolTop = 1.0 / (propsTop.density * propsTop.cp);
            const factorTop = 2.0 * dt_div_dx * invVolTop;
            const condTop = 2.0 * propsTop.k * dt_div_dx2 * invVolTop;

            diagonal[0] = 1.0 + condTop - factorTop * fluxTop.g1;
            rhs[0] = oldT[0] + factorTop * fluxTop.g0;
            upper[0] = -condTop;

            // Граничные условия: НИЗ (Узел last)
            const propsBot = matModel.get(T[last] - 273.15);
            const fluxBot = getBoundary(botSide, T[last]);
            const invVolBot = 1.0 / (propsBot.density * propsBot.cp);
            const factorBot = 2.0 * dt_div_dx * invVolBot;
            const condBot = 2.0 * propsBot.k * dt_div_dx2 * invVolBot;

            diagonal[last] = 1.0 + condBot - factorBot * fluxBot.g1;
            rhs[last] = oldT[last] + factorBot * fluxBot.g0;
            lower[last] = -condBot;

            if (!solveTridiagonal(lower, diagonal, upper, rhs, Tnext)) break;

            converged = true;
            for (let i = 0; i < nodeCount; i++) {
                if (Math.abs(Tnext[i] - T[i]) > NONLINEAR_TOLERANCE_K) { converged = false; break; }
            }
            T.set(Tnext);
            if (converged) break;
        }

        if (!converged) {
            status = { type: "error", message: `Diverged at ${time.toFixed(2)}s.` };
            break;
        }

        // Интерполяция перегрева
        if (decompTempK && (T[0] >= decompTempK || T[last] >= decompTempK)) {
            let fraction = 1.0;
            if (T[0] >= decompTempK && T[0] !== oldT[0]) {
                const f = (decompTempK - oldT[0]) / (T[0] - oldT[0]);
                if (f >= 0 && f < fraction) fraction = f;
            }
            if (T[last] >= decompTempK && T[last] !== oldT[last]) {
                const f = (decompTempK - oldT[last]) / (T[last] - oldT[last]);
                if (f >= 0 && f < fraction) fraction = f;
            }
            time += fraction * dt;
            for (let i = 0; i < nodeCount; i++) T[i] = oldT[i] + fraction * (T[i] - oldT[i]);

            if (storeHistory) {
                history.push({ timeSeconds: time, frontSurfaceC: T[0] - 273.15, centerC: T[centerIndex] - 273.15, backSurfaceC: T[last] - 273.15, minTemperatureC: getMinC(T) });
            }
            status = { type: "error", message: `Degradation! Surface > ${(decompTempK - 273.15).toFixed(0)}°C.` };
            break;
        }

        // Интерполяция целевой температуры
        if (targetMinCenterK != null) {
            let fraction = 0, canReach = true;
            for (let i = 0; i < nodeCount; i++) {
                if (oldT[i] >= targetMinCenterK) continue;
                if (T[i] < targetMinCenterK) { canReach = false; break; }
                const dT = T[i] - oldT[i];
                if (dT <= 0) { canReach = false; break; }
                fraction = Math.max(fraction, (targetMinCenterK - oldT[i]) / dT);
            }
            if (canReach && fraction <= 1.0) {
                time += fraction * dt;
                for (let i = 0; i < nodeCount; i++) T[i] = oldT[i] + fraction * (T[i] - oldT[i]);
                if (storeHistory) {
                    history.push({ timeSeconds: time, frontSurfaceC: T[0] - 273.15, centerC: T[centerIndex] - 273.15, backSurfaceC: T[last] - 273.15, minTemperatureC: getMinC(T) });
                }
                break;
            }
        }

        time += dt;
        if (storeHistory && (Math.abs(time % sampleEverySeconds) < dt / 2.0 || time >= maxTimeSeconds)) {
            history.push({ timeSeconds: time, frontSurfaceC: T[0] - 273.15, centerC: T[centerIndex] - 273.15, backSurfaceC: T[last] - 273.15, minTemperatureC: getMinC(T) });
        }
    }

    const minTemperatureC = getMinC(T);
    const reachedTarget = targetMinCenterK == null || minTemperatureC >= (targetMinCenterK - 273.15);

    if (!status) status = { type: "ok", message: "Compiled successfully." };
    if (!reachedTarget && time >= maxTimeSeconds) {
        status = { type: "error", message: `Timeout: Minimum sheet temperature ${(targetMinCenterK - 273.15).toFixed(0)}°C not reached.` };
    }

    // Создаем копии выходных профилей
    const temperatureProfileK = new Float64Array(T);

    return { temperatureProfileK,  heatingTimeSeconds: time, reachedTarget, status, history, buffers: bufs };
}

/**
 * Высокооптимизированная симуляция свободного остывания листа ПВХ во время переноса.
 * Выделение памяти сведено к нулю за счет переиспользования буферов.
 */
export function simulateCooldown({
                                     initialProfileK, nodeCount, dx, dt, matModel, epsS, ambT, ambRadT,
                                     cooldownTimeSeconds = 10, maxNonlinearIterations = 3, nonlinearToleranceK = 0.1,
                                     buffers // Передаем буферы прогонки из simulate1DHeating
                                 }) {
    let cooldownTime = 0;

    // Инициализируем буферы из переданного объекта (Zero-Allocation)
    const lower = buffers.lower;
    const diagonal = buffers.diagonal;
    const upper = buffers.upper;
    const rhs = buffers.rhs;
    const T_cool_next = buffers.Tnext;
    const oldT_cool = buffers.oldT;

    // Копируем профиль нагрева
    const T_cool = new Float64Array(initialProfileK);

    const T_room_K = ambT + 273.15;
    const T_rad_room_K = ambRadT + 273.15;
    const T_rad_room_K_2 = T_rad_room_K * T_rad_room_K;

    const h_cool = 7.5; // Естественная конвекция свободной пластины
    const last = nodeCount - 1;

    const dt_div_dx = dt / dx;
    const dt_div_dx2 = dt / (dx * dx);

    // Стабильная линеаризация ИК-излучения через эффективный h_rad
    const getCooldownBoundary = tSurfK => {
        // h_rad = eps * sigma * (T_rad_room^2 + Ts^2) * (T_rad_room + Ts)
        const h_rad = epsS * SIGMA * (T_rad_room_K_2 + tSurfK * tSurfK) * (T_rad_room_K + tSurfK);

        // Строгое разложение потока q = g0 + g1 * Ts
        const g0 = h_cool * T_room_K + h_rad * T_rad_room_K;
        const g1 = -(h_cool + h_rad);

        return { g0, g1 };
    };

    while (cooldownTime < cooldownTimeSeconds) {
        oldT_cool.set(T_cool);

        for (let iter = 0; iter < maxNonlinearIterations; iter++) {
            // 1. Внутренние узлы
            for (let i = 1; i < last; i++) {
                const props = matModel.get(T_cool[i] - 273.15);
                const r = dt_div_dx2 * props.k / (props.density * props.cp);
                lower[i] = upper[i] = -r;
                diagonal[i] = 1.0 + 2.0 * r;
                rhs[i] = oldT_cool[i];
            }

            // 2. Верхняя граница (Узел 0)
            const propsTop = matModel.get(T_cool[0] - 273.15);
            const fluxTop = getCooldownBoundary(T_cool[0]);
            const invVolTop = 1.0 / (propsTop.density * propsTop.cp);
            const factorTop = 2.0 * dt_div_dx * invVolTop;
            const condTop = 2.0 * propsTop.k * dt_div_dx2 * invVolTop;

            diagonal[0] = 1.0 + condTop - factorTop * fluxTop.g1;
            rhs[0] = oldT_cool[0] + factorTop * fluxTop.g0;
            upper[0] = -condTop;

            // 3. Нижняя граница (Узел last)
            const propsBot = matModel.get(T_cool[last] - 273.15);
            const fluxBot = getCooldownBoundary(T_cool[last]);
            const invVolBot = 1.0 / (propsBot.density * propsBot.cp);
            const factorBot = 2.0 * dt_div_dx * invVolBot;
            const condBot = 2.0 * propsBot.k * dt_div_dx2 * invVolBot;

            diagonal[last] = 1.0 + condBot - factorBot * fluxBot.g1;
            rhs[last] = oldT_cool[last] + factorBot * fluxBot.g0;
            lower[last] = -condBot;

            if (!solveTridiagonal(lower, diagonal, upper, rhs, T_cool_next)) break;

            let converged = true;
            for (let i = 0; i < nodeCount; i++) {
                if (Math.abs(T_cool_next[i] - T_cool[i]) > nonlinearToleranceK) {
                    converged = false;
                    break;
                }
            }
            T_cool.set(T_cool_next);
            if (converged) break;
        }
        cooldownTime += dt;
    }

    return T_cool;
}




export function simulate1DHeating({
                                      thicknessMm, material, machine, thermalConditions, sides = "both", dxMm, dtSeconds,
                                      maxTimeSeconds = 1800, cooldownTimeSeconds = 10,
                                      target = { minCenterC: null, maxSurfaceC: null },
                                      sampleEverySeconds = 1, storeHistory = false, includeBreakdown = false
                                  }) {
    let status = null;
    const dt = dtSeconds > 0 ? dtSeconds : DEFAULT_DT_SECONDS;
    const { initialTemperatureC: initT = 20, ambientTemperatureC: ambT = 20, ambientRadiationTemperatureC: ambRadT = 20 } = thermalConditions || {};

    if (!validPositive(thicknessMm) || !validPositive(maxTimeSeconds)) {
        status = { type: "error", message: "Invalid geometry/limits." };
    }

    const mach = normalizeMachine(machine);
    if (!status && !mach) status = { type: "error", message: "Invalid machine." };

    const matModel = createMaterialModel(material);
    if (!status && !matModel) status = { type: "error", message: "Invalid material model." };

    const dx = (Number.isFinite(dxMm) && dxMm > 0 ? dxMm : calculateDxMm(status ? 2 : thicknessMm)) / 1000;
    const { nodeCount } = createGrid((status ? 2 : thicknessMm) / 1000, dx);

    // --- ВЫСОКОСКОРОСТНАЯ АЛЛОКАЦИЯ ПАМЯТИ (ОДИН РАЗ НА ВЕСЬ ПРОЦЕСС) ---
    const buffers = {
        lower: new Float64Array(nodeCount),
        diagonal: new Float64Array(nodeCount),
        upper: new Float64Array(nodeCount),
        rhs: new Float64Array(nodeCount),
        Tnext: new Float64Array(nodeCount),
        oldT: new Float64Array(nodeCount)
    };

    const decompTemp = Number(material?.decompositionTemp);
    const decompTempK = decompTemp ? toKelvin(decompTemp) : null;
    const targetMinCenterK = target.minCenterC != null ? toKelvin(target.minCenterC) : null;

    const useTop = sides === "both" || sides === "top" || sides === "one-sided-top";
    const useBot = sides === "both" || sides === "bottom" || sides === "one-sided-bottom";

    // Прокидываем position маркеры для корректного выбора дефолтных boxEfficiency в ядре
    const topSide = mach ? { ...(mach.top || {}), enabled: useTop && !!mach.top, position: "top" } : { enabled: false };
    const botSide = mach ? { ...(mach.bottom || {}), enabled: useBot && !!mach.bottom, position: "bottom" } : { enabled: false };
    const epsS = clamp(material?.emissivity ?? 0.93, 0, 1);

    // 1. ЗАПУСК ОПТИМИЗИРОВАННОГО НАГРЕВА (Пробрасываем наши общие буферы)
    const heating = simulateHeating({
        nodeCount, dx, dt, matModel, topSide, botSide, ambT, ambRadT, epsS,
        targetMinCenterK, decompTempK, maxTimeSeconds, sampleEverySeconds, storeHistory,
        initialTemperatureC: initT, buffers
    });

    status = heating.status;

    // Если на этапе инициализации или геометрии возникла фатальная ошибка, прерываемся без фазы остывания
    if (status && status.type === "error" && heating.heatingTimeSeconds === 0) {
        return makeError(status.message);
    }

    const heatingProfileK = heating.temperatureProfileK;

    // 2. ЗАПУСК ОПТИМИЗИРОВАННОГО ОСТЫВАНИЯ (Переиспользуем те же самые буферы повторно!)
    const cooldownProfileK = simulateCooldown({
        initialProfileK: heatingProfileK,
        nodeCount, dx, dt, matModel, epsS, ambT, ambRadT, cooldownTimeSeconds,
        maxNonlinearIterations: MAX_NONLINEAR_ITERATIONS,
        nonlinearToleranceK: NONLINEAR_TOLERANCE_K,
        buffers
    });

    // ТОЧКА КОНВЕРТАЦИИ В ГРАДУСЫ ЦЕЛЬСИЯ (in-place) ---
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
    const surfC = Math.max(frontC, backC);

    // Оптимизированный in-place поиск минимума без создания функций в цикле
    let minTemperatureC = Infinity;
    for (let i = 0; i < nodeCount; i++) {
        if (heatingProfileC[i] < minTemperatureC) minTemperatureC = heatingProfileC[i];
    }

    if (heating.reachedTarget && target.maxSurfaceC != null && surfC > target.maxSurfaceC) {
        status = { type: "warning", message: `Warning: Surface (${surfC.toFixed(1)}°C) > limit (${target.maxSurfaceC}°C).` };
    }

    // Сохраняем структуру возвращаемого объекта, передавая массив остывания
    const res = {
        heatingTimeSeconds: heating.heatingTimeSeconds,
       reachedTarget: heating.reachedTarget,
        status,
        temperatureProfile: {
            temperaturesC: heatingProfileC,
            cooldownProfileC, // Профиль после 10 секунд переноса (°C)
            cooldownSec: cooldownTimeSeconds,
            dxMm: dx * 1000
        },
        history: heating.history
    };

    // Блок расширенной диагностики
    if (includeBreakdown) {
        const { density = 1400, k = 0.16, cp = 1000 } = matModel?.get(centerC) || {};
        const diff = k / (density * cp);
        const zeroF = { incidentWm2: 0, reflectedWm2: 0, effectiveWm2: 0 };

        res.diagnostics = {
            nodeCount,
            dxMm: dx * 1000,
            requestedDxMm: dxMm || dx * 1000,
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
            target: {
                centerC: target.minCenterC,
                surfaceC: target.maxSurfaceC,
                actualCenterC: centerC,
                actualMinTemperatureC: minTemperatureC,
                actualFrontSurfaceC: frontC,
                actualBackSurfaceC: backC,
                decompositionC: decompTemp
            },
            heatBalance: {
                top: topSide.enabled ? calculateEffectiveIncidentFlux({ side: topSide, material, surfaceTemperatureC: frontC, ambientTemperatureC: ambT }) : zeroF,
                bottom: botSide.enabled ? calculateEffectiveIncidentFlux({ side: botSide, material, surfaceTemperatureC: backC, ambientTemperatureC: ambT }) : zeroF,
                topRegulatorTemperatureC: topSide.regulatorTemperatureC ?? null,
                bottomRegulatorTemperatureC: botSide.regulatorTemperatureC ?? null,
                topHeaterTemperatureC: topSide.enabled ? getHeaterTemperatureC({ side: topSide, ambientTemperatureC: ambT }) : null,
                bottomHeaterTemperatureC: botSide.enabled ? getHeaterTemperatureC({ side: botSide, ambientTemperatureC: ambT }) : null,
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
