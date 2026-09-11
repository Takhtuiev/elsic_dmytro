export const MACHINES = {
    MACHINE_LINE_1: {
        kBox: 18.00,
        tempTransferCoef: 0.8
    },
    MACHINE_LINE_2: {
        kBox: 14.50,
        tempTransferCoef: 0.70
    }
};

export const MATERIALS = {
    PVC_CAW_RED: {
        name: "PVC-CAW Red",
        lambda: 0.15,
        density: 1380.0,
        specificHeat: 1000.0,
        defaultTSurf: 160.0,
        defaultTCenter: 130.0
    },
    PVC_CAW_DARK_GREY: {
        name: "PVC-CAW Grey",
        lambda: 0.15,
        density: 1380.0,
        specificHeat: 1000.0,
        defaultTSurf: 160.0,
        defaultTCenter: 130.0
    },
    PVC_CAW_TRANSPARENT: {
        name: "PVC Transparent",
        lambda: 0.15,
        density: 1390.0,
        specificHeat: 1000.0,
        defaultTSurf: 165.0,
        defaultTCenter: 130.0
    },
    POLYCARBONATE_STANDARD: {
        name: "Polycarbonate Standard",
        lambda: 0.20,
        density: 1200.0,
        specificHeat: 1200.0,
        defaultTSurf: 180.0,
        defaultTCenter: 150.0
    }
};



export const calculateBendingCycleTime = ({
    thickness,
    material,
    machine = MACHINES.MACHINE_LINE_1,
    regulatorTemp = null,
    tShop = 20.0
}) => {

    console.log("regulatorTemp", regulatorTemp);
    const {
        lambda,
        density,
        specificHeat,
        defaultTSurf,
        defaultTCenter
    } = material;

    const {
        kBox,
        tempTransferCoef
    } = machine;

    // 1. Реальная температура поверхности листа
    const tSurf = regulatorTemp !== null && !isNaN(regulatorTemp)
        ? regulatorTemp * tempTransferCoef
        : defaultTSurf;

    console.log(tSurf)
    // 2. Температуропроводность материала
    const alpha = lambda / (density * specificHeat);

    // 3. Полутолщина для двустороннего нагрева
    const L = (thickness / 1000.0) / 2.0;

    // 4. Базовое время прогрева по Фурье
    const baseTime =
        (Math.pow(L, 2) / (alpha * Math.PI * Math.PI)) *
        Math.log(
            (4.0 / Math.PI) *
            ((tSurf - tShop) / (tSurf - defaultTCenter))
        );

    // 5. Коррекция по станку
    return {
        material: material,
        regulatorTemp: regulatorTemp,
        tSurf: tSurf,
        time: baseTime * kBox,
        baseTime: baseTime,
    };
};
