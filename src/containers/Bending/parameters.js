export const MACHINES = {

    MACHINE_LINE_1: {
        name: "H.P. Burger Line 1",

        heaters: [
            {
                // top
                heaterTemperatureC: 300,
                heaterEmissivity: 0.90,
                viewFactor: 0.95,
                radiationGain: 1.00,
                convectiveHeatTransferCoefficient: 8,
                airTemperatureFactor: 0.45
            },
            {
                // bottom
                heaterTemperatureC: 300,
                heaterEmissivity: 0.90,
                viewFactor: 0.95,
                radiationGain: 1.00,
                convectiveHeatTransferCoefficient: 8,
                airTemperatureFactor: 0.55
            }
        ]
    },


    MACHINE_LINE_2: {
        heatTransferCoefficient: 10,

        heaters: [
            {
                heaterTemperatureC: 360,
                airTemperatureFactor: 0.70,
                heaterEmissivity: 0.90,
                viewFactor: 1,
                radiationGain: 1,
            },
            {
                heaterTemperatureC: 360,
                airTemperatureFactor: 0.70,
                heaterEmissivity: 0.90,
                viewFactor: 1,
                radiationGain: 1,
            }
        ]
    }
};


export const MATERIALS = {

    PVC_CAW_RED: {
        name: "PVC-CAW Red",

        density: 1380,
        thermalConductivity: 0.15,
        specificHeat: 1000,

        emissivity: 0.93,
        surfaceReflectance: 0,

        defaultTSurf: 160,
        defaultTCenter: 130,
        decompositionTemp: 180
    },

    PVC_CAW_DARK_GREY: {
        name: "PVC-CAW Grey",

        density: 1380,
        thermalConductivity: 0.15,
        specificHeat: 1000,

        emissivity: 0.93,
        surfaceReflectance: 0,

        defaultTSurf: 160,
        defaultTCenter: 130,
        decompositionTemp: 180
    },

    PVC_CAW_TRANSPARENT: {
        name: "PVC Transparent",

        density: 1390,
        thermalConductivity: 0.15,
        specificHeat: 1000,

        emissivity: 0.93,
        surfaceReflectance: 0,

        defaultTSurf: 165,
        defaultTCenter: 130,
        decompositionTemp: 180
    },

    POLYCARBONATE_STANDARD: {
        name: "Polycarbonate Standard",

        density: 1200,
        thermalConductivity: 0.20,
        specificHeat: 1200,

        emissivity: 0.93,
        surfaceReflectance: 0,

        defaultTSurf: 180,
        defaultTCenter: 150,
        decompositionTemp: 300
    }
};
