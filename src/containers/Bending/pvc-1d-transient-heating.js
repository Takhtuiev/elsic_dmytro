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
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const toKelvin=c=>c+273.15;
const validPositive=v=>Number.isFinite(v)&&v>0;

const getProperty=(property,temperatureC)=>
    typeof property==="function"
        ?property(temperatureC)
        :property;

function getMaterialProperties(material,temperatureC){
    return {
        density:getProperty(material?.density,temperatureC),
        k:getProperty(material?.thermalConductivity,temperatureC),
        cp:getProperty(material?.specificHeat,temperatureC)
    };
}

function createMaterialModel(material){
    if(!material||typeof material!=="object")
        return null;

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
                :getMaterialProperties(material,temperatureC)
    };
}

const makeError=(message,extra={})=>({
    status:{type:"error",message},
    heatingTimeSeconds:0,
    reachedTarget:false,
    temperatureProfile:[],
    ...extra
});

export function normalizeMachine(machine){
    if(!machine||typeof machine!=="object")
        return null;

    if(
        !Array.isArray(machine.heaters)||
        machine.heaters.length<1||
        machine.heaters.length>2
    ){
        return null;
    }

    const top={...machine.heaters[0]};

    const bottom=
        machine.heaters.length===2
            ?{...top,...(machine.heaters[1]||{})}
            :null;

    return {
        ...machine,
        top,
        bottom
    };
}

function calculateDxMm(thicknessMm){
    return clamp(
        thicknessMm/GRID_CELLS_PER_THICKNESS,
        MIN_DX_MM,
        MAX_DX_MM
    );
}

function createGrid(thicknessM,requestedDxM){
    const nodeCount=Math.max(
        5,
        Math.round(thicknessM/requestedDxM)+1
    );

    const dx=thicknessM/(nodeCount-1);
    const x=new Float64Array(nodeCount);

    for(let i=0;i<nodeCount;i++)
        x[i]=i*dx;

    return {
        nodeCount,
        dx,
        x
    };
}

/* =========================
 * THERMAL PHYSICS MODEL
 * ========================= */
export function getHeaterTemperatureC({
    side,
    ambientTemperatureC
}){
    const regulatorTemperatureC=
        Number.isFinite(side.regulatorTemperatureC)
            ?side.regulatorTemperatureC
            :ambientTemperatureC;

    const heaterTemperatureFactor=
        Number.isFinite(side.heaterTemperatureFactor)
            ?side.heaterTemperatureFactor
            :1;

    return regulatorTemperatureC*heaterTemperatureFactor;
}

export function calculateIncidentHeaterFlux({
    side,
    surfaceTemperatureC,
    ambientTemperatureC=20
}){
    if(!side.enabled)
        return 0;

    if(side.radiationMode==="heatFlux")
        return Math.max(
            0,
            Number(side.heatFluxWm2)||0
        );

    const Th=toKelvin(
        getHeaterTemperatureC({
            side,
            ambientTemperatureC
        })
    );

    const Ts=toKelvin(surfaceTemperatureC);

    const epsilon=clamp(
        Number.isFinite(side.heaterEmissivity)
            ?side.heaterEmissivity
            :0,
        0,
        1
    );

    const F=clamp(
        Number.isFinite(side.viewFactor)
            ?side.viewFactor
            :0,
        0,
        1
    );

    const gain=
        Number.isFinite(side.radiationGain)
            ?side.radiationGain
            :1;

    return Math.max(
        0,
        gain*
        epsilon*
        F*
        SIGMA*
        (Th**4-Ts**4)
    );
}

export function calculateEffectiveIncidentFlux({
    side,
    material,
    surfaceTemperatureC,
    ambientTemperatureC=20
}){
    const incidentWm2=calculateIncidentHeaterFlux({
        side,
        surfaceTemperatureC,
        ambientTemperatureC
    });

    const reflectance=clamp(
        Number.isFinite(side.surfaceReflectance)
            ?side.surfaceReflectance
            :Number(material?.surfaceReflectance)||0,
        0,
        0.999999
    );

    return {
        incidentWm2,
        reflectedWm2:incidentWm2*reflectance,
        effectiveWm2:incidentWm2*(1-reflectance)
    };
}

/**
 * Физически точная линеаризация потоков для закрытого
 * сзади короба с узким зазором 5мм.
 */
const getLinearizedFluxParams=(
    side,
    TsK,
    ambientTemperatureC,
    ambientRadiationTemperatureC,
    sheetEmissivity
)=>{
    if(!side||!side.enabled)
        return {
            g0:0,
            g1:0
        };

    const T_heater_C=getHeaterTemperatureC({
        side,
        ambientTemperatureC
    });

    const T_heater_K=
        T_heater_C+273.15;

    let etaBox=
        Number.isFinite(side.boxEfficiency)
            ?side.boxEfficiency
            :null;

    if(etaBox==null){
        const isTopBox=
            side.position==="top"||
            side.isTop;

        etaBox=isTopBox?0.45:0.60;
    }

    etaBox=clamp(
        etaBox,
        0,
        1
    );

    const T_box_envC=
        ambientTemperatureC+
        etaBox*
        (T_heater_C-ambientTemperatureC);

    const T_box_envK=
        T_box_envC+273.15;

    const h=Math.max(
        0,
        Number(side.convectiveHeatTransferCoefficient)||0
    );

    const q_conv=
        h*
        (T_box_envK-TsK);

    const dq_conv_dTs=-h;

    const fH=clamp(
        Number.isFinite(side.viewFactor)
            ?side.viewFactor
            :0.80,
        0,
        1
    );

    const envF=clamp(
        side.ambientViewFactor??(1-fH),
        0,
        1
    );

    const epsH=clamp(
        Number.isFinite(side.heaterEmissivity)
            ?side.heaterEmissivity
            :0.90,
        0,
        1
    );

    const gain=Math.max(
        0,
        Number.isFinite(side.radiationGain)
            ?side.radiationGain
            :1
    );

    const radA=
        gain*
        epsH*
        sheetEmissivity*
        fH*
        SIGMA;

    const q_rad_heater=
        radA*
        (T_heater_K**4-TsK**4);

    const dq_rad_heater_dTs=
        -4*
        radA*
        TsK**3;

    const epsBox=clamp(
        Number.isFinite(side.boxEmissivity)
            ?side.boxEmissivity
            :0.55,
        0,
        1
    );

    const denom=
        epsBox+
        sheetEmissivity-
        epsBox*
        sheetEmissivity;

    const eps_priv=
        denom>0
            ?(epsBox*sheetEmissivity)/denom
            :0;

    const radEnv=
        eps_priv*
        envF*
        SIGMA;

    const q_rad_box=
        radEnv*
        (T_box_envK**4-TsK**4);

    const dq_rad_box_dTs=
        -4*
        radEnv*
        TsK**3;

    const total_q=
        q_rad_heater+
        q_conv+
        q_rad_box;

    const total_dq_dTs=
        dq_rad_heater_dTs+
        dq_conv_dTs+
        dq_rad_box_dTs;

    return {
        g1:total_dq_dTs,
        g0:total_q-total_dq_dTs*TsK
    };
};

/* =========================
 * TRIDIAGONAL MATRIX SOLVER
 * ========================= */
function solveTridiagonal(
    lower,
    diagonal,
    upper,
    rhs,
    result
){
    const n=diagonal.length;

    const cPrime=new Float64Array(n);
    const dPrime=new Float64Array(n);

    let denom=diagonal[0];

    if(Math.abs(denom)<1e-20)
        return false;

    cPrime[0]=upper[0]/denom;
    dPrime[0]=rhs[0]/denom;

    for(let i=1;i<n;i++){
        denom=
            diagonal[i]-
            lower[i]*
            cPrime[i-1];

        if(Math.abs(denom)<1e-20)
            return false;

        cPrime[i]=
            i<n-1
                ?upper[i]/denom
                :0;

        dPrime[i]=
            (rhs[i]-
                lower[i]*
                dPrime[i-1])/
            denom;
    }

    result[n-1]=dPrime[n-1];

    for(let i=n-2;i>=0;i--){
        result[i]=
            dPrime[i]-
            cPrime[i]*
            result[i+1];
    }

    return true;
}

/* =========================
 * TARGET
 * ========================= */
function isTargetReached(
    T,
    target,
    timeSeconds
){
    if(!target)
        return false;

    if(target.type==="minTemperature"){
        return T.every(
            t=>t>=target.value
        );
    }

    if(target.type==="surfaceTemperature"){
        return (
            T[0]>=target.value||
            T[T.length-1]>=target.value
        );
    }

    if(target.type==="time"){
        return timeSeconds>=target.value;
    }

    return false;
}

/* =========================
 * HEATING
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
    maxTimeSeconds=1800,
    sampleEverySeconds=1,
    storeHistory=false,
    initialTemperatureC=20,
    buffers=null
}){
    let status=null;
    let time=0;

    const simulationMaxTime=
        targetType==="time"&&
        Number.isFinite(targetValue)
            ?Math.min(
                maxTimeSeconds,
                targetValue
            )
            :maxTimeSeconds;

    const bufs=buffers||{
        lower:new Float64Array(nodeCount),
        diagonal:new Float64Array(nodeCount),
        upper:new Float64Array(nodeCount),
        rhs:new Float64Array(nodeCount),
        Tnext:new Float64Array(nodeCount),
        oldT:new Float64Array(nodeCount)
    };

    const lower=bufs.lower;
    const diagonal=bufs.diagonal;
    const upper=bufs.upper;
    const rhs=bufs.rhs;
    const Tnext=bufs.Tnext;
    const oldT=bufs.oldT;

    const T=
        new Float64Array(nodeCount)
            .fill(initialTemperatureC+273.15);

    const history=
        storeHistory
            ?[]
            :null;

    const centerIndex=
        (nodeCount-1)>>1;

    const last=
        nodeCount-1;

    const getBoundary=(side,tVal)=>
        getLinearizedFluxParams(
            side,
            tVal,
            ambT,
            ambRadT,
            epsS
        );

    const getMinC=values=>{
        let min=Infinity;

        for(let i=0;i<values.length;i++){
            if(values[i]<min)
                min=values[i];
        }

        return min-273.15;
    };

    const pushHistory=()=>{
        if(!storeHistory)
            return;

        history.push({
            timeSeconds:time,
            frontSurfaceC:T[0]-273.15,
            centerC:T[centerIndex]-273.15,
            backSurfaceC:T[last]-273.15,
            minTemperatureC:getMinC(T)
        });
    };

    if(storeHistory)
        pushHistory();

    const dt_div_dx=dt/dx;
    const dt_div_dx2=dt/(dx*dx);

    while(time<simulationMaxTime){
        oldT.set(T);

        let converged=false;

        for(
            let iter=0;
            iter<MAX_NONLINEAR_ITERATIONS;
            iter++
        ){
            for(
                let i=1;
                i<last;
                i++
            ){
                const props=
                    matModel.get(
                        T[i]-273.15
                    );

                const r=
                    dt_div_dx2*
                    props.k/
                    (props.density*props.cp);

                lower[i]=upper[i]=-r;
                diagonal[i]=1+2*r;
                rhs[i]=oldT[i];
            }

            const propsTop=
                matModel.get(
                    T[0]-273.15
                );

            const fluxTop=
                getBoundary(
                    topSide,
                    T[0]
                );

            const invVolTop=
                1/
                (propsTop.density*
                 propsTop.cp);

            const factorTop=
                2*
                dt_div_dx*
                invVolTop;

            const condTop=
                2*
                propsTop.k*
                dt_div_dx2*
                invVolTop;

            diagonal[0]=
                1+
                condTop-
                factorTop*
                fluxTop.g1;

            rhs[0]=
                oldT[0]+
                factorTop*
                fluxTop.g0;

            upper[0]=-condTop;

            const propsBot=
                matModel.get(
                    T[last]-273.15
                );

            const fluxBot=
                getBoundary(
                    botSide,
                    T[last]
                );

            const invVolBot=
                1/
                (propsBot.density*
                 propsBot.cp);

            const factorBot=
                2*
                dt_div_dx*
                invVolBot;

            const condBot=
                2*
                propsBot.k*
                dt_div_dx2*
                invVolBot;

            diagonal[last]=
                1+
                condBot-
                factorBot*
                fluxBot.g1;

            rhs[last]=
                oldT[last]+
                factorBot*
                fluxBot.g0;

            lower[last]=-condBot;

            if(!solveTridiagonal(
                lower,
                diagonal,
                upper,
                rhs,
                Tnext
            )){
                break;
            }

            converged=true;

            for(let i=0;i<nodeCount;i++){
                if(
                    Math.abs(
                        Tnext[i]-T[i]
                    )>
                    NONLINEAR_TOLERANCE_K
                ){
                    converged=false;
                    break;
                }
            }

            T.set(Tnext);

            if(converged)
                break;
        }

        if(!converged){
            status={
                type:"error",
                message:`Diverged at ${time.toFixed(2)}s.`
            };
            break;
        }

        /* =========================
         * DEGRADATION
         * ========================= */
        if(
            decompTempK&&
            (
                T[0]>=decompTempK||
                T[last]>=decompTempK
            )
        ){
            let fraction=1;

            if(
                T[0]>=decompTempK&&
                T[0]!==oldT[0]
            ){
                const f=
                    (decompTempK-oldT[0])/
                    (T[0]-oldT[0]);

                if(f>=0&&f<fraction)
                    fraction=f;
            }

            if(
                T[last]>=decompTempK&&
                T[last]!==oldT[last]
            ){
                const f=
                    (decompTempK-oldT[last])/
                    (T[last]-oldT[last]);

                if(f>=0&&f<fraction)
                    fraction=f;
            }

            time+=fraction*dt;

            for(let i=0;i<nodeCount;i++){
                T[i]=
                    oldT[i]+
                    fraction*
                    (T[i]-oldT[i]);
            }

            pushHistory();

            status={
                type:"error",
                message:
                    `Degradation! Surface > ${(decompTempK-273.15).toFixed(0)}°C.`
            };

            break;
        }

        /* =========================
         * TARGET
         * ========================= */
        if(
            targetK!=null&&
            targetType!=="time"
        ){
            let fraction=0;

            /* All nodes */
            if(targetType==="minTemperature"){
                let canReach=true;

                for(let i=0;i<nodeCount;i++){
                    if(oldT[i]>=targetK)
                        continue;

                    if(T[i]<targetK){
                        canReach=false;
                        break;
                    }

                    const dT=
                        T[i]-oldT[i];

                    if(dT<=0){
                        canReach=false;
                        break;
                    }

                    fraction=Math.max(
                        fraction,
                        (targetK-oldT[i])/dT
                    );
                }

                if(
                    canReach&&
                    fraction<=1
                ){
                    time+=fraction*dt;

                    for(let i=0;i<nodeCount;i++){
                        T[i]=
                            oldT[i]+
                            fraction*
                            (T[i]-oldT[i]);
                    }

                    pushHistory();
                    break;
                }
            }

            /* At least one surface */
            if(targetType==="surfaceTemperature"){
                const surfaces=[0,last];

                for(const i of surfaces){
                    if(
                        oldT[i]<targetK&&
                        T[i]>=targetK
                    ){
                        const dT=
                            T[i]-oldT[i];

                        if(dT>0){
                            const f=
                                (targetK-oldT[i])/
                                dT;

                            if(
                                fraction===0||
                                f<fraction
                            ){
                                fraction=f;
                            }
                        }
                    }
                }

                if(
                    oldT[0]>=targetK||
                    oldT[last]>=targetK
                ){
                    fraction=0;
                }

                if(
                    fraction>=0&&
                    fraction<=1&&
                    (
                        oldT[0]>=targetK||
                        oldT[last]>=targetK||
                        T[0]>=targetK||
                        T[last]>=targetK
                    )
                ){
                    time+=fraction*dt;

                    for(let i=0;i<nodeCount;i++){
                        T[i]=
                            oldT[i]+
                            fraction*
                            (T[i]-oldT[i]);
                    }

                    pushHistory();
                    break;
                }
            }
        }

        time+=dt;

        if(
            storeHistory&&
            (
                Math.abs(
                    time%sampleEverySeconds
                )<dt/2||
                time>=simulationMaxTime
            )
        ){
            pushHistory();
        }
    }

    const reachedTarget=
        targetType==="time"
            ?time>=targetValue
            :targetK==null
                ?false
                :isTargetReached(
                    T,
                    {
                        type:targetType,
                        value:targetK
                    },
                    time
                );

    if(!status){
        status={
            type:"ok",
            message:"Compiled successfully."
        };
    }

    if(
        !reachedTarget&&
        time>=simulationMaxTime
    ){
        if(targetType==="time"){
            status={
                type:"error",
                message:
                    `Timeout: Target time ${targetValue}s not reached.`
            };
        }else if(targetType){
            status={
                type:"error",
                message:
                    `Timeout: Target ${targetValue}°C not reached.`
            };
        }
    }

    return {
        temperatureProfileK:new Float64Array(T),
        heatingTimeSeconds:time,
        reachedTarget,
        status,
        history,
        buffers:bufs
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
    cooldownTimeSeconds=10,
    maxNonlinearIterations=3,
    nonlinearToleranceK=0.1,
    buffers
}){
    let cooldownTime=0;

    const lower=buffers.lower;
    const diagonal=buffers.diagonal;
    const upper=buffers.upper;
    const rhs=buffers.rhs;
    const T_cool_next=buffers.Tnext;
    const oldT_cool=buffers.oldT;

    const T_cool=
        new Float64Array(initialProfileK);

    const T_room_K=
        ambT+273.15;

    const T_rad_room_K=
        ambRadT+273.15;

    const T_rad_room_K_2=
        T_rad_room_K*
        T_rad_room_K;

    const h_cool=7.5;
    const last=nodeCount-1;

    const dt_div_dx=dt/dx;
    const dt_div_dx2=dt/(dx*dx);

    const getCooldownBoundary=tSurfK=>{
        const h_rad=
            epsS*
            SIGMA*
            (
                T_rad_room_K_2+
                tSurfK*tSurfK
            )*
            (
                T_rad_room_K+
                tSurfK
            );

        const g0=
            h_cool*T_room_K+
            h_rad*T_rad_room_K;

        const g1=
            -(h_cool+h_rad);

        return {
            g0,
            g1
        };
    };

    while(
        cooldownTime<
        cooldownTimeSeconds
    ){
        oldT_cool.set(T_cool);

        let converged=false;

        for(
            let iter=0;
            iter<maxNonlinearIterations;
            iter++
        ){
            for(
                let i=1;
                i<last;
                i++
            ){
                const props=
                    matModel.get(
                        T_cool[i]-273.15
                    );

                const r=
                    dt_div_dx2*
                    props.k/
                    (props.density*props.cp);

                lower[i]=upper[i]=-r;
                diagonal[i]=1+2*r;
                rhs[i]=oldT_cool[i];
            }

            const propsTop=
                matModel.get(
                    T_cool[0]-273.15
                );

            const fluxTop=
                getCooldownBoundary(
                    T_cool[0]
                );

            const invVolTop=
                1/
                (
                    propsTop.density*
                    propsTop.cp
                );

            const factorTop=
                2*
                dt_div_dx*
                invVolTop;

            const condTop=
                2*
                propsTop.k*
                dt_div_dx2*
                invVolTop;

            diagonal[0]=
                1+
                condTop-
                factorTop*
                fluxTop.g1;

            rhs[0]=
                oldT_cool[0]+
                factorTop*
                fluxTop.g0;

            upper[0]=-condTop;

            const propsBot=
                matModel.get(
                    T_cool[last]-273.15
                );

            const fluxBot=
                getCooldownBoundary(
                    T_cool[last]
                );

            const invVolBot=
                1/
                (
                    propsBot.density*
                    propsBot.cp
                );

            const factorBot=
                2*
                dt_div_dx*
                invVolBot;

            const condBot=
                2*
                propsBot.k*
                dt_div_dx2*
                invVolBot;

            diagonal[last]=
                1+
                condBot-
                factorBot*
                fluxBot.g1;

            rhs[last]=
                oldT_cool[last]+
                factorBot*
                fluxBot.g0;

            lower[last]=-condBot;

            if(!solveTridiagonal(
                lower,
                diagonal,
                upper,
                rhs,
                T_cool_next
            )){
                break;
            }

            converged=true;

            for(let i=0;i<nodeCount;i++){
                if(
                    Math.abs(
                        T_cool_next[i]-
                        T_cool[i]
                    )>
                    nonlinearToleranceK
                ){
                    converged=false;
                    break;
                }
            }

            T_cool.set(T_cool_next);

            if(converged)
                break;
        }

        if(!converged)
            break;

        cooldownTime+=dt;
    }

    return {
        temperatureProfileK:
            new Float64Array(T_cool),
        cooldownTimeSeconds:
            cooldownTime
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
    sides="both",
    dxMm,
    dtSeconds,
    sampleEverySeconds=1,
    storeHistory=false,
    includeBreakdown=false
}){
    let status=null;

    if(!simulation){
        return makeError(
            "Simulation parameters are missing."
        );
    }

    const target=simulation.target||{};

    const targetType=
        target.type??null;

    const targetValueRaw=
        Number(target.value);

    const targetValue=
        Number.isFinite(targetValueRaw)
            ?targetValueRaw
            :null;

    const initT=
        Number.isFinite(
            Number(simulation.initialTemperatureC)
        )
            ?Number(simulation.initialTemperatureC)
            :20;

    const ambT=
        Number.isFinite(
            Number(simulation.ambientTemperatureC)
        )
            ?Number(simulation.ambientTemperatureC)
            :20;

    const ambRadT=
        Number.isFinite(
            Number(simulation.ambientRadiationTemperatureC)
        )
            ?Number(simulation.ambientRadiationTemperatureC)
            :ambT;

    const maxTimeSeconds=
        Number.isFinite(
            Number(simulation.maxTimeSeconds)
        )
            ?Number(simulation.maxTimeSeconds)
            :1800;

    const cooldownTimeSeconds=
        Number.isFinite(
            Number(simulation.cooldownTimeSeconds)
        )
            ?Number(simulation.cooldownTimeSeconds)
            :10;

    const dt=
        Number.isFinite(Number(dtSeconds))&&
        Number(dtSeconds)>0
            ?Number(dtSeconds)
            :DEFAULT_DT_SECONDS;

    if(!validPositive(thicknessMm)){
        status={
            type:"error",
            message:"Invalid thickness."
        };
    }

    if(!validPositive(maxTimeSeconds)){
        status={
            type:"error",
            message:
                "Invalid maximum simulation time."
        };
    }

    if(cooldownTimeSeconds<0){
        status={
            type:"error",
            message:
                "Cooldown time cannot be negative."
        };
    }

    if(
        targetType!=="minTemperature"&&
        targetType!=="surfaceTemperature"&&
        targetType!=="time"
    ){
        status={
            type:"error",
            message:
                "Invalid simulation target type."
        };
    }

    if(targetValue===null){
        status={
            type:"error",
            message:
                "Invalid simulation target value."
        };
    }

    if(
        targetType==="time"&&
        targetValue<=0
    ){
        status={
            type:"error",
            message:
                "Target time must be greater than 0."
        };
    }

    const mach=
        normalizeMachine(machine);

    if(!status&&!mach){
        status={
            type:"error",
            message:"Invalid machine."
        };
    }

    const matModel=
        createMaterialModel(material);

    if(!status&&!matModel){
        status={
            type:"error",
            message:
                "Invalid material model."
        };
    }

    const requestedDxMm=
        Number.isFinite(Number(dxMm))&&
        Number(dxMm)>0
            ?Number(dxMm)
            :calculateDxMm(
                status
                    ?2
                    :thicknessMm
            );

    const dx=
        requestedDxMm/1000;

    const {nodeCount}=
        createGrid(
            (status?2:thicknessMm)/1000,
            dx
        );

    const buffers={
        lower:new Float64Array(nodeCount),
        diagonal:new Float64Array(nodeCount),
        upper:new Float64Array(nodeCount),
        rhs:new Float64Array(nodeCount),
        Tnext:new Float64Array(nodeCount),
        oldT:new Float64Array(nodeCount)
    };

    const decompTemp=
        Number(material?.decompositionTemp);

    const decompTempK=
        Number.isFinite(decompTemp)
            ?toKelvin(decompTemp)
            :null;

    const targetK=
        (
            targetType==="minTemperature"||
            targetType==="surfaceTemperature"
        )&&
        targetValue!==null
            ?toKelvin(targetValue)
            :null;

    const useTop=
        sides==="both"||
        sides==="top"||
        sides==="one-sided-top";

    const useBot=
        sides==="both"||
        sides==="bottom"||
        sides==="one-sided-bottom";

    const topSide=
        mach
            ?{
                ...(mach.top||{}),
                enabled:
                    useTop&&!!mach.top,
                position:"top"
            }
            :{
                enabled:false
            };

    const botSide=
        mach
            ?{
                ...(mach.bottom||{}),
                enabled:
                    useBot&&!!mach.bottom,
                position:"bottom"
            }
            :{
                enabled:false
            };

    const epsS=clamp(
        Number(material?.emissivity)||
        0.93,
        0,
        1
    );

    if(status){
        return makeError(
            status.message
        );
    }

    /* =========================
     * HEATING
     * ========================= */
    const heating=simulateHeating({
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

        maxTimeSeconds,
        sampleEverySeconds,
        storeHistory,

        initialTemperatureC:initT,

        buffers
    });

    status=heating.status;

    if(
        status?.type==="error"&&
        heating.heatingTimeSeconds===0
    ){
        return makeError(
            status.message
        );
    }

    const heatingProfileK=
        heating.temperatureProfileK;

    /* =========================
     * COOLDOWN
     * ========================= */
    const cooldown=simulateCooldown({
        initialProfileK:heatingProfileK,
        nodeCount,
        dx,
        dt,
        matModel,
        epsS,
        ambT,
        ambRadT,

        cooldownTimeSeconds,

        maxNonlinearIterations:
            MAX_NONLINEAR_ITERATIONS,

        nonlinearToleranceK:
            NONLINEAR_TOLERANCE_K,

        buffers
    });

    const cooldownProfileK=
        cooldown.temperatureProfileK;

    const heatingProfileC=
        new Float64Array(nodeCount);

    const cooldownProfileC=
        new Float64Array(nodeCount);

    for(let i=0;i<nodeCount;i++){
        heatingProfileC[i]=
            heatingProfileK[i]-273.15;

        cooldownProfileC[i]=
            cooldownProfileK[i]-273.15;
    }

    const centerIndex=
        (nodeCount-1)>>1;

    const centerC=
        heatingProfileC[centerIndex];

    const frontC=
        heatingProfileC[0];

    const backC=
        heatingProfileC[nodeCount-1];

    let minTemperatureC=Infinity;

    for(let i=0;i<nodeCount;i++){
        if(
            heatingProfileC[i]<
            minTemperatureC
        ){
            minTemperatureC=
                heatingProfileC[i];
        }
    }

    const res={
        simulation,

        heatingTimeSeconds:
            heating.heatingTimeSeconds,

        cooldownSec:
            cooldownTimeSeconds,

        cooldownTimeSeconds,

        heaterTemperaturesC:{
            top:
                mach.top?.regulatorTemperatureC??
                null,

            bottom:
                mach.bottom?.regulatorTemperatureC??
                null
        },

        reachedTarget:
            heating.reachedTarget,

        status,

        temperatureProfile:{
            temperaturesC:
                heatingProfileC,

            cooldownProfileC:
                cooldownProfileC,

            dxMm:
                dx*1000
        },

        history:
            heating.history
    };

    if(includeBreakdown){
        const {
            density=1400,
            k=0.16,
            cp=1000
        }=
            matModel?.get(centerC)||
            {};

        const diff=
            k/(density*cp);

        const zeroF={
            incidentWm2:0,
            reflectedWm2:0,
            effectiveWm2:0
        };

        res.diagnostics={
            nodeCount,

            dxMm:
                dx*1000,

            requestedDxMm,

            dtSeconds:dt,

            maxStableDtSeconds:
                0.5*
                dx*
                dx/
                diff,

            thermalDiffusivityM2s:
                diff,

            numericalControl:{
                gridCellsPerThickness:
                    GRID_CELLS_PER_THICKNESS,

                minDxMm:
                    MIN_DX_MM,

                maxDxMm:
                    MAX_DX_MM,

                nonlinearIterations:
                    MAX_NONLINEAR_ITERATIONS,

                nonlinearToleranceK:
                    NONLINEAR_TOLERANCE_K,

                fourierNumber:
                    diff*
                    dt/
                    (dx*dx)
            },

            simulation:{
                target:{
                    type:targetType,
                    value:targetValue
                },

                ambientTemperatureC:
                    ambT,

                ambientRadiationTemperatureC:
                    ambRadT,

                initialTemperatureC:
                    initT,

                maxTimeSeconds,

                cooldownTimeSeconds
            },

            target:{
                type:targetType,
                value:targetValue,

                actualCenterC:
                    centerC,

                actualMinTemperatureC:
                    minTemperatureC,

                actualFrontSurfaceC:
                    frontC,

                actualBackSurfaceC:
                    backC,

                decompositionC:
                    decompTemp
            },

            heatBalance:{
                top:
                    topSide.enabled
                        ?calculateEffectiveIncidentFlux({
                            side:topSide,
                            material,
                            surfaceTemperatureC:frontC,
                            ambientTemperatureC:ambT
                        })
                        :zeroF,

                bottom:
                    botSide.enabled
                        ?calculateEffectiveIncidentFlux({
                            side:botSide,
                            material,
                            surfaceTemperatureC:backC,
                            ambientTemperatureC:ambT
                        })
                        :zeroF,

                topRegulatorTemperatureC:
                    topSide.regulatorTemperatureC??
                    null,

                bottomRegulatorTemperatureC:
                    botSide?.regulatorTemperatureC??
                    null,

                topHeaterTemperatureC:
                    topSide.enabled
                        ?getHeaterTemperatureC({
                            side:topSide,
                            ambientTemperatureC:ambT
                        })
                        :null,

                bottomHeaterTemperatureC:
                    botSide.enabled
                        ?getHeaterTemperatureC({
                            side:botSide,
                            ambientTemperatureC:ambT
                        })
                        :null,

                convectionCoefficient:
                    Math.max(
                        0,
                        Number(
                            mach.heatTransferCoefficient
                        )||0
                    )
            }
        };
    }

    return res;
}

/* =========================
 * ERROR ANALYSIS
 * ========================= */
export function calculateFitError({
    simulation,
    measurements,
    weights={
        surface:1,
        center:1
    }
}){
    if(
        !measurements?.length||
        !simulation?.history?.length
    ){
        return {
            rmseC:Infinity
        };
    }

    const history=
        simulation.history;

    let squaredError=0;
    let count=0;

    for(const m of measurements){
        if(
            !Number.isFinite(
                m?.timeSeconds
            )
        ){
            continue;
        }

        let low=0;
        let high=history.length-1;

        while(low<high-1){
            const mid=
                (low+high)>>1;

            if(
                history[mid].timeSeconds<
                m.timeSeconds
            ){
                low=mid;
            }else{
                high=mid;
            }
        }

        const sim=
            Math.abs(
                history[low].timeSeconds-
                m.timeSeconds
            )<
            Math.abs(
                history[high].timeSeconds-
                m.timeSeconds
            )
                ?history[low]
                :history[high];

        if(
            Number.isFinite(
                m.frontSurfaceC
            )
        ){
            squaredError+=
                weights.surface*
                (
                    (
                        sim.frontSurfaceC-
                        m.frontSurfaceC
                    )**2
                );

            count++;
        }

        if(
            Number.isFinite(
                m.centerC
            )
        ){
            squaredError+=
                weights.center*
                (
                    (
                        sim.centerC-
                        m.centerC
                    )**2
                );

            count++;
        }

        if(
            Number.isFinite(
                m.backSurfaceC
            )
        ){
            squaredError+=
                weights.surface*
                (
                    (
                        sim.backSurfaceC-
                        m.backSurfaceC
                    )**2
                );

            count++;
        }
    }

    return count===0
        ?{
            rmseC:Infinity
        }
        :{
            rmseC:
                Math.sqrt(
                    squaredError/count
                ),
            sse:squaredError,
            samples:count
        };
}

/* =========================
 * CALIBRATION
 * ========================= */
export function fitHeatingParameters({
    thicknessMm,
    material,
    machine,
    simulation,
    sides="both",
    measurements,

    initial={
        radiationGain:1,
        heatTransferCoefficient:10
    },

    bounds={
        radiationGain:[0.05,5],
        heatTransferCoefficient:[2,40]
    }
}){
    const validTimes=
        measurements
            .map(
                m=>m?.timeSeconds
            )
            .filter(
                Number.isFinite
            );

    if(!validTimes.length){
        return makeError(
            "Calibration requires at least one valid experimental data check-point."
        );
    }

    const maxMTime=
        Math.max(...validTimes);

    const baseSimulation={
        ...(simulation||{}),
        target:{
            type:"time",
            value:maxMTime
        },
        maxTimeSeconds:
            Math.max(
                Number(
                    simulation?.maxTimeSeconds
                )||0,
                maxMTime+2
            )
    };

    const evaluate=(rg,htc)=>{
        const fitMachine={
            ...machine,

            heatTransferCoefficient:
                htc,

            heaters:
                machine.heaters.map(
                    h=>({
                        ...h,
                        radiationGain:rg
                    })
                )
        };

        const sim=
            simulate1DHeating({
                thicknessMm,
                material,
                machine:fitMachine,
                simulation:baseSimulation,
                sides,
                storeHistory:true
            });

        return calculateFitError({
            simulation:sim,
            measurements
        }).rmseC;
    };

    let bestRg=clamp(
        initial.radiationGain,
        bounds.radiationGain[0],
        bounds.radiationGain[1]
    );

    let bestHtc=clamp(
        initial.heatTransferCoefficient,
        bounds.heatTransferCoefficient[0],
        bounds.heatTransferCoefficient[1]
    );

    let bestErr=
        evaluate(
            bestRg,
            bestHtc
        );

    let stepRg=0.2;
    let stepHtc=2.0;

    const eps=0.01;

    while(
        stepRg>eps||
        stepHtc>eps
    ){
        let improved=false;

        const dirs=[
            [stepRg,0],
            [-stepRg,0],
            [0,stepHtc],
            [0,-stepHtc],
            [stepRg,stepHtc],
            [-stepRg,-stepHtc]
        ];

        for(
            const [dRg,dHtc]
            of dirs
        ){
            const nRg=clamp(
                bestRg+dRg,
                bounds.radiationGain[0],
                bounds.radiationGain[1]
            );

            const nHtc=clamp(
                bestHtc+dHtc,
                bounds.heatTransferCoefficient[0],
                bounds.heatTransferCoefficient[1]
            );

            const err=
                evaluate(
                    nRg,
                    nHtc
                );

            if(err<bestErr){
                bestErr=err;
                bestRg=nRg;
                bestHtc=nHtc;
                improved=true;
            }
        }

        if(!improved){
            stepRg*=0.5;
            stepHtc*=0.5;
        }
    }

    return {
        status:{
            type:"ok",
            message:
                "Calibration finished successfully."
        },

        parameters:{
            radiationGain:bestRg,
            heatTransferCoefficient:bestHtc
        },

        rmseC:bestErr
    };
}
