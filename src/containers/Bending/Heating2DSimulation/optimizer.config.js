export const OPTIMIZER_BASE_CONFIG = {
    // 📐 Пространственная сетка: сильно расширяем вниз для ультра-точности и вверх для быстрой разведки
    gridX:        { min: 0.01,  max: 0.40, label: "gridX (Thickness step)",   unit: "mm",    digits: 4 }, // Было: 0.05 .. 0.25
    gridY:        { min: 0.05,  max: 1.50, label: "gridY (Width step)",       unit: "mm",    digits: 4 }, // Было: 0.20 .. 0.90
    minGrid:      { min: 0.002, max: 0.15, label: "minGrid (Min grid cell)",  unit: "mm",    digits: 4 }, // Было: 0.01 .. 0.08

    // 🔄 Итерации Пикара: РАЗБЛОКИРУЕМ! Даем свободу от 6 до 30 итераций для сходимости сложных нелинейных зон
    maxIter:      { min: 12,     max: 12,   label: "maxIter (Picard loop iters)", unit: "steps", digits: 0 }, // Было: 12 .. 12

    // 🎯 Допуск сходимости: расширяем вниз, чтобы ловить микро-колебания температуры
    tolerance:    { min: 0.0001, max: 0.050, label: "tolerance (Conv. tolerance)", unit: "K",     digits: 5 }, // Было: 0.002 .. 0.030

    // ⏱️ Временная сетка: экстремально расширяем вниз (чтобы мелкая сетка не взрывалась по CFL) и вверх
    maxDt:        { min: 0.01,  max: 3.00, label: "maxDt (Max time step)",    unit: "s",     digits: 2 }, // Было: 0.20 .. 1.50
    targetDt:     { min: 0.005, max: 1.50, label: "targetDt (Target dt quant)", unit: "s",    digits: 2 }, // Было: 0.10 .. 0.80

    // 📈 Адаптивный шаг во времени: увеличиваем точность digits и даем гибкие рамки сжатия/расширения
    growthFactor: { min: 1.001, max: 1.30, label: "growthFactor (Time expand)", unit: "",      digits: 3 }, // Было: 1.02 .. 1.20
    shrinkFactor: { min: 0.20,  max: 0.85, label: "shrinkFactor (Time shrink)", unit: "",      digits: 2 }  // Было: 0.50 .. 0.80
};

export const OPTIMIZER_SETTINGS = {
    optimizationObjective: 'minimize_load',
    maxErrorScore: 0.10,
    maxAllowedLoad: 100000000,
    randomInitPoints: 60,
    totalBudgetIterations: 300,
    earlyAbortLoadMultiplier: 2
};
