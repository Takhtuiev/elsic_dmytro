/* eslint-disable no-restricted-globals */

// Этот код будет крутиться в фоновом потоке процессора
import { simulate2DHeating } from "./heating2DModel";

self.onmessage = (event) => {
    const { profile } = event.data;

    if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
        self.postMessage({ type: "SUCCESS", result2D: null });
        return;
    }

    try {
        const result2D = simulate2DHeating({
            thicknessMm: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: profile.simulation,
            storeHistory: profile.simulation?.recordHistory ?? false,

            // 1. ПЕРЕДАЕМ КОЛЛБЭК: Симуляция вызывает его, а воркер шлет PROGRESS в React
            onProgress: (percent) => {
                self.postMessage({ type: "PROGRESS", percent });
            }
        });

        // 2. ОТПРАВЛЯЕМ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ со статусом SUCCESS
        self.postMessage({ type: "SUCCESS", result2D });
    } catch (error) {
        // 3. ОТПРАВЛЯЕМ ОШИБКУ со статусом ERROR
        self.postMessage({ type: "ERROR", error: error.message, result2D: null });
    }
};
