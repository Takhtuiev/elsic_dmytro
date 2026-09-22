export const MACHINES = {

    MACHINE_LINE_1: {
        name: "H.P. Burger Line 1",

        rTool: 1.2,

        heaters: [
            {
                // top
                regulatorTemperatureC: 200,
                heaterTemperatureFactor: 1.3,
                heaterEmissivity: 0.90,
                viewFactor: 0.8,
                radiationGain: 1.00,
                convectiveHeatTransferCoefficient: 8,
           },
            {
                // bottom
                regulatorTemperatureC: 200,
                convectiveHeatTransferCoefficient: 16,
            }
        ]
    },


    MACHINE_LINE_2: {
        name: "Line 2",

        rTool: 1.2,

        heaters: [
            {
                regulatorTemperatureC: 270,
                heaterTemperatureFactor: 1.0,
                heaterEmissivity: 0.90,
                viewFactor: 0.9,
                radiationGain: 1.00,
                convectiveHeatTransferCoefficient: 8,
            },
            {
                // bottom
                regulatorTemperatureC: 280,
                convectiveHeatTransferCoefficient: 16,
            }
        ]
    }
};


export const MATERIALS = {
    PVC_CAW_RED: {
        name: "SIMONA® PVC-CAW Red",

        density: 1380,              // кг/м³
        thermalConductivity: 0.15,  // Вт/(м·К)

        specificHeat: 1000,          // Базовая теплоемкость (число из паспорта)
        tgSpecificHeatJumpFactor: 1.40, // Коэффициент скачка (1.40 = +40%)
        tgTransitionWidthC: 10.0,    // Ширина зоны перехода в градусах (обычно 10)

        emissivity: 0.93,
        surfaceReflectance: 0.07,

        glassTransitionTemp: 80,    // °C (ниже материал хрупкий)
        minFormingTemp: 110,        // °C (нижняя граница формования)
        maxFormingTemp: 140,        // °C (верхняя граница формования)
        decompositionTemp: 180,     // °C (порог перегрева/брака поверхности)

        kFactor: 0.40,
    },

    PVC_CAW_DARK_GREY: {
        name: "SIMONA® PVC-CAW Dark Grey",

        density: 1380,              // кг/м³
        thermalConductivity: 0.15,  // Вт/(м·К)

        specificHeat: 1000,          // Базовая теплоемкость (число из паспорта)
        tgSpecificHeatJumpFactor: 1.40, // Коэффициент скачка (1.40 = +40%)
        tgTransitionWidthC: 10.0,    // Ширина зоны перехода в градусах (обычно 10)

        emissivity: 0.93,
        surfaceReflectance: 0.07,

        glassTransitionTemp: 80,    // °C
        minFormingTemp: 110,        // °C
        maxFormingTemp: 140,        // °C
        decompositionTemp: 180,     // °C

        kFactor: 0.40,
    },

    PVC_GLAS: {
        name: "SIMONA® PVC-GLAS",

        density: 1370,              // кг/м³
        thermalConductivity: 0.15,  // Вт/(м·К)

        specificHeat: 1000,          // Базовая теплоемкость (число из паспорта)
        tgSpecificHeatJumpFactor: 1.40, // Коэффициент скачка (1.40 = +40%)
        tgTransitionWidthC: 10.0,    // Ширина зоны перехода в градусах (обычно 10)

        emissivity: 0.92,
        surfaceReflectance: 0.08,

        glassTransitionTemp: 80,    // °C
        minFormingTemp: 115,        // °C (более узкий диапазон для сохранения прозрачности)
        maxFormingTemp: 135,        // °C
        decompositionTemp: 180,     // °C (порог помутнения и образования пузырьков)

        kFactor: 0.40,
    },

    POLYCARBONATE_STANDARD: {
        name: "Polycarbonate Standard",

        density: 1200,
        thermalConductivity: 0.20,

        specificHeat: 1200,          // Базовая теплоемкость (число из паспорта)
        tgSpecificHeatJumpFactor: 1.35, // Коэффициент скачка (1.40 = +40%)
        tgTransitionWidthC: 12.0,    // Ширина зоны перехода в градусах (обычно 10)


        emissivity: 0.93,
        surfaceReflectance: 0,

        glassTransitionTemp: 147,    // °C
        minFormingTemp: 180,        // °C (более узкий диапазон для сохранения прозрачности)
        maxFormingTemp: 210,        // °C
        decompositionTemp: 280,     // °C (порог помутнения и образования пузырьков)

        kFactor:0.40,
    }
};
