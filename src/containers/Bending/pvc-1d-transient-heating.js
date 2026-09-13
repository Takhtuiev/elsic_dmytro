/**
 * 1D transient finite-difference heating model for Opaque Plastics (PVC + Heating Elements).
 *
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 *
 * Heating: Surface-applied effective IR radiation flux + convection
 * Losses: Convection + ambient radiation
 * Calibration: radiationGain, h
 */

export const SIGMA = 5.670374419e-8;

/* =========================
 * MACHINE
 * ========================= */

export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object") {
        throw new Error("machine must be an object");
    }

    if (!Array.isArray(machine.heaters) ||
        machine.heaters.length < 1 ||
        machine.heaters.length > 2) {
        throw new Error("machine.heaters must contain 1 or 2 heaters");
    }

    const top = {...machine.heaters[0]};
    const bottom = machine.heaters.length === 2
        ? {...top, ...(machine.heaters[1] || {})}
        : null;

    return {...machine, top, bottom};
}

/* =========================
 * HELPERS
 * ========================= */

const clamp = (v,min,max) => Math.min(max,Math.max(min,v));

const positiveNumber = (v,name) => {
    if (!Number.isFinite(v) || v <= 0) {
        throw new Error(`${name} must be > 0`);
    }
    return v;
};

const toKelvin = c => c + 273.15;
const toCelsius = k => k - 273.15;
const getProperty = (p,T) => typeof p === "function" ? p(T) : p;

function getMaterialProperties(material,temperatureC) {
    return {
        density: positiveNumber(
            getProperty(material.density,temperatureC),
            "material.density"
        ),
        k: positiveNumber(
            getProperty(material.thermalConductivity,temperatureC),
            "material.thermalConductivity"
        ),
        cp: positiveNumber(
            getProperty(material.specificHeat,temperatureC),
            "material.specificHeat"
        )
    };
}

/* Cache constant material properties. */
function createMaterialModel(material) {
    const constant =
        typeof material.density !== "function" &&
        typeof material.thermalConductivity !== "function" &&
        typeof material.specificHeat !== "function";

    const properties = constant
        ? getMaterialProperties(material,20)
        : null;

    return {
        constant,
        properties,
        get: temperatureC =>
            constant
                ? properties
                : getMaterialProperties(material,temperatureC)
    };
}

/* =========================
 * RADIATION / CONVECTION
 * ========================= */

/* Calibrated heater -> sheet radiation. */
export function calculateHeaterRadiationFlux({
                                                 heaterTemperatureC,
                                                 surfaceTemperatureC,
                                                 heaterEmissivity,
                                                 viewFactor,
                                                 radiationGain
                                             }) {
    const Th = toKelvin(heaterTemperatureC);
    const Ts = toKelvin(surfaceTemperatureC);

    return Math.max(
        0,
        radiationGain *
        heaterEmissivity *
        viewFactor *
        SIGMA *
        (Th ** 4 - Ts ** 4)
    );
}

/* Sheet -> ambient radiation loss. */
export function calculateAmbientRadiationLoss({
                                                  surfaceTemperatureC,
                                                  ambientRadiationTemperatureC,
                                                  sheetEmissivity,
                                                  ambientViewFactor
                                              }) {
    const Ts = toKelvin(surfaceTemperatureC);
    const Ta = toKelvin(ambientRadiationTemperatureC);

    return sheetEmissivity *
        ambientViewFactor *
        SIGMA *
        (Ts ** 4 - Ta ** 4);
}

/* Positive = heat enters sheet. */
export function calculateConvectionFlux({
                                            surfaceTemperatureC,
                                            ambientTemperatureC,
                                            heatTransferCoefficient
                                        }) {
    return heatTransferCoefficient *
        (ambientTemperatureC - surfaceTemperatureC);
}

/* =========================
 * GRID
 * ========================= */

function createGrid(thicknessM,requestedDxM) {
    const nodeCount = Math.max(
        5,
        Math.round(thicknessM / requestedDxM) + 1
    );

    const dx = thicknessM / (nodeCount - 1);
    const x = new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
        x[i] = i * dx;
    }

    return {nodeCount,dx,x};
}

/* =========================
 * SIDES
 * ========================= */

function resolveSides({sides,machine}) {
    const useTop =
        sides === "both" ||
        sides === "top" ||
        sides === "one-sided-top";

    const useBottom =
        sides === "both" ||
        sides === "bottom" ||
        sides === "one-sided-bottom";

    return {
        top: {
            ...(machine.top || {}),
            enabled: useTop && !!machine.top
        },
        bottom: {
            ...(machine.bottom || {}),
            enabled: useBottom && !!machine.bottom
        }
    };
}
/* =========================
 * HEATER
 * ========================= */

/* Incident heater power before surface reflection. */
export function calculateIncidentHeaterFlux({
                                                side,
                                                surfaceTemperatureC
                                            }) {
    if (!side.enabled) return 0;

    if (side.radiationMode === "heatFlux") {
        return Math.max(0,Number(side.heatFluxWm2) || 0);
    }

    return calculateHeaterRadiationFlux({
        heaterTemperatureC: side.heaterTemperatureC,
        surfaceTemperatureC,
        heaterEmissivity: side.heaterEmissivity,
        viewFactor: side.viewFactor,
        radiationGain: side.radiationGain
    });
}

/* Apply surface reflection. */
export function calculateEffectiveIncidentFlux({
                                                   side,
                                                   material,
                                                   surfaceTemperatureC
                                               }) {
    const incidentWm2 =
        calculateIncidentHeaterFlux({
            side,
            surfaceTemperatureC
        });

    const reflectance = clamp(
        Number.isFinite(side.surfaceReflectance)
            ? side.surfaceReflectance
            : Number(material.surfaceReflectance) || 0,
        0,
        0.999999
    );

    const reflectedWm2 = incidentWm2 * reflectance;

    return {
        incidentWm2,
        reflectedWm2,
        effectiveWm2: incidentWm2 - reflectedWm2
    };
}

/* =========================
 * TARGET / HISTORY
 * ========================= */

function targetReached({T,centerIndex,target}) {
    const frontC = toCelsius(T[0]);
    const centerC = toCelsius(T[centerIndex]);
    const backC = toCelsius(T[T.length - 1]);

    const DECOMPOSITION_TEMP = 180; // Критическая точка деструкции ПВХ
    const MAX_SAFE_SURFACE = 145;   // Предел во избежание пузырей

    // Аварийная защита от порчи заготовки
    if (frontC >= DECOMPOSITION_TEMP || backC >= DECOMPOSITION_TEMP) {
        throw new Error(
            `Критический брак: Поверхность ПВХ нагрелась до температуры деструкции (${DECOMPOSITION_TEMP}°C)! ` +
            `Центр при этом успел прогреться только до ${centerC.toFixed(1)}°C. ` +
            `Решение: Снизьте температуру ТЭНов на регуляторе или увеличьте зазор.`
        );
    }

    // Успешный критерий окончания нагрева под гибку
    return (
        (target.minCenterC == null || centerC >= target.minCenterC) &&
        frontC <= MAX_SAFE_SURFACE &&
        backC <= MAX_SAFE_SURFACE
    );
}

function saveHistorySample({
                               T,
                               centerIndex,
                               history,
                               time
                           }) {
    let minC = Infinity;
    let maxC = -Infinity;

    for (let i = 0; i < T.length; i++) {
        const c = toCelsius(T[i]);
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }

    history.push({
        timeSeconds: time,
        frontSurfaceC: toCelsius(T[0]),
        centerC: toCelsius(T[centerIndex]),
        backSurfaceC: toCelsius(T[T.length - 1]),
        minC,
        maxC,
        gradientC: maxC - minC
    });
}

/* =========================
 * MAIN SOLVER
 * ========================= */

export function simulate1DHeating({
                                      thicknessMm,
                                      material,
                                      machine,
                                      thermalConditions,
                                      sides,
                                      dxMm,
                                      dtSeconds,
                                      maxTimeSeconds,
                                      target,
                                      sampleEverySeconds,
                                      storeHistory,
                                      includeBreakdown
                                  }) {
    positiveNumber(thicknessMm,"thicknessMm");
    positiveNumber(dxMm,"dxMm");
    positiveNumber(dtSeconds,"dtSeconds");
    positiveNumber(maxTimeSeconds,"maxTimeSeconds");

    if (storeHistory) {
        positiveNumber(sampleEverySeconds,"sampleEverySeconds");
    }

    const normalizedMachine = normalizeMachine(machine);

    const {
        initialTemperatureC,
        ambientTemperatureC,
        ambientRadiationTemperatureC
    } = thermalConditions;

    if (!Number.isFinite(initialTemperatureC)) throw new Error("initialTemperatureC must be finite");
    if (!Number.isFinite(ambientTemperatureC)) throw new Error("ambientTemperatureC must be finite");
    if (!Number.isFinite(ambientRadiationTemperatureC)) throw new Error("ambientRadiationTemperatureC must be finite");

    const thicknessM = thicknessMm / 1000;
    const {nodeCount,dx,x} = createGrid(thicknessM,dxMm / 1000);

    const materialModel = createMaterialModel(material);
    const initialProperties = materialModel.get(initialTemperatureC);

    const thermalDiffusivity = initialProperties.k / (initialProperties.density * initialProperties.cp);

    /* Явный критерий устойчивости схемы с запасом для надежности */
    const maxStableDt = 0.43 * dx * dx / thermalDiffusivity;
    const dt = Math.min(dtSeconds,maxStableDt);

    const {top: topSide,bottom: bottomSide} = resolveSides({
        sides,
        machine: normalizedMachine
    });

    const h = Math.max(0, Number(normalizedMachine.heatTransferCoefficient) || 0);

    const sheetEmissivity = clamp(
        Number.isFinite(material.emissivity) ? material.emissivity : 0.93,
        0,
        1
    );

    const topAmbientViewFactor = clamp(
        Number.isFinite(topSide.ambientViewFactor)
            ? topSide.ambientViewFactor
            : 1 - clamp(Number(topSide.viewFactor) || 0, 0, 1),
        0,
        1
    );

    const bottomAmbientViewFactor = clamp(
        Number.isFinite(bottomSide.ambientViewFactor)
            ? bottomSide.ambientViewFactor
            : 1 - clamp(Number(bottomSide.viewFactor) || 0, 0, 1),
        0,
        1
    );

    const T = new Float64Array(nodeCount);
    const Tnext = new Float64Array(nodeCount);

    T.fill(toKelvin(initialTemperatureC));

    const centerIndex = Math.floor((nodeCount - 1) / 2);

    let time = 0;
    let reachedTarget = targetReached({ T, centerIndex, target });

    let nextSampleTime = storeHistory ? sampleEverySeconds : Infinity;
    const history = storeHistory ? [] : null;

    if (storeHistory) {
        saveHistorySample({ T, centerIndex, history, time });
    }

    /* =========================
 * TIME INTEGRATION
 * ========================= */

    /* =========================
     * TIME INTEGRATION (АВТОМАТИЧЕСКИЙ ВОЗДУХ)
     * ========================= */

    /* =========================
 * TIME INTEGRATION (ДИНАМИЧЕСКИЙ ВОЗДУХ С КОЭФФИЦИЕНТОМ)
 * ========================= */

    while (!reachedTarget && time < maxTimeSeconds) {
        const topSurfaceC = toCelsius(T[0]);
        const bottomSurfaceC = toCelsius(T[nodeCount - 1]);

        // Эффективный лучистый приток тепла от ТЭНов падает строго на поверхности
        const topIncident = topSide.enabled
            ? calculateEffectiveIncidentFlux({
                side: topSide,
                material,
                surfaceTemperatureC: topSurfaceC
            }).effectiveWm2
            : 0;

        const bottomIncident = bottomSide.enabled
            ? calculateEffectiveIncidentFlux({
                side: bottomSide,
                material,
                surfaceTemperatureC: bottomSurfaceC
            }).effectiveWm2
            : 0;

        // Извлекаем кастомные коэффициенты прогрева воздуха из объекта нагревателя (дефолт = 0.70)
        const topFactor = Number.isFinite(topSide.airTemperatureFactor) ? topSide.airTemperatureFactor : 0.70;
        const bottomFactor = Number.isFinite(bottomSide.airTemperatureFactor) ? bottomSide.airTemperatureFactor : 0.70;

        // Динамический расчет раскаленного воздуха в зазоре на основе кастомного фактора
        const topAirC = topSide.enabled
            ? topSurfaceC + topFactor * (topSide.heaterTemperatureC - topSurfaceC)
            : thermalConditions.ambientTemperatureC;

        const bottomAirC = bottomSide.enabled
            ? bottomSurfaceC + bottomFactor * (bottomSide.heaterTemperatureC - bottomSurfaceC)
            : thermalConditions.ambientTemperatureC;

        /* 1. Внутренние узлы: только чистая теплопроводность (ПВХ непрозрачен) */
        for (let i = 1; i < nodeCount - 1; i++) {
            const temperatureC = toCelsius(T[i]);
            const {density,k,cp} = materialModel.get(temperatureC);

            const conduction = k * (T[i + 1] - 2 * T[i] + T[i - 1]) / (dx * dx);

            Tnext[i] = T[i] + dt * conduction / (density * cp);
        }

        /* 2. Верхняя поверхность (половина контрольного объема) */
        {
            const i = 0;
            const temperatureC = toCelsius(T[i]);
            const {density,k,cp} = materialModel.get(temperatureC);

            const conduction = 2 * k * (T[i + 1] - T[i]) / (dx * dx);

            const convection = calculateConvectionFlux({
                surfaceTemperatureC: temperatureC,
                ambientTemperatureC: topAirC, // Динамический воздух
                heatTransferCoefficient: h
            });

            const radiationLoss = calculateAmbientRadiationLoss({
                surfaceTemperatureC: temperatureC,
                ambientRadiationTemperatureC,
                sheetEmissivity,
                ambientViewFactor: topAmbientViewFactor
            });

            const netSurfaceFlux = convection - radiationLoss + topIncident;

            Tnext[i] = T[i] + dt * (
                conduction + 2 * netSurfaceFlux / dx
            ) / (density * cp);
        }

        /* 3. Нижняя поверхность (половина контрольного объема) */
        {
            const i = nodeCount - 1;
            const temperatureC = toCelsius(T[i]);
            const {density,k,cp} = materialModel.get(temperatureC);

            const conduction = 2 * k * (T[i - 1] - T[i]) / (dx * dx);

            const convection = calculateConvectionFlux({
                surfaceTemperatureC: temperatureC,
                ambientTemperatureC: bottomAirC, // Динамический воздух
                heatTransferCoefficient: h
            });

            const radiationLoss = calculateAmbientRadiationLoss({
                surfaceTemperatureC: temperatureC,
                ambientRadiationTemperatureC,
                sheetEmissivity,
                ambientViewFactor: bottomAmbientViewFactor
            });

            const netSurfaceFlux = convection - radiationLoss + bottomIncident;

            Tnext[i] = T[i] + dt * (
                conduction + 2 * netSurfaceFlux / dx
            ) / (density * cp);
        }

        T.set(Tnext);
        time += dt;

        // Физический контроль устойчивости численных значений
        for (let i = 0; i < nodeCount; i++) {
            if (!Number.isFinite(T[i]) || T[i] < 100 || T[i] > 1500) {
                throw new Error(
                    `Numerical instability at ${time.toFixed(3)} s. ` +
                    `Reduce dx/dt or check model parameters.`
                );
            }
        }

        reachedTarget = targetReached({ T, centerIndex, target });

        if (storeHistory && time + 1e-12 >= nextSampleTime) {
            saveHistorySample({ T, centerIndex, history, time });
            nextSampleTime += sampleEverySeconds;
        }
    }

    /* =========================
     * RESULT & DIAGNOSTICS
     * ========================= */

    const temperatureProfile = Array.from(
        T,
        (temperatureK,i) => ({
            xMm: x[i] * 1000,
            temperatureC: toCelsius(temperatureK)
        })
    );

    const result = {
        heatingTimeSeconds: time,
        reachedTarget,
        temperatureProfile
    };

    if (storeHistory) {
        result.history = history;
    }

    if (includeBreakdown) {
        const frontTemperatureC = temperatureProfile[0].temperatureC;
        const backTemperatureC = temperatureProfile[nodeCount - 1].temperatureC;

        const zeroFlux = { incidentWm2: 0, reflectedWm2: 0, effectiveWm2: 0 };

        const topFlux = topSide.enabled
            ? calculateEffectiveIncidentFlux({ side: topSide, material, surfaceTemperatureC: frontTemperatureC })
            : zeroFlux;

        const bottomFlux = bottomSide.enabled
            ? calculateEffectiveIncidentFlux({ side: bottomSide, material, surfaceTemperatureC: backTemperatureC })
            : zeroFlux;

        result.diagnostics = {
            nodeCount,
            dxMm: dx * 1000,
            dtSeconds: dt,
            maxStableDtSeconds: maxStableDt,
            thermalDiffusivityM2s: thermalDiffusivity,
            heatBalance: {
                top: topFlux,
                bottom: bottomFlux,
                convectionCoefficient: h
            },
            machine: {
                heaterCount: normalizedMachine.heaters.length,
                top: normalizedMachine.top,
                bottom: normalizedMachine.bottom
            },
            numerical: {
                explicitScheme: true,
                stabilityCriterion: "Fo <= 0.43",
                thermalPropertyModel: materialModel.constant ? "constant" : "temperature-dependent",
                opticalModel: "Opaque Sheet (Surface Absorption for Infrared Heating Elements)",
                boundaryModel: "convection + ambient radiation + surface-applied effective IR flux",
                heaterModel: "radiative heater mapped to boundary condition"
            }
        };
    }

    return result;
}

/* =========================
 * BENDING HEATING TIME
 * ========================= */

export function calculateBendingHeatingTime({
                                                thicknessMm,
                                                material,
                                                machine,
                                                thermalConditions,
                                                heaterMode,
                                                targetMinC,
                                                targetMaxC,
                                                ...options
                                            }) {
    targetMinC ??= material.defaultTCenter;
    targetMaxC ??= material.defaultTSurf;

    if (!Number.isFinite(targetMinC)) {
        throw new Error("targetMinC must be finite");
    }

    if (!Number.isFinite(targetMaxC)) {
        throw new Error("targetMaxC must be finite");
    }

    return simulate1DHeating({
        thicknessMm,
        material,
        machine,
        thermalConditions,
        sides: heaterMode,
        target: {
            minCenterC: targetMinC
        },
        ...options
    });
}

/* =========================
 * FIT ERROR
 * ========================= */

export function calculateFitError({
                                      simulation,
                                      measurements,
                                      weights
                                  }) {
    if (!Array.isArray(measurements) || measurements.length === 0) {
        throw new Error("measurements must be a non-empty array");
    }

    if (!simulation.history || simulation.history.length === 0) {
        throw new Error("simulation.history is empty");
    }

    const nearest = timeSeconds => {
        let best = simulation.history[0];
        let bestDistance = Math.abs(best.timeSeconds - timeSeconds);

        for (let i = 1; i < simulation.history.length; i++) {
            const sample = simulation.history[i];
            const distance = Math.abs(sample.timeSeconds - timeSeconds);

            if (distance < bestDistance) {
                best = sample;
                bestDistance = distance;
            }
        }

        return best;
    };

    let squaredError = 0;
    let count = 0;

    for (const measurement of measurements) {
        const simulated = nearest(measurement.timeSeconds);

        if (Number.isFinite(measurement.frontSurfaceC)) {
            const d = simulated.frontSurfaceC - measurement.frontSurfaceC;
            squaredError += weights.surface * d * d;
            count++;
        }

        if (Number.isFinite(measurement.centerC)) {
            const d = simulated.centerC - measurement.centerC;
            squaredError += weights.center * d * d;
            count++;
        }

        if (Number.isFinite(measurement.backSurfaceC)) {
            const d = simulated.backSurfaceC - measurement.backSurfaceC;
            squaredError += weights.surface * d * d;
            count++;
        }
    }

    return {
        rmseC: Math.sqrt(squaredError / Math.max(1,count)),
        sse: squaredError,
        samples: count
    };
}


//* =========================
//* CALIBRATION (ИСПРАВЛЕННАЯ ВЕРСИЯ)
//* ========================= */

export function fitHeatingParameters({
                                         thicknessMm,
                                         material,
                                         machine,
                                         thermalConditions,
                                         sides,
                                         measurements,
                                         simulation,
                                         initial,
                                         bounds,
                                         passes
                                     }) {
    if (!Array.isArray(measurements) || measurements.length === 0) {
        throw new Error("measurements must be a non-empty array");
    }

    if (!Number.isFinite(simulation.maxTimeSeconds)) {
        throw new Error("simulation.maxTimeSeconds must be finite");
    }

    const normalizedMachine = normalizeMachine(machine);

    const calibrationSimulation = {
        ...simulation,
        storeHistory: true,
        target: {} // сбрасываем цель, чтобы симуляция шла до maxTimeSeconds для снятия всех точек
    };

    const simulate = params => {
        // Обновляем параметры конвекции и радиации на основе оптимизации
        const fittedMachine = {
            ...normalizedMachine,
            heatTransferCoefficient: params.heatTransferCoefficient,
            heaters: normalizedMachine.heaters.map(
                heater => ({
                    ...heater,
                    radiationGain: params.radiationGain
                })
            )
        };

        return simulate1DHeating({
            thicknessMm,
            material,
            machine: fittedMachine,
            thermalConditions,
            sides,
            ...calibrationSimulation
        });
    };

    const getError = params =>
        calculateFitError({
            simulation: simulate(params),
            measurements,
            weights: simulation.weights
        }).rmseC;

    let params = {...initial};
    let bestError = getError(params);

    const initialStep = {
        radiationGain: Math.max(0.01, params.radiationGain * 0.5),
        heatTransferCoefficient: Math.max(0.5, params.heatTransferCoefficient * 0.5)
    };

    const parameterKeys = [
        "radiationGain",
        "heatTransferCoefficient"
    ];

    for (let pass = 0; pass < passes; pass++) {
        for (const key of parameterKeys) {
            const current = params[key];
            const step = initialStep[key] / (2 ** pass);

            // ИСПРАВЛЕНО: Теперь clamp корректно берет [0] как мин и [1] как макс
            const candidates = [
                current - step,
                current,
                current + step
            ].map(value => clamp(value, bounds[key][0], bounds[key][1]));

            for (const candidate of candidates) {
                const trial = {
                    ...params,
                    [key]: candidate
                };

                const error = getError(trial);

                if (error < bestError) {
                    params = trial;
                    bestError = error;
                }
            }
        }
    }

    return {
        parameters: params,
        rmseC: bestError,
        note: "Validate fitted parameters on separate measurements. Optical coefficient optimization disabled for THeaters."
    };
}

/* Optical diagnostics only (Kept for backward compatibility interface) */
export function getOpticalDiagnostics({thicknessMm, material}) {
    positiveNumber(thicknessMm, "thicknessMm");
    return {
        thicknessMm,
        absorptionCoefficient1m: Infinity,
        penetrationDepthMm: 0,
        singlePassAbsorbedFraction: 1,
        singlePassTransmittedFraction: 0
    };
}
