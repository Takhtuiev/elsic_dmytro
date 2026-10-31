// Base configuration for grid search space boundaries
export const OPTIMIZER_BASE_CONFIG = {
    gridX:        { min: 0.05,  max: 0.85, label: "gridX (Thickness step)",   unit: "mm",    digits: 4 },
    gridY:        { min: 0.15,  max: 2.50, label: "gridY (Width step)",       unit: "mm",    digits: 4 },
    minGrid:      { min: 0.003, max: 0.15, label: "minGrid (Min grid cell)",  unit: "mm",    digits: 4 },
    maxIter:      { min: 6,     max: 6,   label: "maxIter (Picard loop iters)", unit: "steps", digits: 0 },
    tolerance:    { min: 0.001, max: 0.40, label: "tolerance (Conv. tolerance)", unit: "K",     digits: 5 },
    maxDt:        { min: 0.05,  max: 4.0,  label: "maxDt (Max time step)",    unit: "s",     digits: 2 },
    targetDt:     { min: 0.02,  max: 3.0,  label: "targetDt (Target dt quant)", unit: "s",    digits: 2 },
    growthFactor: { min: 1.01,  max: 1.40, label: "growthFactor (Time expand)", unit: "",      digits: 2 },
    shrinkFactor: { min: 0.45,  max: 0.85, label: "shrinkFactor (Time shrink)", unit: "",      digits: 2 }
};

export const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_load',
    maxErrorScore: 0.5,
    maxAllowedLoad: 500000,
    randomInitPoints: 20,
    totalBudgetIterations: 100,
    earlyAbortLoadMultiplier: 2
};
