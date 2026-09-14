/**
 * 1D transient implicit finite-difference heating model for opaque plastics.
 *
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 *
 * Heating: IR radiation + convection
 * Losses: convection + ambient radiation
 *
 * Numerical method:
 * Fully implicit conduction with linearized nonlinear radiation.
 * Tridiagonal system solved by Thomas algorithm.
 */

export const GRID_CELLS_PER_THICKNESS = 21;
export const MIN_DX_MM = 0.25;
export const MAX_DX_MM = 1.5;

export const DEFAULT_DT_SECONDS = 0.5;
export const MAX_NONLINEAR_ITERATIONS = 3;
export const NONLINEAR_TOLERANCE_C = 0.1;

export const SIGMA = 5.670374419e-8;

/* =========================
 * MACHINE
 * ========================= */

export function normalizeMachine(machine) {
    if (!machine || typeof machine !== "object")
        throw new Error("machine must be an object");

    if (!Array.isArray(machine.heaters) ||
        machine.heaters.length < 1 ||
        machine.heaters.length > 2)
        throw new Error("machine.heaters must contain 1 or 2 heaters");

    const top = {...machine.heaters[0]};

    const bottom =
        machine.heaters.length === 2
            ? {...top,...(machine.heaters[1] || {})}
            : null;

    return {...machine,top,bottom};
}

/* =========================
 * HELPERS
 * ========================= */

const clamp = (v,min,max) =>
    Math.min(max,Math.max(min,v));

const positiveNumber = (v,name) => {
    if (!Number.isFinite(v) || v <= 0)
        throw new Error(`${name} must be > 0`);
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
        constant ? getMaterialProperties(material,20) : null;

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

    const dx = thicknessM / (nodeCount - 1);

    const x = new Float64Array(nodeCount);

    for (let i = 0; i < nodeCount; i++)
        x[i] = i * dx;

    return {nodeCount,dx,x};
}

/* =========================
 * RADIATION
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
    const frontC = toCelsius(T[0]);
    const centerC = toCelsius(T[centerIndex]);
    const backC = toCelsius(T[T.length - 1]);

    const decompositionTemp =
        Number(material.decompositionTemp);

    if (!Number.isFinite(decompositionTemp))
        throw new Error(
            "material.decompositionTemp must be finite"
        );

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
 * LINEARIZED RADIATION
 * ========================= */

/*
 * q(T) = C - D*T
 *
 * Linearization:
 *
 * T^4 ≈ 4*T0^3*T - 3*T0^4
 *
 * This makes the nonlinear radiation
 * compatible with a tridiagonal implicit system.
 */

function linearizeSurfaceFlux({
                                  side,
                                  material,
                                  surfaceTemperatureK,
                                  ambientRadiationTemperatureC,
                                  ambientTemperatureC,
                                  sheetEmissivity,
                                  ambientViewFactor,
                                  h
                              }) {
    const Ts = surfaceTemperatureK;
    const Ta = toKelvin(ambientRadiationTemperatureC);

    let constantFlux = 0;
    let temperatureCoefficient = 0;

    /* =========================
     * HEATER
     * ========================= */

    if (side.enabled) {
        const reflectance =
            clamp(
                Number.isFinite(side.surfaceReflectance)
                    ? side.surfaceReflectance
                    : Number(material.surfaceReflectance) || 0,
                0,
                0.999999
            );

        const absorption =
            1 - reflectance;

        if (side.radiationMode === "heatFlux") {
            const q =
                Math.max(
                    0,
                    Number(side.heatFluxWm2) || 0
                ) * absorption;

            constantFlux += q;
        } else {
            const Th =
                toKelvin(side.heaterTemperatureC);

            const gain =
                Number(side.radiationGain) || 0;

            const emissivity =
                Number(side.heaterEmissivity) || 0;

            const viewFactor =
                Number(side.viewFactor) || 0;

            const A =
                gain *
                emissivity *
                viewFactor *
                SIGMA;

            /*
             * qheater =
             * A * (Th^4 - Ts^4)
             */

            if (Th > Ts) {
                constantFlux +=
                    absorption *
                    A *
                    (
                        Th ** 4 +
                        3 * Ts ** 4
                    );

                temperatureCoefficient +=
                    absorption *
                    A *
                    4 *
                    Ts ** 3;
            }
        }
    }

    /* =========================
     * CONVECTION
     * ========================= */

    if (side.enabled) {
        const factor =
            Number.isFinite(side.airTemperatureFactor)
                ? side.airTemperatureFactor
                : 0.70;

        const heaterTemperatureK =
            toKelvin(side.heaterTemperatureC);

        /*
         * Tair =
         * Ts + factor*(Theater-Ts)
         *
         * Therefore:
         *
         * qconv =
         * h*factor*(Theater-Ts)
         */

        const hc = h * factor;

        constantFlux +=
            hc *
            heaterTemperatureK;

        temperatureCoefficient += hc;
    } else {
        constantFlux +=
            h *
            toKelvin(ambientTemperatureC);

        temperatureCoefficient += h;
    }

    /* =========================
     * AMBIENT RADIATION
     * ========================= */

    const radiationA =
        sheetEmissivity *
        ambientViewFactor *
        SIGMA;

    /*
     * qloss =
     * radiationA*(Ts^4-Ta^4)
     *
     * subtracting qloss:
     *
     * + radiationA*Ta^4
     * - radiationA*Ts^4
     */

    constantFlux +=
        radiationA *
        (
            Ta ** 4 +
            3 * Ts ** 4
        );

    temperatureCoefficient +=
        radiationA *
        4 *
        Ts ** 3;

    return {
        constantFlux,
        temperatureCoefficient
    };
}

/* =========================
 * THOMAS SOLVER
 * ========================= */

function solveTridiagonal(
    lower,
    diagonal,
    upper,
    rhs,
    result
) {
    const n = diagonal.length;

    for (let i = 1; i < n; i++) {
        const factor =
            lower[i] / diagonal[i - 1];

        diagonal[i] -=
            factor * upper[i - 1];

        rhs[i] -=
            factor * rhs[i - 1];
    }

    result[n - 1] =
        rhs[n - 1] /
        diagonal[n - 1];

    for (let i = n - 2; i >= 0; i--) {
        result[i] =
            (
                rhs[i] -
                upper[i] * result[i + 1]
            ) /
            diagonal[i];
    }
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

    if (!Number.isFinite(initialTemperatureC))
        throw new Error(
            "initialTemperatureC must be finite"
        );

    if (!Number.isFinite(ambientTemperatureC))
        throw new Error(
            "ambientTemperatureC must be finite"
        );

    if (!Number.isFinite(ambientRadiationTemperatureC))
        throw new Error(
            "ambientRadiationTemperatureC must be finite"
        );

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

    const dt =
        Number.isFinite(dtSeconds) &&
        dtSeconds > 0
            ? dtSeconds
            : DEFAULT_DT_SECONDS;

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

    /* =========================
     * ARRAYS
     * ========================= */

    const T =
        new Float64Array(nodeCount);

    const Tnext =
        new Float64Array(nodeCount);

    const lower =
        new Float64Array(nodeCount);

    const diagonal =
        new Float64Array(nodeCount);

    const upper =
        new Float64Array(nodeCount);

    const rhs =
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

    /* =========================
     * TIME LOOP
     * ========================= */

    while (
        !reachedTarget &&
        time < maxTimeSeconds
        ) {
        const stepDt =
            Math.min(
                dt,
                maxTimeSeconds - time
            );

        /*
         * Initial linearization point.
         * Previous time step is the natural
         * Newton/Picard starting point.
         */

        Tnext.set(T);

        for (
            let nonlinearIteration = 0;
            nonlinearIteration <
            MAX_NONLINEAR_ITERATIONS;
            nonlinearIteration++
        ) {
            const oldT =
                nonlinearIteration === 0
                    ? T
                    : Tnext;

            /* =========================
             * INTERNAL NODES
             * ========================= */

            for (
                let i = 1;
                i < nodeCount - 1;
                i++
            ) {
                const temperatureC =
                    toCelsius(oldT[i]);

                const {
                    density,
                    k,
                    cp
                } =
                    materialModel.get(
                        temperatureC
                    );

                const capacity =
                    density *
                    cp /
                    stepDt;

                const conduction =
                    k / (dx * dx);

                lower[i] =
                    -conduction;

                diagonal[i] =
                    capacity +
                    2 * conduction;

                upper[i] =
                    -conduction;

                rhs[i] =
                    capacity * T[i];
            }

            /* =========================
             * TOP SURFACE
             * ========================= */

            {
                const i = 0;

                const temperatureK =
                    oldT[i];

                const temperatureC =
                    toCelsius(
                        temperatureK
                    );

                const {
                    density,
                    k,
                    cp
                } =
                    materialModel.get(
                        temperatureC
                    );

                const capacity =
                    density *
                    cp /
                    stepDt;

                const conduction =
                    2 * k / (dx * dx);

                const {
                    constantFlux,
                    temperatureCoefficient
                } =
                    linearizeSurfaceFlux({
                        side: topSide,
                        material,
                        surfaceTemperatureK:
                        temperatureK,
                        ambientRadiationTemperatureC,
                        ambientTemperatureC,
                        sheetEmissivity,
                        ambientViewFactor:
                        topAmbientViewFactor,
                        h
                    });

                /*
                 * q = C - D*T
                 *
                 * Boundary equation:
                 *
                 * capacity*Tnew
                 * =
                 * capacity*Told
                 * + conduction*(T1-Tnew)
                 * + 2/dx*(C-D*Tnew)
                 */

                lower[i] = 0;

                diagonal[i] =
                    capacity +
                    conduction +
                    2 *
                    temperatureCoefficient /
                    dx;

                upper[i] =
                    -conduction;

                rhs[i] =
                    capacity * T[i] +
                    2 *
                    constantFlux /
                    dx;
            }

            /* =========================
             * BOTTOM SURFACE
             * ========================= */

            {
                const i =
                    nodeCount - 1;

                const temperatureK =
                    oldT[i];

                const temperatureC =
                    toCelsius(
                        temperatureK
                    );

                const {
                    density,
                    k,
                    cp
                } =
                    materialModel.get(
                        temperatureC
                    );

                const capacity =
                    density *
                    cp /
                    stepDt;

                const conduction =
                    2 * k / (dx * dx);

                const {
                    constantFlux,
                    temperatureCoefficient
                } =
                    linearizeSurfaceFlux({
                        side: bottomSide,
                        material,
                        surfaceTemperatureK:
                        temperatureK,
                        ambientRadiationTemperatureC,
                        ambientTemperatureC,
                        sheetEmissivity,
                        ambientViewFactor:
                        bottomAmbientViewFactor,
                        h
                    });

                lower[i] =
                    -conduction;

                diagonal[i] =
                    capacity +
                    conduction +
                    2 *
                    temperatureCoefficient /
                    dx;

                upper[i] = 0;

                rhs[i] =
                    capacity * T[i] +
                    2 *
                    constantFlux /
                    dx;
            }

            /* =========================
             * SOLVE
             * ========================= */

            solveTridiagonal(
                lower,
                diagonal,
                upper,
                rhs,
                Tnext
            );

            /* =========================
             * NONLINEAR CONVERGENCE
             * ========================= */

            let maxDeltaC = 0;

            for (let i = 0; i < nodeCount; i++) {
                const deltaC =
                    Math.abs(
                        Tnext[i] -
                        oldT[i]
                    );

                if (deltaC > maxDeltaC)
                    maxDeltaC = deltaC;
            }

            if (
                maxDeltaC <=
                NONLINEAR_TOLERANCE_C
            )
                break;
        }

        T.set(Tnext);

        time += stepDt;

        /* =========================
         * SAFETY
         * ========================= */

        for (let i = 0; i < nodeCount; i++) {
            if (
                !Number.isFinite(T[i]) ||
                T[i] < 100 ||
                T[i] > 1500
            ) {
                throw new Error(
                    `Numerical instability at ${time.toFixed(3)} s. ` +
                    `Check model parameters.`
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

        /* =========================
         * HISTORY
         * ========================= */

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

            while (
                nextSampleTime <=
                time + 1e-12
                ) {
                nextSampleTime +=
                    sampleEverySeconds;
            }
        }
    }

    /* =========================
     * RESULT
     * ========================= */

    const temperatureProfile =
        Array.from(
            T,
            (temperatureK,i) => ({
                xMm:
                    x[i] * 1000,
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

    if (storeHistory)
        result.history = history;

    /* =========================
     * DIAGNOSTICS
     * ========================= */

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

        const materialProperties =
            materialModel.get(
                centerTemperatureC
            );

        result.diagnostics = {
            nodeCount,

            dxMm:
                dx * 1000,

            requestedDxMm:
            effectiveDxMm,

            automaticDx:
                !(
                    Number.isFinite(dxMm) &&
                    dxMm > 0
                ),

            dtSeconds: dt,

            requestedDtSeconds:
                Number.isFinite(dtSeconds) &&
                dtSeconds > 0
                    ? dtSeconds
                    : DEFAULT_DT_SECONDS,

            automaticDt:
                !(
                    Number.isFinite(dtSeconds) &&
                    dtSeconds > 0
                ),

            thermalDiffusivityM2s:
                materialProperties.k /
                (
                    materialProperties.density *
                    materialProperties.cp
                ),

            numericalControl: {
                gridCellsPerThickness:
                GRID_CELLS_PER_THICKNESS,

                minDxMm:
                MIN_DX_MM,

                maxDxMm:
                MAX_DX_MM,

                defaultDtSeconds:
                DEFAULT_DT_SECONDS,

                nonlinearIterations:
                MAX_NONLINEAR_ITERATIONS,

                nonlinearToleranceC:
                NONLINEAR_TOLERANCE_C
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

                top:
                normalizedMachine.top,

                bottom:
                normalizedMachine.bottom
            },

            numerical: {
                implicitScheme: true,

                solver:
                    "Tridiagonal Thomas algorithm",

                stabilityCriterion:
                    "Unconditionally stable for linear diffusion equation",

                thermalPropertyModel:
                    materialModel.constant
                        ? "constant"
                        : "temperature-dependent",

                opticalModel:
                    "Opaque Sheet (Surface Absorption for Infrared Heating Elements)",

                boundaryModel:
                    "implicit conduction + linearized convection + linearized radiation + surface-applied IR flux",

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

    if (!Number.isFinite(targetMinC))
        throw new Error(
            "targetMinC must be finite"
        );

    if (!Number.isFinite(targetMaxC))
        throw new Error(
            "targetMaxC must be finite"
        );

    if (
        !Number.isFinite(
            material.decompositionTemp
        )
    )
        throw new Error(
            "material.decompositionTemp must be finite"
        );

    return simulate1DHeating({
        thicknessMm,
        material,
        machine,
        thermalConditions,
        sides: heaterMode,

        target: {
            minCenterC:
            targetMinC,

            maxSurfaceC:
            targetMaxC
        },

        ...options
    });
}