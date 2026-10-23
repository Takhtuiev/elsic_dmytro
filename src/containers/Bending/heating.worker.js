/* eslint-disable no-restricted-globals */
import { simulate2DHeating } from "./heating2DModel";
import { prepareGeometryData } from "./prepareGeometryData";

// Хелпер для безопасного получения значений свойств материала (число или функция)
const getPropValue = (prop, temp = 20) => {
    if (typeof prop === "function") return Number(prop(temp));
    return Number(prop || 0);
};

self.onmessage = (event) => {
    const { profile } = event.data;

    if (!profile?.thickness || !profile?.material || !profile?.machine || !profile.simulation) {
        self.postMessage({ type: "SUCCESS", result2D: null, geometryData: null });
        return;
    }

    try {
        const thickness = Number(profile.thickness);
        const coolingTime = Number(profile.simulation?.cooling?.timeSeconds || 0);
        const target = profile.simulation?.target;
        const mat = profile.material;

        let maxHeatingPercent = 99; // По умолчанию нагрев занимает всю шкалу

        if (thickness > 0) {
            // 1. Извлекаем физические свойства полимера из вашего паспорта
            const density = getPropValue(mat?.density, 20);                  // 1380
            const specificHeat = getPropValue(mat?.specificHeat, 20);          // 1000
            const conductivity = getPropValue(mat?.thermalConductivity, 20);  // 0.15
            const tInit = Number(profile.simulation?.temperatures?.initialC || 20);

            // 2. Динамически определяем целевую температуру нагрева T_target
            const tTarget = (target?.type === "minTemperature" || target?.type === "surfaceTemperature")
                ? Number(target.value)
                : (Number(mat?.minFormingTemp || 110) + Number(mat?.maxFormingTemp || 140)) / 2;

            // 3. Считаем среднюю температуру ТЭНов станка строго по индексам массива
            const heaters = profile.machine?.heaters;
            // Берём регулятор первого ТЭНа, если второго нет — дублируем первый
            const tReg1 = Number(heaters?.[0]?.regulatorTemperatureC || 250);
            const tReg2 = Number(heaters?.[1]?.regulatorTemperatureC || tReg1);
            const tAverageC = (tReg1 + tReg2) / 2;

            // 4. Безопасный расчет базового K на основе теплофизики и дробной степени 1.35
            if (density > 0 && specificHeat > 0 && conductivity > 0 && tAverageC > 0) {

                const alpha = conductivity / (density * specificHeat);
                const alphaPVC = 1.087e-7; // Эталон SIMONA PVC

                let baseK = 10.0 * (alphaPVC / alpha);
                const tempGradientRatio = (tTarget - tInit) / Math.max(50, tAverageC);

                // 🌟 ЮСТИРОВКА КОЭФФИЦИЕНТА: Снижаем множитель с 1.51 до 1.33
                // для идеальной калибровки под теплофизику ваших глухих ТЭНов.
                baseK = baseK * (tempGradientRatio / 0.42) * 1.33;

                // Итоговое эмпирическое время нагрева по подтвержденной степени 1.35
                const estimatedHeatingTime = baseK * Math.pow(thickness, 1.35);

                // Вычисляем проценты для вывода в лог до того, как сработают UI-границы (10 и 94)
                const rawPercent = Math.floor((estimatedHeatingTime / (estimatedHeatingTime + coolingTime)) * 99);

                if (coolingTime > 0) {
                    maxHeatingPercent = rawPercent;
                    // Безопасные расширенные границы: отдаем охлаждению не менее 5% и не более 90% шкалы
                    if (maxHeatingPercent < 10) maxHeatingPercent = 10;
                    if (maxHeatingPercent > 98) maxHeatingPercent = 98;
                } else {
                    maxHeatingPercent = 99;
                }
            }
        }

        // Запуск симуляции (ТЕПЕРЬ СТРОГО ПЕРЕДАЕМ maxHeatingPercent ВНУТРЬ)
        const result2D = simulate2DHeating({
            thicknessMm: profile.thickness,
            material: profile.material,
            machine: profile.machine,
            simulation: {
                ...profile.simulation,
                maxHeatingPercent // 🌟 ИСПРАВЛЕНО: Передаем высчитанную границу фаз
            },
            storeHistory: profile.simulation?.recordHistory ?? false,
            onProgress: (percent) => {
                self.postMessage({ type: "PROGRESS", percent });
            }
        });

        // Формируем легкий объект ответа БЕЗ свойства temperatureProfile
        const metaData = {
            heatingTimeSeconds: result2D?.heatingTimeSeconds,
            coolingTimeSeconds: result2D?.coolingTimeSeconds,
            calculationTimeMs: result2D?.calculationTimeMs,
            status: result2D?.status,
            accuracyMetrics: result2D?.accuracyMetrics // 🌟 ИСПРАВЛЕНО: Теперь пробрасываем данные погрешностей наружу в UI
        };

        const geometryData = prepareGeometryData(profile.material, result2D);

        self.postMessage({
            type: "SUCCESS",
            result2D: metaData,
            geometryData
        });


    } catch (error) {
        self.postMessage({ type: "ERROR", error: error.message, result2D: null, geometryData: null });
    }
};
