import {
    snapGridDensityX,
    snapGridDensityY,
    GRID_DENSITY_EXP_X,
    GRID_DENSITY_EXP_Y
} from "./heating2DModel";

const snapTempStepK = rawStep => {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return rawStep;
    const minStep = 0.30;
    const ratio = 1.01;
    const index = Math.round(Math.log(rawStep / minStep) / Math.log(ratio));
    return minStep * Math.pow(ratio, Math.max(0, index));
};

export const OPTIMIZER_BASE_CONFIG = {
    gridDensityX: {
        label: "gridDensityX (Thickness mesh density)",
        unit: "nodes/mm^0.64",
        min: 3.50,
        max: 14.00,
        digits: 4,
        snap: (rawDensity, baseParams) => snapGridDensityX(rawDensity, Number(baseParams.thicknessMm)),
        step: (currentDensity, deltaSteps, baseParams) => {
            const L = Number(baseParams.thicknessMm);
            if (!Number.isFinite(L) || L <= 0) return currentDensity;
            const scale = Math.pow(L, GRID_DENSITY_EXP_X);
            const intervals = Math.max(5, Math.round(currentDensity * scale) + deltaSteps);
            return intervals / scale;
        }
    },
    gridDensityY: {
        label: "gridDensityY (Width mesh density)",
        unit: "nodes/mm^0.30",
        min: 5.00,
        max: 15.00,
        digits: 4,
        snap: (rawDensity, baseParams) => snapGridDensityY(rawDensity, Number(baseParams.simulation?.widthHalfMm)),
        step: (currentDensity, deltaSteps, baseParams) => {
            const W = Number(baseParams.simulation?.widthHalfMm);
            if (!Number.isFinite(W) || W <= 0) return currentDensity;
            const scale = Math.pow(W, GRID_DENSITY_EXP_Y);
            const intervals = Math.max(12, Math.round(currentDensity * scale) + deltaSteps);
            return intervals / scale;
        }
    },
    tempStepK: {
        label: "tempStepK (Temp step)",
        unit: "K",
        min: 0.30,
        max: 2.50,
        digits: 2,
        snap: snapTempStepK,
        step: (currentStep, deltaSteps) => {
            const minStep = 0.30;
            const ratio = 1.01;
            const index = Math.round(Math.log(currentStep / minStep) / Math.log(ratio));
            return minStep * Math.pow(ratio, Math.max(0, index + deltaSteps));
        }
    }
};

// Хелпер для восстановления функций snap и step внутри Web Worker после postMessage
export function resolveOptimizerConfig(rawConfig = OPTIMIZER_BASE_CONFIG) {
    const resolved = {};
    for (const [key, range] of Object.entries(rawConfig)) {
        resolved[key] = {
            ...range,
            ...(typeof OPTIMIZER_BASE_CONFIG[key]?.snap === "function"
                ? { snap: OPTIMIZER_BASE_CONFIG[key].snap }
                : {}),
            ...(typeof OPTIMIZER_BASE_CONFIG[key]?.step === "function"
                ? { step: OPTIMIZER_BASE_CONFIG[key].step }
                : {})
        };
    }
    return resolved;
}

export function getAdaptiveOptimizerBudget(config = OPTIMIZER_BASE_CONFIG, settings = OPTIMIZER_SETTINGS) {
    const numParams = Math.max(1, Object.keys(config || {}).length);

    const initPoints = Number.isFinite(settings?.randomInitPoints)
        ? Math.max(1, Math.floor(settings.randomInitPoints))
        : Math.max(6, numParams * 4);

    const totalIterations = Number.isFinite(settings?.totalBudgetIterations)
        ? Math.max(1, Math.floor(settings.totalBudgetIterations))
        : Math.max(80, numParams * 35 + 20);

    return { initPoints, totalIterations };
}

export const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_error', // minimize_error, minimize_load
    maxErrorScore: 0.20,
    maxAllowedLoad: 250000000,
    randomInitPoints: null,
    totalBudgetIterations: null,
    earlyAbortLoadMultiplier: 2
};
