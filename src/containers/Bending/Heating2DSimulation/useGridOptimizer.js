import { useState, useEffect, useRef, useCallback } from "react";
import {OPTIMIZER_BASE_CONFIG, OPTIMIZER_SETTINGS} from "./optimizer.config";
// Импортируем единые глобальные константы из конфигурационного файла

// Функция генерации штампа времени без миллисекунд
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('uk-UA', { hour12: false });
}

// Вспомогательная функция для форматирования значений по правилам из OPTIMIZER_BASE_CONFIG
function formatParamValue(name, value) {
    if (value === null || value === undefined) return "—";
    const config = OPTIMIZER_BASE_CONFIG[name];
    if (!config) return String(value);

    const digits = config.digits ?? 5;
    const formatted = typeof value === "number" ? value.toFixed(digits) : String(value);
    const unit = config.unit ? ` ${config.unit}` : "";
    return `${formatted}${unit}`;
}

export function useGridOptimizer(state, setState) {
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [logs, setLogs] = useState([]);

    const workerRef = useRef(null);
    const logsStaticRef = useRef([]);

    // Функция инициализации фонового воркера
    const initWorker = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
        }

        workerRef.current = new Worker(
            new URL("./optimization.worker.js", import.meta.url),
            { type: "module" }
        );

        workerRef.current.onmessage = (e) => {
            const { status, data, percent, error, logMessage } = e.data;

            if (status === "progress_tick") {
                // Извлекаем текущий шаг прямо из данных воркера, если он там есть
                const currentStep = e.data.currentExecutionCount !== undefined
                    ? e.data.currentExecutionCount
                    : logsStaticRef.current.filter(l => l.text.includes('🧠') || l.text.includes('🎲')).length;

                const maxSteps = e.data.totalIterations !== undefined
                    ? e.data.totalIterations
                    : OPTIMIZER_SETTINGS.totalBudgetIterations;

                setLogs([
                    ...logsStaticRef.current,
                    {
                        text: `⏳ [SOLVER]: Simulation running on step ${currentStep}/${maxSteps} | Progress: ${percent}%`,
                        timestamp: getTimestamp()
                    }
                ]);
                return;
            }

            if (status === "log_step" && logMessage) {
                logsStaticRef.current.push({
                    text: logMessage,
                    timestamp: getTimestamp()
                });
                setLogs([...logsStaticRef.current]);
                return;
            }

            // Завершение работы алгоритма и вывод итогового технического отчета
            if (status === "success") {
                setIsOptimizing(false);
                setState(prev => ({
                    ...prev,
                    simulation: { ...prev.simulation, accuracyMode: data.optimalLimits }
                }));

                const limits = data.optimalLimits || {};
                const settings = OPTIMIZER_SETTINGS;

                const objectiveText = settings.optimizationObjective === 'minimize_load'
                    ? "MAX SPEED (Minimize grid computational load)"
                    : "MAX ACCURACY (Minimize calculated error metrics)";

                const finalSummary = [
                    ...logsStaticRef.current,
                    { text: `\n=======================================================`, timestamp: getTimestamp() },
                    { text: `🏆 [OPTIMIZER]: FINAL TECHNICAL REPORT`, timestamp: getTimestamp() },
                    { text: `=======================================================`, timestamp: getTimestamp() },
                    {
                        text: data.metrics.isFallbackActivated
                            ? `⚠️ COMPROMISE: Physical constraints not met. Balanced fallback applied.`
                            : `✅ SUCCESS: Grid parameters optimized for the model criteria.`,
                        timestamp: getTimestamp()
                    },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `🎯 INITIAL CRITERIA AND CONSTRAINTS:`, timestamp: getTimestamp() },
                    { text: `   🔹 Optimization Objective:   ${objectiveText}`, timestamp: getTimestamp() },
                    { text: `   🔹 Max Allowed ScoreErr:     <= ${settings.maxErrorScore}`, timestamp: getTimestamp() },
                    { text: `   🔹 Max Allowed Load limit:   <= ${settings.maxAllowedLoad.toLocaleString('en-US')} nodes`, timestamp: getTimestamp() },
                    { text: `   🔹 Total Iteration Budget:   ${settings.totalBudgetIterations} steps (Init phase: ${settings.randomInitPoints})`, timestamp: getTimestamp() },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `📊 ACHIEVED METRICS AND EFFICIENCY:`, timestamp: getTimestamp() },
                    { text: `   📈 Resulting ScoreErr:       ${data.metrics.resultingErrorScore?.toFixed(3) ?? "—"}`, timestamp: getTimestamp() },
                    { text: `   ⚡ Achieved Grid Load:       ${data.metrics.achievedLoad.toLocaleString('en-US')} nodes`, timestamp: getTimestamp() },
                    { text: `-------------------------------------------------------`, timestamp: getTimestamp() },
                    { text: `🛠️ OPTIMAL SOLVER CONFIGURATION:`, timestamp: getTimestamp() },

                    // Полностью динамический маппинг параметров на основе OPTIMIZER_BASE_CONFIG
                    ...Object.entries(OPTIMIZER_BASE_CONFIG).map(([name, conf]) => {
                        const value = limits[name];
                        const formattedValue = formatParamValue(name, value);

                        const unitStr = conf.unit ? ` ${conf.unit}` : "";
                        const boundsStr = `[Bounds: ${conf.min} .. ${conf.max}${unitStr}]`;
                        const labelText = `${conf.label}:`.padEnd(32, " ");

                        return {
                            text: `   🔹 ${labelText} ${formattedValue}  ${boundsStr}`,
                            timestamp: getTimestamp()
                        };
                    }),

                    { text: `=======================================================`, timestamp: getTimestamp() },
                    { text: `🏆 [Bayesian UI]: Grid tensors updated. Model is ready for simulation thread.`, timestamp: getTimestamp() }
                ];

                logsStaticRef.current = finalSummary;
                setLogs(finalSummary);
            } else if (status === "error") {
                setIsOptimizing(false);
                logsStaticRef.current.push({
                    text: `❌ [Bayesian UI]: Optimization error occurred: ${error}`,
                    timestamp: getTimestamp()
                });
                setLogs([...logsStaticRef.current]);
            }
        };
    }, [setState]);

    // Инициализация при монтировании хука
    useEffect(() => {
        initWorker();
        return () => workerRef.current?.terminate();
    }, [initWorker]);

    // Принудительное завершение потока воркера
    const abortOptimization = useCallback(() => {
        if (!isOptimizing) return;

        setIsOptimizing(false);

        if (workerRef.current) {
            workerRef.current.terminate();
        }

        const abortLog = {
            text: "🚨 [SYSTEM_CRIT]: Bayesian optimization process forcibly terminated by user. Worker thread wiped.",
            timestamp: getTimestamp()
        };
        logsStaticRef.current.push(abortLog);
        setLogs([...logsStaticRef.current]);

        initWorker();
    }, [isOptimizing, initWorker]);

    // Запуск процесса оптимизации
    const runOptimization = useCallback(() => {
        if (!workerRef.current) return;

        setIsOptimizing(true);
        setIsLogOpen(true);

        const initMsg = "🟢 [Bayesian Setup]: Target grid space optimization task initialized...";
        const startLog = [{ text: initMsg, timestamp: getTimestamp() }];
        setLogs(startLog);
        logsStaticRef.current = startLog;

        const thickness = Number(state.geometry?.thickness) || 0;

        workerRef.current.postMessage({
            baseParams: {
                thicknessMm: thickness,
                material: { ...state.material },
                machine: { ...state.machine },
                simulation: {
                    ...state.simulation,
                    widthHalfMm: state.simulation.widthHalfMm !== undefined
                        ? state.simulation.widthHalfMm
                        : (Number(state.geometry?.width) / 2 || 20)
                }
            },
            options: {
                ...OPTIMIZER_SETTINGS,
                config: OPTIMIZER_BASE_CONFIG
            }
        });
    }, [state]);

    return {
        isOptimizing,
        runOptimization,
        abortOptimization,
        isLogOpen,
        setIsLogOpen,
        logs,
        openLogJournal: () => setIsLogOpen(true),
        hasLogs: logs.length > 0
    };
}
