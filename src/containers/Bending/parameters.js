export const MACHINES = {

    MACHINE_LINE_1: {
        name: "H.P. Burger Line 1",

        heatTransferCoefficient: 10,

        heaters: [
            {
                heaterTemperatureC: 400,
                heaterEmissivity: 0.90,
                viewFactor: 1,
                ambientViewFactor: null,
                radiationGain: 1,
                radiationMode: "heaterTemperature",
                heatFluxWm2: 0,
                surfaceReflectance: null
            },
            {
                heaterEmissivity: 0.90
            }
        ]
    },


    MACHINE_LINE_2: {
        heatTransferCoefficient: 10,

        heaters: [
            {
                heaterTemperatureC: 360,
                heaterEmissivity: 0.90,
                viewFactor: 1,
                ambientViewFactor: null,
                radiationGain: 1,
                radiationMode: "heaterTemperature",
                heatFluxWm2: 0,
                surfaceReflectance: null
            },
            {
                heaterTemperatureC: 360,
                heaterEmissivity: 0.90,
                viewFactor: 1,
                ambientViewFactor: null,
                radiationGain: 1,
                radiationMode: "heaterTemperature",
                heatFluxWm2: 0,
                surfaceReflectance: null
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
        absorptionCoefficient: 147,
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
        absorptionCoefficient: 147,
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
        absorptionCoefficient: 147,
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
        absorptionCoefficient: 147,
        surfaceReflectance: 0,

        defaultTSurf: 180,
        defaultTCenter: 150,
        decompositionTemp: 300
    }
};
