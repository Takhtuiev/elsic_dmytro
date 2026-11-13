const createGridSnapper = (getDomainMm, minNodes) => (rawStep, baseParams) => {
    const domainMm = getDomainMm(baseParams);
    if (!Number.isFinite(domainMm) || domainMm <= 0 || !Number.isFinite(rawStep) || rawStep <= 0) {
        return rawStep;
    }
    const intervals = Math.max(minNodes - 1, Math.round(domainMm / rawStep));
    return domainMm / intervals;
};


export const OPTIMIZER_BASE_CONFIG = {
    gridX: {
        label: "gridX (Thickness step)",
        unit: "mm",
        min: 0.05,
        max: 0.45,
        digits: 4,
        snap: createGridSnapper(p => Number(p.thicknessMm), 5)
    },
    gridY: {
        label: "gridY (Width step)",
        unit: "mm",
        min: 0.20,
        max: 1.50,
        digits: 4,
        snap: createGridSnapper(p => Number(p.simulation?.widthHalfMm), 12)
    },
    tempStepK: {
        label: "tempStepK (Temp step)",
        unit: "K",
        min: 0.30,
        max: 2.50,
        digits: 2
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
    maxAllowedLoad: 20000000,
    randomInitPoints: null,      // null = авторасчет от числа параметров (4 * D)
    totalBudgetIterations: null, // null = авторасчет от числа параметров (35 * D + 20)
    earlyAbortLoadMultiplier: 2
};
