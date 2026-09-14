/**
 * 1D transient implicit finite-difference heating model for opaque plastics.
 *
 * rho*Cp*dT/dt = d/dx(k*dT/dx)
 *
 * Heating:
 * - radiative heating from heater elements
 * - convection from machine environment
 *
 * Losses:
 * - ambient radiation
 * - convection on non-heated side
 *
 * Method:
 * - 1D through-thickness model
 * - fully implicit conduction
 * - linearized nonlinear radiation
 * - machine-specific top/bottom convection parameters
 * - opaque-sheet surface radiation (no IR penetration)
 *
 * Based on the modelling approach described by:
 * Buffel et al., AIP Conference Proceedings 1914, 020001 (2017).
 */

export const GRID_CELLS_PER_THICKNESS=22;
export const MIN_DX_MM=0.25;
export const MAX_DX_MM=1.5;

export const DEFAULT_DT_SECONDS=0.2;
export const MAX_NONLINEAR_ITERATIONS=3;
export const NONLINEAR_TOLERANCE_C=0.1;

export const SIGMA=5.670374419e-8;

/* =========================
 * MACHINE
 * ========================= */

export function normalizeMachine(machine){
    if(!machine||typeof machine!=="object")
        throw new Error("machine must be an object");

    if(!Array.isArray(machine.heaters)||
        machine.heaters.length<1||
        machine.heaters.length>2)
        throw new Error(
            "machine.heaters must contain 1 or 2 heaters"
        );

    const top={
        ...machine.heaters[0]
    };

    const bottom=machine.heaters.length===2
        ?{
            ...top,
            ...(machine.heaters[1]||{})
        }
        :null;

    return {
        ...machine,
        top,
        bottom
    };
}

/* =========================
 * HELPERS
 * ========================= */

const clamp=(v,min,max)=>
    Math.min(max,Math.max(min,v));

const positiveNumber=(v,name)=>{
    if(!Number.isFinite(v)||v<=0)
        throw new Error(`${name} must be > 0`);

    return v;
};

const toKelvin=c=>c+273.15;
const toCelsius=k=>k-273.15;

const getProperty=(p,T)=>
    typeof p==="function"
        ?p(T)
        :p;

function getMaterialProperties(
    material,
    temperatureC
){
    return {
        density:positiveNumber(
            getProperty(
                material.density,
                temperatureC
            ),
            "material.density"
        ),

        k:positiveNumber(
            getProperty(
                material.thermalConductivity,
                temperatureC
            ),
            "material.thermalConductivity"
        ),

        cp:positiveNumber(
            getProperty(
                material.specificHeat,
                temperatureC
            ),
            "material.specificHeat"
        )
    };
}

function createMaterialModel(material){
    const constant=
        typeof material.density!=="function"&&
        typeof material.thermalConductivity!=="function"&&
        typeof material.specificHeat!=="function";

    const properties=constant
        ?getMaterialProperties(material,20)
        :null;

    return {
        constant,
        properties,

        get:temperatureC=>
            constant
                ?properties
                :getMaterialProperties(
                    material,
                    temperatureC
                )
    };
}

/* =========================
 * GRID
 * ========================= */

function calculateDxMm(thicknessMm){
    let cells=Math.round(
        thicknessMm/
        clamp(
            thicknessMm/GRID_CELLS_PER_THICKNESS,
            MIN_DX_MM,
            MAX_DX_MM
        )
    );

    if(cells%2)
        cells++;

    return thicknessMm/cells;
}

function createGrid(
    thicknessM,
    requestedDxM
){
    let intervals=Math.max(
        4,
        Math.round(
            thicknessM/requestedDxM
        )
    );

    if(intervals%2)
        intervals++;

    const nodeCount=intervals+1;
    const dx=thicknessM/intervals;

    const x=new Float64Array(nodeCount);

    for(let i=0;i<nodeCount;i++)
        x[i]=i*dx;

    x[0]=0;
    x[nodeCount-1]=thicknessM;

    return {
        nodeCount,
        dx,
        x
    };
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
                                             }){
    const Th=toKelvin(
        heaterTemperatureC
    );

    const Ts=toKelvin(
        surfaceTemperatureC
    );

    return Math.max(
        0,
        radiationGain*
        heaterEmissivity*
        viewFactor*
        SIGMA*
        (Th**4-Ts**4)
    );
}

/* =========================
 * SIDES
 * ========================= */

function resolveSides({
                          sides,
                          machine
                      }){
    const useTop=
        sides==="both"||
        sides==="top"||
        sides==="one-sided-top";

    const useBottom=
        sides==="both"||
        sides==="bottom"||
        sides==="one-sided-bottom";

    return {
        top:{
            ...(machine.top||{}),
            enabled:
                useTop&&!!machine.top
        },

        bottom:{
            ...(machine.bottom||{}),
            enabled:
                useBottom&&!!machine.bottom
        }
    };
}

/* =========================
 * HEATER
 * ========================= */

export function calculateIncidentHeaterFlux({
                                                side,
                                                surfaceTemperatureC
                                            }){
    if(!side.enabled)
        return 0;

    if(side.radiationMode==="heatFlux")
        return Math.max(
            0,
            Number(side.heatFluxWm2)||0
        );

    return calculateHeaterRadiationFlux({
        heaterTemperatureC:
        side.heaterTemperatureC,

        surfaceTemperatureC,

        heaterEmissivity:
        side.heaterEmissivity,

        viewFactor:
        side.viewFactor,

        radiationGain:
        side.radiationGain
    });
}

export function calculateEffectiveIncidentFlux({
                                                   side,
                                                   material,
                                                   surfaceTemperatureC
                                               }){
    const incidentWm2=
        calculateIncidentHeaterFlux({
            side,
            surfaceTemperatureC
        });

    const reflectance=clamp(
        Number.isFinite(
            side.surfaceReflectance
        )
            ?side.surfaceReflectance
            :Number(
            material.surfaceReflectance
        )||0,
        0,
        0.999999
    );

    const reflectedWm2=
        incidentWm2*
        reflectance;

    return {
        incidentWm2,
        reflectedWm2,
        effectiveWm2:
            incidentWm2-reflectedWm2
    };
}

/* =========================
 * TARGET / SAFETY
 * ========================= */

function targetReached({
                           T,
                           centerIndex,
                           target
                       }){
    const centerC=
        toCelsius(T[centerIndex]);

    return target.minCenterC==null||
        centerC>=target.minCenterC;
}

function checkDecomposition({
                                T,
                                centerIndex,
                                material
                            }){
    const frontC=
        toCelsius(T[0]);

    const backC=
        toCelsius(
            T[T.length-1]
        );

    const centerC=
        toCelsius(
            T[centerIndex]
        );

    const decompositionTemp=
        Number(
            material.decompositionTemp
        );

    if(!Number.isFinite(
        decompositionTemp
    )){
        return {
            type:"error",
            message:
                "Invalid decomposition temperature."
        };
    }

    const maxSurfaceC=
        Math.max(
            frontC,
            backC
        );

    if(
        maxSurfaceC>=
        decompositionTemp
    ){
        return {
            type:"error",
            message:
                `Surface ${maxSurfaceC.toFixed(1)}°C >= `+
                `decomposition ${decompositionTemp}°C. `+
                `Center ${centerC.toFixed(1)}°C.`
        };
    }

    return null;
}

/* =========================
 * HISTORY
 * ========================= */

function saveHistorySample({
                               T,
                               centerIndex,
                               history,
                               time
                           }){
    let minC=Infinity;
    let maxC=-Infinity;

    for(let i=0;i<T.length;i++){
        const c=toCelsius(T[i]);

        if(c<minC)
            minC=c;

        if(c>maxC)
            maxC=c;
    }

    history.push({
        timeSeconds:time,

        frontSurfaceC:
            toCelsius(T[0]),

        centerC:
            toCelsius(
                T[centerIndex]
            ),

        backSurfaceC:
            toCelsius(
                T[T.length-1]
            ),

        minC,
        maxC,

        gradientC:
            maxC-minC
    });
}

/* =========================
 * CONVECTIVE ENVIRONMENT
 * ========================= */

function getConvectiveEnvironmentTemperatureC({
                                                  side,
                                                  ambientTemperatureC
                                              }){
    if(!side.enabled)
        return Number.isFinite(
            side.convectiveEnvironmentTemperatureC
        )
            ?side.convectiveEnvironmentTemperatureC
            :ambientTemperatureC;

    const factor=Number.isFinite(
        side.airTemperatureFactor
    )
        ?clamp(
            side.airTemperatureFactor,
            0,
            1
        )
        :0.50;

    const heaterTemperatureC=
        Number.isFinite(
            side.heaterTemperatureC
        )
            ?side.heaterTemperatureC
            :ambientTemperatureC;

    return ambientTemperatureC+
        factor*
        (
            heaterTemperatureC-
            ambientTemperatureC
        );
}

/* =========================
 * LINEARIZED SURFACE FLUX
 * ========================= */

function linearizeSurfaceFlux({
                                  side,
                                  material,
                                  surfaceTemperatureK,
                                  ambientRadiationTemperatureC,
                                  ambientTemperatureC,
                                  sheetEmissivity,
                                  ambientViewFactor
                              }){
    const Ts=
        surfaceTemperatureK;

    const Ta=
        toKelvin(
            ambientRadiationTemperatureC
        );

    let constantFlux=0;
    let temperatureCoefficient=0;

    /* =========================
     * Radiative heater
     * ========================= */

    if(side.enabled){
        const reflectance=clamp(
            Number.isFinite(
                side.surfaceReflectance
            )
                ?side.surfaceReflectance
                :Number(
                material.surfaceReflectance
            )||0,
            0,
            0.999999
        );

        const absorption=
            1-reflectance;

        if(
            side.radiationMode===
            "heatFlux"
        ){
            const q=
                Math.max(
                    0,
                    Number(
                        side.heatFluxWm2
                    )||0
                )*
                absorption;

            constantFlux+=q;
        }else{
            const Th=
                toKelvin(
                    side.heaterTemperatureC
                );

            const gain=
                Number(
                    side.radiationGain
                )||0;

            const emissivity=
                Number(
                    side.heaterEmissivity
                )||0;

            const viewFactor=
                Number(
                    side.viewFactor
                )||0;

            const A=
                gain*
                emissivity*
                viewFactor*
                SIGMA;

            /*
             * qrad =
             * A * (Th^4 - Ts^4)
             *
             * First-order implicit
             * linearization around Ts.
             */
            if(Th>Ts){
                constantFlux+=
                    absorption*
                    A*
                    (
                        Th**4+
                        3*Ts**4
                    );

                temperatureCoefficient+=
                    absorption*
                    A*
                    4*
                    Ts**3;
            }
        }

        /* =========================
         * Convection from machine
         *
         * Tair =
         * Tamb +
         * factor*(Theater-Tamb)
         *
         * qconv =
         * alpha*(Tair-Tsurface)
         * ========================= */

        const alpha=
            Number.isFinite(
                side.convectiveHeatTransferCoefficient
            )
                ?Math.max(
                    0,
                    side.convectiveHeatTransferCoefficient
                )
                :0;

        const environmentTemperatureC=
            getConvectiveEnvironmentTemperatureC({
                side,
                ambientTemperatureC
            });

        constantFlux+=
            alpha*
            toKelvin(
                environmentTemperatureC
            );

        temperatureCoefficient+=
            alpha;
    }else{
        /* =========================
         * Non-heated side:
         * convection to room air.
         * ========================= */

        const alphaAmbient=
            Number.isFinite(
                side.convectiveHeatTransferCoefficient
            )
                ?Math.max(
                    0,
                    side.convectiveHeatTransferCoefficient
                )
                :5;

        const environmentTemperatureC=
            Number.isFinite(
                side.convectiveEnvironmentTemperatureC
            )
                ?side.convectiveEnvironmentTemperatureC
                :ambientTemperatureC;

        constantFlux+=
            alphaAmbient*
            toKelvin(
                environmentTemperatureC
            );

        temperatureCoefficient+=
            alphaAmbient;
    }

    /* =========================
     * Ambient radiation
     * ========================= */

    const radiationA=
        sheetEmissivity*
        ambientViewFactor*
        SIGMA;

    constantFlux+=
        radiationA*
        (
            Ta**4+
            3*Ts**4
        );

    temperatureCoefficient+=
        radiationA*
        4*
        Ts**3;

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
){
    const n=
        diagonal.length;

    for(let i=1;i<n;i++){
        const factor=
            lower[i]/
            diagonal[i-1];

        diagonal[i]-=
            factor*
            upper[i-1];

        rhs[i]-=
            factor*
            rhs[i-1];
    }

    result[n-1]=
        rhs[n-1]/
        diagonal[n-1];

    for(
        let i=n-2;
        i>=0;
        i--
    ){
        result[i]=
            (
                rhs[i]-
                upper[i]*
                result[i+1]
            )/
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
                                  }){
    positiveNumber(
        thicknessMm,
        "thicknessMm"
    );

    positiveNumber(
        maxTimeSeconds,
        "maxTimeSeconds"
    );

    if(storeHistory)
        positiveNumber(
            sampleEverySeconds,
            "sampleEverySeconds"
        );

    const effectiveDxMm=
        Number.isFinite(dxMm)&&
        dxMm>0
            ?dxMm
            :calculateDxMm(
                thicknessMm
            );

    const normalizedMachine=
        normalizeMachine(
            machine
        );

    const {
        initialTemperatureC,
        ambientTemperatureC,
        ambientRadiationTemperatureC
    }=thermalConditions;

    if(!Number.isFinite(
        initialTemperatureC
    )){
        throw new Error(
            "initialTemperatureC must be finite"
        );
    }

    if(!Number.isFinite(
        ambientTemperatureC
    )){
        throw new Error(
            "ambientTemperatureC must be finite"
        );
    }

    if(!Number.isFinite(
        ambientRadiationTemperatureC
    )){
        throw new Error(
            "ambientRadiationTemperatureC must be finite"
        );
    }

    const thicknessM=
        thicknessMm/1000;

    const {
        nodeCount,
        dx,
        x
    }=createGrid(
        thicknessM,
        effectiveDxMm/1000
    );

    const materialModel=
        createMaterialModel(
            material
        );

    const dt=
        Number.isFinite(
            dtSeconds
        )&&dtSeconds>0
            ?dtSeconds
            :DEFAULT_DT_SECONDS;

    const {
        top:topSide,
        bottom:bottomSide
    }=resolveSides({
        sides,
        machine:
        normalizedMachine
    });

    const sheetEmissivity=
        clamp(
            Number.isFinite(
                material.emissivity
            )
                ?material.emissivity
                :0.93,
            0,
            1
        );

    const topAmbientViewFactor=
        clamp(
            Number.isFinite(
                topSide.ambientViewFactor
            )
                ?topSide.ambientViewFactor
                :1-clamp(
                Number(
                    topSide.viewFactor
                )||0,
                0,
                1
            ),
            0,
            1
        );

    const bottomAmbientViewFactor=
        clamp(
            Number.isFinite(
                bottomSide.ambientViewFactor
            )
                ?bottomSide.ambientViewFactor
                :1-clamp(
                Number(
                    bottomSide.viewFactor
                )||0,
                0,
                1
            ),
            0,
            1
        );

    /* =========================
     * ARRAYS
     * ========================= */

    const T=
        new Float64Array(
            nodeCount
        );

    const Tnext=
        new Float64Array(
            nodeCount
        );

    const lower=
        new Float64Array(
            nodeCount
        );

    const diagonal=
        new Float64Array(
            nodeCount
        );

    const upper=
        new Float64Array(
            nodeCount
        );

    const rhs=
        new Float64Array(
            nodeCount
        );

    T.fill(
        toKelvin(
            initialTemperatureC
        )
    );

    const centerIndex=
        Math.floor(
            (nodeCount-1)/2
        );

    let time=0;

    let reachedTarget=
        targetReached({
            T,
            centerIndex,
            target
        });

    let status=null;

    let nextSampleTime=
        storeHistory
            ?sampleEverySeconds
            :Infinity;

    const history=
        storeHistory
            ?[]
            :null;

    if(storeHistory){
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

    while(
        !reachedTarget&&
        time<maxTimeSeconds
        ){
        const stepDt=
            Math.min(
                dt,
                maxTimeSeconds-time
            );

        Tnext.set(T);

        for(
            let nonlinearIteration=0;
            nonlinearIteration<
            MAX_NONLINEAR_ITERATIONS;
            nonlinearIteration++
        ){
            const oldT=
                nonlinearIteration===0
                    ?T
                    :Tnext;

            /* =========================
             * Internal nodes
             * ========================= */

            for(
                let i=1;
                i<nodeCount-1;
                i++
            ){
                const temperatureC=
                    toCelsius(
                        oldT[i]
                    );

                const {
                    density,
                    k,
                    cp
                }=
                    materialModel.get(
                        temperatureC
                    );

                const capacity=
                    density*
                    cp/
                    stepDt;

                const conduction=
                    k/
                    (dx*dx);

                lower[i]=
                    -conduction;

                diagonal[i]=
                    capacity+
                    2*conduction;

                upper[i]=
                    -conduction;

                rhs[i]=
                    capacity*
                    T[i];
            }

            /* =========================
             * Top surface
             * heater[0]
             * ========================= */

            {
                const i=0;

                const temperatureK=
                    oldT[i];

                const temperatureC=
                    toCelsius(
                        temperatureK
                    );

                const {
                    density,
                    k,
                    cp
                }=
                    materialModel.get(
                        temperatureC
                    );

                const capacity=
                    density*
                    cp/
                    stepDt;

                const conduction=
                    2*k/
                    (dx*dx);

                const {
                    constantFlux,
                    temperatureCoefficient
                }=
                    linearizeSurfaceFlux({
                        side:
                        topSide,

                        material,

                        surfaceTemperatureK:
                        temperatureK,

                        ambientRadiationTemperatureC,

                        ambientTemperatureC,

                        sheetEmissivity,

                        ambientViewFactor:
                        topAmbientViewFactor
                    });

                lower[i]=0;

                diagonal[i]=
                    capacity+
                    conduction+
                    2*
                    temperatureCoefficient/
                    dx;

                upper[i]=
                    -conduction;

                rhs[i]=
                    capacity*
                    T[i]+
                    2*
                    constantFlux/
                    dx;
            }

            /* =========================
             * Bottom surface
             * heater[1]
             * ========================= */

            {
                const i=
                    nodeCount-1;

                const temperatureK=
                    oldT[i];

                const temperatureC=
                    toCelsius(
                        temperatureK
                    );

                const {
                    density,
                    k,
                    cp
                }=
                    materialModel.get(
                        temperatureC
                    );

                const capacity=
                    density*
                    cp/
                    stepDt;

                const conduction=
                    2*k/
                    (dx*dx);

                const {
                    constantFlux,
                    temperatureCoefficient
                }=
                    linearizeSurfaceFlux({
                        side:
                        bottomSide,

                        material,

                        surfaceTemperatureK:
                        temperatureK,

                        ambientRadiationTemperatureC,

                        ambientTemperatureC,

                        sheetEmissivity,

                        ambientViewFactor:
                        bottomAmbientViewFactor
                    });

                lower[i]=
                    -conduction;

                diagonal[i]=
                    capacity+
                    conduction+
                    2*
                    temperatureCoefficient/
                    dx;

                upper[i]=0;

                rhs[i]=
                    capacity*
                    T[i]+
                    2*
                    constantFlux/
                    dx;
            }

            /* =========================
             * Solve
             * ========================= */

            solveTridiagonal(
                lower,
                diagonal,
                upper,
                rhs,
                Tnext
            );

            /* =========================
             * Nonlinear convergence
             * ========================= */

            let maxDeltaC=0;

            for(
                let i=0;
                i<nodeCount;
                i++
            ){
                const deltaC=
                    Math.abs(
                        Tnext[i]-
                        oldT[i]
                    );

                if(deltaC>maxDeltaC)
                    maxDeltaC=
                        deltaC;
            }

            if(
                maxDeltaC<=
                NONLINEAR_TOLERANCE_C
            )
                break;
        }

        T.set(Tnext);

        time+=stepDt;

        /* =========================
         * Numerical safety
         * ========================= */

        for(
            let i=0;
            i<nodeCount;
            i++
        ){
            if(
                !Number.isFinite(T[i])||
                T[i]<100||
                T[i]>1500
            ){
                throw new Error(
                    `Numerical instability at `+
                    `${time.toFixed(3)} s. `+
                    `Check model parameters.`
                );
            }
        }

        /* =========================
         * Material safety
         * ========================= */

        status=
            checkDecomposition({
                T,
                centerIndex,
                material
            });

        if(status)
            break;

        reachedTarget=
            targetReached({
                T,
                centerIndex,
                target
            });

        /* =========================
         * History
         * ========================= */

        if(
            storeHistory&&
            time+1e-12>=nextSampleTime
        ){
            saveHistorySample({
                T,
                centerIndex,
                history,
                time
            });

            while(
                nextSampleTime<=
                time+1e-12
                ){
                nextSampleTime+=
                    sampleEverySeconds;
            }
        }
    }

    /* =========================
     * FINAL TEMPERATURES
     * ========================= */

    const temperatureProfile=
        Array.from(
            T,
            (temperatureK,i)=>({
                xMm:x[i]*1000,
                temperatureC:
                    toCelsius(
                        temperatureK
                    )
            })
        );

    const frontTemperatureC=
        temperatureProfile[0]
            .temperatureC;

    const backTemperatureC=
        temperatureProfile[
        temperatureProfile.length-1
            ].temperatureC;

    const centerTemperatureC=
        temperatureProfile[
            centerIndex
            ].temperatureC;

    const maxSurfaceTemperatureC=
        Math.max(
            frontTemperatureC,
            backTemperatureC
        );

    /* =========================
     * FINAL STATUS
     * ========================= */

    if(!status){
        const maxTimeReached=
            !reachedTarget&&
            time>=maxTimeSeconds;

        status=
            maxTimeReached
                ?{
                    type:"error",
                    message:
                        `Max time ${maxTimeSeconds}s; `+
                        `target ${target.minCenterC}°C not reached.`
                }
                :maxSurfaceTemperatureC>
                material.defaultTSurf
                    ?{
                        type:"warning",
                        message:
                            `Surface `+
                            `${maxSurfaceTemperatureC.toFixed(1)}°C > `+
                            `${material.defaultTSurf}°C.`
                    }
                    :{
                        type:"ok",
                        message:null
                    };
    }

    const result={
        status,
        heatingTimeSeconds:time,
        reachedTarget,
        temperatureProfile
    };

    if(storeHistory)
        result.history=history;

    /* =========================
     * DIAGNOSTICS
     * ========================= */

    if(includeBreakdown){
        const zeroFlux={
            incidentWm2:0,
            reflectedWm2:0,
            effectiveWm2:0
        };

        const topFlux=
            topSide.enabled
                ?calculateEffectiveIncidentFlux({
                    side:topSide,
                    material,
                    surfaceTemperatureC:
                    frontTemperatureC
                })
                :zeroFlux;

        const bottomFlux=
            bottomSide.enabled
                ?calculateEffectiveIncidentFlux({
                    side:bottomSide,
                    material,
                    surfaceTemperatureC:
                    backTemperatureC
                })
                :zeroFlux;

        const materialProperties=
            materialModel.get(
                centerTemperatureC
            );

        const topEnvironmentTemperatureC=
            getConvectiveEnvironmentTemperatureC({
                side:topSide,
                ambientTemperatureC
            });

        const bottomEnvironmentTemperatureC=
            getConvectiveEnvironmentTemperatureC({
                side:bottomSide,
                ambientTemperatureC
            });

        result.diagnostics={
            nodeCount,

            dxMm:
                dx*1000,

            requestedDxMm:
            effectiveDxMm,

            automaticDx:
                !(Number.isFinite(dxMm)&&
                    dxMm>0),

            dtSeconds:dt,

            requestedDtSeconds:
                Number.isFinite(dtSeconds)&&
                dtSeconds>0
                    ?dtSeconds
                    :DEFAULT_DT_SECONDS,

            automaticDt:
                !(Number.isFinite(dtSeconds)&&
                    dtSeconds>0),

            thermalDiffusivityM2s:
                materialProperties.k/
                (
                    materialProperties.density*
                    materialProperties.cp
                ),

            numericalControl:{
                gridCellsPerThickness:
                GRID_CELLS_PER_THICKNESS,

                minDxMm:MIN_DX_MM,

                maxDxMm:MAX_DX_MM,

                defaultDtSeconds:
                DEFAULT_DT_SECONDS,

                nonlinearIterations:
                MAX_NONLINEAR_ITERATIONS,

                nonlinearToleranceC:
                NONLINEAR_TOLERANCE_C
            },

            safety:{
                warningSurfaceTempC:
                material.defaultTSurf,

                decompositionTempC:
                material.decompositionTemp,

                actualMaxSurfaceC:
                maxSurfaceTemperatureC,

                status,

                maxTimeReached:
                    !reachedTarget&&
                    time>=maxTimeSeconds
            },

            target:{
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

            heatBalance:{
                top:topFlux,
                bottom:bottomFlux,

                convection:{
                    top:{
                        coefficientWm2K:
                            Number(
                                topSide
                                    .convectiveHeatTransferCoefficient
                            )||0,

                        airTemperatureFactor:
                            Number.isFinite(
                                topSide.airTemperatureFactor
                            )
                                ?topSide.airTemperatureFactor
                                :0.50,

                        environmentTemperatureC:
                        topEnvironmentTemperatureC
                    },

                    bottom:{
                        coefficientWm2K:
                            Number(
                                bottomSide
                                    .convectiveHeatTransferCoefficient
                            )||0,

                        airTemperatureFactor:
                            Number.isFinite(
                                bottomSide.airTemperatureFactor
                            )
                                ?bottomSide.airTemperatureFactor
                                :0.50,

                        environmentTemperatureC:
                        bottomEnvironmentTemperatureC
                    }
                }
            },

            machine:{
                heaterCount:
                normalizedMachine.heaters.length,

                top:
                normalizedMachine.top,

                bottom:
                normalizedMachine.bottom
            },

            numerical:{
                implicitScheme:true,

                solver:
                    "Tridiagonal Thomas algorithm",

                stabilityCriterion:
                    "Unconditionally stable for linear diffusion equation",

                thermalPropertyModel:
                    materialModel.constant
                        ?"constant"
                        :"temperature-dependent",

                opticalModel:
                    "Opaque sheet; absorbed heater radiation applied at surfaces",

                boundaryModel:
                    "implicit conduction + linearized convection + linearized radiation",

                heaterModel:
                    "temperature-based thermal radiation from resistive heater elements",

                convectionModel:
                    "q = h * (Tair - Tsurface), Tair = Tamb + factor * (Theater - Tamb)",

                methodology:
                    "1D through-thickness finite-difference model based on machine-specific convection/radiation parameters"
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
                                            }){
    targetMinC??=
        material.defaultTCenter;

    targetMaxC??=
        material.defaultTSurf;

    if(!Number.isFinite(targetMinC))
        throw new Error(
            "targetMinC must be finite"
        );

    if(!Number.isFinite(targetMaxC))
        throw new Error(
            "targetMaxC must be finite"
        );

    if(!Number.isFinite(
        material.decompositionTemp
    )){
        throw new Error(
            "material.decompositionTemp must be finite"
        );
    }

    return simulate1DHeating({
        thicknessMm,
        material,
        machine,
        thermalConditions,

        sides:heaterMode,

        target:{
            minCenterC:targetMinC,
            maxSurfaceC:targetMaxC
        },

        ...options
    });
}