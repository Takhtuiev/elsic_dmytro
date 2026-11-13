import {snapGridStepX, snapGridStepY} from "./heating2DModel";

// Оптимальный плавный привязчик: ровно +3% на каждый уровень от min (0.30 K) до max (2.50 K)
const snapTempStepK = rawStep => {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return rawStep;
    const minStep = 0.30;
    const ratio = 1.01; // +1.5% на шаг (~142 уровня)
    const index = Math.round(Math.log(rawStep / minStep) / Math.log(ratio));
    return minStep * Math.pow(ratio, Math.max(0, index));
};

export const OPTIMIZER_BASE_CONFIG = {
    gridX: {
        label: "gridX (Thickness step)",
        unit: "mm",
        min: 0.05,
        max: 0.45,
        digits: 4,
        snap: (rawStep, baseParams) => snapGridStepX(rawStep, Number(baseParams.thicknessMm))
    },
    gridY: {
        label: "gridY (Width step)",
        unit: "mm",
        min: 0.20,
        max: 1.50,
        digits: 4,
        snap: (rawStep, baseParams) => snapGridStepY(rawStep, Number(baseParams.simulation?.widthHalfMm))
    },
    tempStepK: {
        label: "tempStepK (Temp step)",
        unit: "K",
        min: 0.30,
        max: 2.50,
        digits: 2,
        snap: snapTempStepK
    }
};

// Хелпер для восстановления функций snap внутри Web Worker после postMessage
export function resolveOptimizerConfig(rawConfig = OPTIMIZER_BASE_CONFIG) {
    const resolved = {};
    for (const [key, range] of Object.entries(rawConfig)) {
        resolved[key] = {
            ...range,
            ...(typeof OPTIMIZER_BASE_CONFIG[key]?.snap === "function"
                ? { snap: OPTIMIZER_BASE_CONFIG[key].snap }
                : {})
        };
    }
    return resolved;
}

export function getAdaptiveOptimizerBudget(config = OPTIMIZER_BASE_CONFIG, settings = OPTIMIZER_SETTINGS) {
    const numParams = Math.max(1, Object.keys(config || {}).length);

    const initPoints = Number.isFinite(settings?.randomInitPoints)
        ? Math.max(1, Math.floor(settings.randomInitPoints))
        : Math.max(6, numParams * 4); // 12 точек для 3 параметров

    const totalIterations = Number.isFinite(settings?.totalBudgetIterations)
        ? Math.max(1, Math.floor(settings.totalBudgetIterations))
        : Math.max(80, numParams * 35 + 20); // 125 шагов для 3 параметров

    return { initPoints, totalIterations };
}

export const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_load',  // minimize_load , minimize_error
    maxErrorScore: 0.50,
    maxAllowedLoad: 40000000,
    randomInitPoints: null,      // null = авторасчет от числа параметров (4 * D)
    totalBudgetIterations: null, // null = авторасчет от числа параметров (35 * D + 20)
    earlyAbortLoadMultiplier: 2
};
