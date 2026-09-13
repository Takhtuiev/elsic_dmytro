/**
 * 1D transient finite-difference heating model for Opaque Plastics.
 *
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 *
 * Heating: IR radiation + convection
 * Losses: convection + ambient radiation
 */

/* =========================
 * NUMERICAL CONTROL
 * ========================= */

export const GRID_CELLS_PER_THICKNESS = 12;
export const MIN_DX_MM = 0.25;
export const MAX_DX_MM = 1.5;

export const STABILITY_FACTOR = 0.5;
export const TIME_STEP_FACTOR = 0.25;

export const SIGMA = 5.670374419e-8;

/* =========================
 * MACHINE
 * ========================= */

export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object") {
        throw new Error("machine must be an object");
    }

    if (
        !Array.isArray(machine.heaters) ||
        machine.heaters.length < 1 ||
        machine.heaters.length > 2
    ) {
        throw new Error("machine.heaters must contain 1 or 2 heaters");
    }

    const top = {...machine.heaters[0]};

    const bottom =
        machine.heaters.length === 2
            ? {...top, ...(machine.heaters[1] || {})}
            : null;

    return {...machine,top,bottom};
}

/* =========================
 * HELPERS
 * ========================= */

const clamp = (v,min,max) =>
    Math.min(max,Math.max(min,v));

const positiveNumber = (v,name) => {
    if (!Number.isFinite(v) || v <= 0) {
        throw new Error(`${name} must be > 0`);
    }
    return v;
};

const toKelvin = c => c + 273.15;
const toCelsius = k => k - 273.15;

const getProperty = (p,T) =>
    typeof p === "function" ? p(T) : p;

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

function createMaterialModel(material) {
    const constant =
        typeof material.density !== "function" &&
        typeof material.thermalConductivity !== "function" &&
        typeof material.specificHeat !== "function";

    const properties =
        constant
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
 * GRID
 * ========================= */

function calculateDxMm(thicknessMm) {
    return clamp(
        thicknessMm / GRID_CELLS_PER_THICKNESS,
        MIN_DX_MM,
        MAX_DX_MM
    );
}

function createGrid(thicknessM,requestedDxM) {
    const nodeCount = Math.max(
        5,
        Math.round(thicknessM / requestedDxM) + 1
    );

    const dx =
        thicknessM / (nodeCount - 1);

    const x =
        new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
        x[i] = i * dx;
    }

    return {nodeCount,dx,x};
}

/* =========================
 * RADIATION / CONVECTION
 * ========================= */

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

export function calculateAmbientRadiationLoss({
                                                  surfaceTemperatureC,
                                                  ambientRadiationTemperatureC,
                                                  sheetEmissivity,
                                                  ambientViewFactor
                                              }) {
    const Ts = toKelvin(surfaceTemperatureC);
    const Ta = toKelvin(ambientRadiationTemperatureC);

    return (
        sheetEmissivity *
        ambientViewFactor *
        SIGMA *
        (Ts ** 4 - Ta ** 4)
    );
}

export function calculateConvectionFlux({
                                            surfaceTemperatureC,
                                            ambientTemperatureC,
                                            heatTransferCoefficient
                                        }) {
    return (
        heatTransferCoefficient *
        (ambientTemperatureC - surfaceTemperatureC)
    );
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

export function calculateIncidentHeaterFlux({
                                                side,
                                                surfaceTemperatureC
                                            }) {
    if (!side.enabled) return 0;

    if (side.radiationMode === "heatFlux") {
        return Math.max(
            0,
            Number(side.heatFluxWm2) || 0
        );
    }

    return calculateHeaterRadiationFlux({
        heaterTemperatureC: side.heaterTemperatureC,
        surfaceTemperatureC,
        heaterEmissivity: side.heaterEmissivity,
        viewFactor: side.viewFactor,
        radiationGain: side.radiationGain
    });
}

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

    const reflectance =
        clamp(
            Number.isFinite(side.surfaceReflectance)
                ? side.surfaceReflectance
                : Number(material.surfaceReflectance) || 0,
            0,
            0.999999
        );

    const reflectedWm2 =
        incidentWm2 * reflectance;

    return {
        incidentWm2,
        reflectedWm2,
        effectiveWm2:
            incidentWm2 - reflectedWm2
    };
}

/* =========================
 * TARGET / SAFETY
 * ========================= */

function targetReached({
                           T,
                           centerIndex,
                           target
                       }) {
    const centerC =
        toCelsius(T[centerIndex]);

    return (
        target.minCenterC == null ||
        centerC >= target.minCenterC
    );
}

function checkDecomposition({
                                T,
                                centerIndex,
                                material
                            }) {
    const frontC =
        toCelsius(T[0]);

    const centerC =
        toCelsius(T[centerIndex]);

    const backC =
        toCelsius(T[T.length - 1]);

    const decompositionTemp =
        Number(material.decompositionTemp);

    if (!Number.isFinite(decompositionTemp)) {
        throw new Error(
            "material.decompositionTemp must be finite"
        );
    }

    if (
        frontC >= decompositionTemp ||
        backC >= decompositionTemp
    ) {
        throw new Error(
            `Критический брак: Поверхность ПВХ нагрелась до температуры деструкции (${decompositionTemp}°C)! ` +
            `Центр при этом успел прогреться только до ${centerC.toFixed(1)}°C. ` +
            `Решение: Снизьте температуру ТЭНов на регуляторе или увеличьте зазор.`
        );
    }
}

/* =========================
 * HISTORY
 * ========================= */

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
        backSurfaceC:
            toCelsius(T[T.length - 1]),
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
    positiveNumber(
        thicknessMm,
        "thicknessMm"
    );

    positiveNumber(
        maxTimeSeconds,
        "maxTimeSeconds"
    );

    if (storeHistory) {
        positiveNumber(
            sampleEverySeconds,
            "sampleEverySeconds"
        );
    }

    const effectiveDxMm =
        Number.isFinite(dxMm) && dxMm > 0
            ? dxMm
            : calculateDxMm(thicknessMm);

    const normalizedMachine =
        normalizeMachine(machine);

    const {
        initialTemperatureC,
        ambientTemperatureC,
        ambientRadiationTemperatureC
    } = thermalConditions;

    if (!Number.isFinite(initialTemperatureC)) {
        throw new Error(
            "initialTemperatureC must be finite"
        );
    }

    if (!Number.isFinite(ambientTemperatureC)) {
        throw new Error(
            "ambientTemperatureC must be finite"
        );
    }

    if (
        !Number.isFinite(
            ambientRadiationTemperatureC
        )
    ) {
        throw new Error(
            "ambientRadiationTemperatureC must be finite"
        );
    }

    const thicknessM =
        thicknessMm / 1000;

    const {
        nodeCount,
        dx,
        x
    } = createGrid(
        thicknessM,
        effectiveDxMm / 1000
    );

    const materialModel =
        createMaterialModel(material);

    const initialProperties =
        materialModel.get(
            initialTemperatureC
        );

    const thermalDiffusivity =
        initialProperties.k /
        (
            initialProperties.density *
            initialProperties.cp
        );

    const maxStableDt =
        STABILITY_FACTOR *
        dx * dx /
        thermalDiffusivity;

    const requestedDtSeconds =
        Number.isFinite(dtSeconds) &&
        dtSeconds > 0
            ? dtSeconds
            : maxStableDt *
            TIME_STEP_FACTOR;

    const dt =
        Math.min(
            requestedDtSeconds,
            maxStableDt
        );

    const {
        top: topSide,
        bottom: bottomSide
    } = resolveSides({
        sides,
        machine: normalizedMachine
    });

    const h =
        Math.max(
            0,
            Number(
                normalizedMachine
                    .heatTransferCoefficient
            ) || 0
        );

    const sheetEmissivity =
        clamp(
            Number.isFinite(material.emissivity)
                ? material.emissivity
                : 0.93,
            0,
            1
        );

    const topAmbientViewFactor =
        clamp(
            Number.isFinite(
                topSide.ambientViewFactor
            )
                ? topSide.ambientViewFactor
                : 1 -
                clamp(
                    Number(
                        topSide.viewFactor
                    ) || 0,
                    0,
                    1
                ),
            0,
            1
        );

    const bottomAmbientViewFactor =
        clamp(
            Number.isFinite(
                bottomSide.ambientViewFactor
            )
                ? bottomSide.ambientViewFactor
                : 1 -
                clamp(
                    Number(
                        bottomSide.viewFactor
                    ) || 0,
                    0,
                    1
                ),
            0,
            1
        );

    const T =
        new Float64Array(nodeCount);

    const Tnext =
        new Float64Array(nodeCount);

    T.fill(
        toKelvin(initialTemperatureC)
    );

    const centerIndex =
        Math.floor(
            (nodeCount - 1) / 2
        );

    let time = 0;

    let reachedTarget =
        targetReached({
            T,
            centerIndex,
            target
        });

    let nextSampleTime =
        storeHistory
            ? sampleEverySeconds
            : Infinity;

    const history =
        storeHistory ? [] : null;

    if (storeHistory) {
        saveHistorySample({
            T,
            centerIndex,
            history,
            time
        });
    }

    while (
        !reachedTarget &&
        time < maxTimeSeconds
        ) {
        const topSurfaceC =
            toCelsius(T[0]);

        const bottomSurfaceC =
            toCelsius(
                T[nodeCount - 1]
            );

        const topIncident =
            topSide.enabled
                ? calculateEffectiveIncidentFlux({
                    side: topSide,
                    material,
                    surfaceTemperatureC:
                    topSurfaceC
                }).effectiveWm2
                : 0;

        const bottomIncident =
            bottomSide.enabled
                ? calculateEffectiveIncidentFlux({
                    side: bottomSide,
                    material,
                    surfaceTemperatureC:
                    bottomSurfaceC
                }).effectiveWm2
                : 0;

        const topFactor =
            Number.isFinite(
                topSide.airTemperatureFactor
            )
                ? topSide.airTemperatureFactor
                : 0.70;

        const bottomFactor =
            Number.isFinite(
                bottomSide.airTemperatureFactor
            )
                ? bottomSide.airTemperatureFactor
                : 0.70;

        const topAirC =
            topSide.enabled
                ? topSurfaceC +
                topFactor *
                (
                    topSide.heaterTemperatureC -
                    topSurfaceC
                )
                : ambientTemperatureC;

        const bottomAirC =
            bottomSide.enabled
                ? bottomSurfaceC +
                bottomFactor *
                (
                    bottomSide.heaterTemperatureC -
                    bottomSurfaceC
                )
                : ambientTemperatureC;

        for (
            let i = 1;
            i < nodeCount - 1;
            i++
        ) {
            const temperatureC =
                toCelsius(T[i]);

            const {
                density,
                k,
                cp
            } =
                materialModel.get(
                    temperatureC
                );

            const conduction =
                k *
                (
                    T[i + 1] -
                    2 * T[i] +
                    T[i - 1]
                ) /
                (dx * dx);

            Tnext[i] =
                T[i] +
                dt *
                conduction /
                (density * cp);
        }

        {
            const i = 0;

            const temperatureC =
                toCelsius(T[i]);

            const {
                density,
                k,
                cp
            } =
                materialModel.get(
                    temperatureC
                );

            const conduction =
                2 *
                k *
                (T[i + 1] - T[i]) /
                (dx * dx);

            const convection =
                calculateConvectionFlux({
                    surfaceTemperatureC:
                    temperatureC,
                    ambientTemperatureC:
                    topAirC,
                    heatTransferCoefficient:
                    h
                });

            const radiationLoss =
                calculateAmbientRadiationLoss({
                    surfaceTemperatureC:
                    temperatureC,
                    ambientRadiationTemperatureC,
                    sheetEmissivity,
                    ambientViewFactor:
                    topAmbientViewFactor
                });

            const netSurfaceFlux =
                convection -
                radiationLoss +
                topIncident;

            Tnext[i] =
                T[i] +
                dt *
                (
                    conduction +
                    2 *
                    netSurfaceFlux /
                    dx
                ) /
                (density * cp);
        }

        {
            const i =
                nodeCount - 1;

            const temperatureC =
                toCelsius(T[i]);

            const {
                density,
                k,
                cp
            } =
                materialModel.get(
                    temperatureC
                );

            const conduction =
                2 *
                k *
                (T[i - 1] - T[i]) /
                (dx * dx);

            const convection =
                calculateConvectionFlux({
                    surfaceTemperatureC:
                    temperatureC,
                    ambientTemperatureC:
                    bottomAirC,
                    heatTransferCoefficient:
                    h
                });

            const radiationLoss =
                calculateAmbientRadiationLoss({
                    surfaceTemperatureC:
                    temperatureC,
                    ambientRadiationTemperatureC,
                    sheetEmissivity,
                    ambientViewFactor:
                    bottomAmbientViewFactor
                });

            const netSurfaceFlux =
                convection -
                radiationLoss +
                bottomIncident;

            Tnext[i] =
                T[i] +
                dt *
                (
                    conduction +
                    2 *
                    netSurfaceFlux /
                    dx
                ) /
                (density * cp);
        }

        T.set(Tnext);

        time += dt;

        for (let i = 0; i < nodeCount; i++) {
            if (
                !Number.isFinite(T[i]) ||
                T[i] < 100 ||
                T[i] > 1500
            ) {
                throw new Error(
                    `Numerical instability at ${time.toFixed(3)} s. ` +
                    `Reduce dx/dt or check model parameters.`
                );
            }
        }

        checkDecomposition({
            T,
            centerIndex,
            material
        });

        reachedTarget =
            targetReached({
                T,
                centerIndex,
                target
            });

        if (
            storeHistory &&
            time + 1e-12 >=
            nextSampleTime
        ) {
            saveHistorySample({
                T,
                centerIndex,
                history,
                time
            });

            nextSampleTime +=
                sampleEverySeconds;
        }
    }

    const temperatureProfile =
        Array.from(
            T,
            (temperatureK,i) => ({
                xMm: x[i] * 1000,
                temperatureC:
                    toCelsius(
                        temperatureK
                    )
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
        const frontTemperatureC =
            temperatureProfile[0]
                .temperatureC;

        const backTemperatureC =
            temperatureProfile[
            temperatureProfile.length - 1
                ].temperatureC;

        const centerTemperatureC =
            temperatureProfile[
                centerIndex
                ].temperatureC;

        const zeroFlux = {
            incidentWm2: 0,
            reflectedWm2: 0,
            effectiveWm2: 0
        };

        const topFlux =
            topSide.enabled
                ? calculateEffectiveIncidentFlux({
                    side: topSide,
                    material,
                    surfaceTemperatureC:
                    frontTemperatureC
                })
                : zeroFlux;

        const bottomFlux =
            bottomSide.enabled
                ? calculateEffectiveIncidentFlux({
                    side: bottomSide,
                    material,
                    surfaceTemperatureC:
                    backTemperatureC
                })
                : zeroFlux;

        result.diagnostics = {
            nodeCount,
            dxMm: dx * 1000,
            requestedDxMm:
            effectiveDxMm,
            automaticDx:
                !(
                    Number.isFinite(dxMm) &&
                    dxMm > 0
                ),

            dtSeconds: dt,
            requestedDtSeconds,
            automaticDt:
                !(
                    Number.isFinite(
                        dtSeconds
                    ) &&
                    dtSeconds > 0
                ),
            maxStableDtSeconds:
            maxStableDt,

            thermalDiffusivityM2s:
            thermalDiffusivity,

            numericalControl: {
                gridCellsPerThickness:
                GRID_CELLS_PER_THICKNESS,
                minDxMm: MIN_DX_MM,
                maxDxMm: MAX_DX_MM,
                stabilityFactor:
                STABILITY_FACTOR,
                timeStepFactor:
                TIME_STEP_FACTOR,
                fourierNumber:
                    thermalDiffusivity *
                    dt /
                    (dx * dx)
            },

            target: {
                centerC:
                target.minCenterC,
                surfaceC:
                target.maxSurfaceC,
                actualCenterC:
                centerTemperatureC,
                actualFrontSurfaceC:
                frontTemperatureC,
                actualBackSurfaceC:
                backTemperatureC,
                decompositionC:
                material.decompositionTemp
            },

            heatBalance: {
                top: topFlux,
                bottom: bottomFlux,
                convectionCoefficient: h
            },

            machine: {
                heaterCount:
                normalizedMachine
                    .heaters.length,
                top: normalizedMachine.top,
                bottom:
                normalizedMachine.bottom
            },

            numerical: {
                explicitScheme: true,
                stabilityCriterion:
                    `Fo <= ${STABILITY_FACTOR}`,
                thermalPropertyModel:
                    materialModel.constant
                        ? "constant"
                        : "temperature-dependent",
                opticalModel:
                    "Opaque Sheet (Surface Absorption for Infrared Heating Elements)",
                boundaryModel:
                    "convection + ambient radiation + surface-applied effective IR flux",
                heaterModel:
                    "radiative heater mapped to boundary condition"
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
    targetMinC ??=
        material.defaultTCenter;

    targetMaxC ??=
        material.defaultTSurf;

    if (!Number.isFinite(targetMinC)) {
        throw new Error(
            "targetMinC must be finite"
        );
    }

    if (!Number.isFinite(targetMaxC)) {
        throw new Error(
            "targetMaxC must be finite"
        );
    }

    if (
        !Number.isFinite(
            material.decompositionTemp
        )
    ) {
        throw new Error(
            "material.decompositionTemp must be finite"
        );
    }

    return simulate1DHeating({
        thicknessMm,
        material,
        machine,
        thermalConditions,
        sides: heaterMode,
        target: {
            minCenterC: targetMinC,
            maxSurfaceC: targetMaxC
        },
        ...options
    });
}