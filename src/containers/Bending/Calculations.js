//
// =====================================================
// Calculations.js
//
// Расчёт длины заготовки по нейтральной линии.
//
// Структура profile:
//
// {
//     thickness: 2,
//     shelves: [
//         { length: 50, side: "top" },
//         { length: 100, side: "left" }
//     ],
//     bends: [
//         { angle: 90, direction: "right" }
//     ]
// }
//
// =====================================================


// =====================================================
// Длина нейтральной дуги
// =====================================================

const getBendLength = (angle, thickness, kFactor, rTool) => {
    const radiusNeutral = rTool + kFactor * thickness;
    const angleRad = Number(angle) * Math.PI / 180;

    return radiusNeutral * angleRad;
};


// =====================================================
// Отступ от вершины теоретического угла
// до начала нейтральной дуги.
//
// Для 180° offset = 0.
// =====================================================

const getBendOffset = (
    angle,
    thickness,
    kFactor,
    rTool,
    isInsideDimension = false
) => {
    if (Number(angle) === 180) return 0;

    const radius = isInsideDimension
        ? rTool
        : rTool + thickness;

    const angleRad = Number(angle) * Math.PI / 180;

    return radius * Math.tan(angleRad / 2);
};


// =====================================================
// Расчёт длины прямой части полки.
// =====================================================

export const getStraightLength = (shelfIndex, profile) => {
    const shelves = profile.shelves || [];
    const bends = profile.bends || [];
    const shelf = shelves[shelfIndex];

    if (!shelf) return 0;

    const thickness = Number(profile.thickness);
    const kFactor = Number(profile.kFactor);
    const rTool = Number(profile.rTool);

    const leftBend = shelfIndex === 0
        ? 180
        : 180 - Number(bends[shelfIndex - 1]?.angle || 0);

    const leftIsInsideDimension = shelfIndex === 0
        ? false
        : bends[shelfIndex - 1]?.direction !== shelf.side;

    const leftOffset = getBendOffset(
        leftBend,
        thickness,
        kFactor,
        rTool,
        leftIsInsideDimension
    );

    const rightBend = shelfIndex === shelves.length - 1
        ? 180
        : 180 - Number(bends[shelfIndex]?.angle || 0);

    const rightIsInsideDimension = shelfIndex === shelves.length - 1
        ? false
        : bends[shelfIndex]?.direction !== shelf.side;

    const rightOffset = getBendOffset(
        rightBend,
        thickness,
        kFactor,
        rTool,
        rightIsInsideDimension
    );

    return Number(shelf.length) - leftOffset - rightOffset;
};


// =====================================================
// Построение всех элементов нейтральной линии.
// =====================================================

export const calculateProfileElements = profile => {
    const shelves = profile.shelves || [];
    const bends = profile.bends || [];
    const elements = [];

    shelves.forEach((shelf, shelfIndex) => {
        const straightLength = getStraightLength(
            shelfIndex,
            profile
        );

        elements.push({
            type: "straight",
            shelf: shelfIndex + 1,
            inputLength: Number(shelf.length),
            side: shelf.side,
            length: straightLength,
        });

        if (bends[shelfIndex]) {
            const bend = bends[shelfIndex];
            const angle = Number(bend.angle);

            const bendLength = getBendLength(
                180 - angle,
                Number(profile.thickness),
                Number(profile.kFactor),
                Number(profile.rTool)
            );

            elements.push({
                type: "bend",
                bend: shelfIndex + 1,
                angle,
                direction: bend.direction,
                length: bendLength,
            });
        }
    });

    return elements;
};


// =====================================================
// Общая длина заготовки.
// =====================================================

export const calculateBlankLength = profile => {
    const elements = calculateProfileElements(profile);

    return elements.reduce(
        (total, element) => total + element.length,
        0
    );
};


export const calculateDistanceToOuterApexViaNeutral = (
    profile,
) => {

    const bendIndex = profile.firstBendIndex
    const direction =  profile.bendViewMode

    console.log("profile ", profile);
    console.log("bendIndex1 ", bendIndex,direction)

    const elements = calculateProfileElements(profile);

    const targetElementIndex = elements.findIndex(
        el => el.type === "bend" && el.bend === bendIndex + 1
    );

    if (targetElementIndex === -1) return 0;

    const bend = elements[targetElementIndex];
    const angleRad = (180 - Number(bend.angle)) * Math.PI / 180;

    const radius = Number(profile.rTool || 0) + Number(profile.thickness || 0);

    const offset = radius * Math.tan(angleRad / 2);

    let length = 0;

    if (direction === "toEnd") {
        for (let i = elements.length - 1; i > targetElementIndex; i--) {
            length += elements[i].length;
        }

    } else if (direction === "fromStart") {
        for (let i = 0; i < targetElementIndex; i++) {
            length += elements[i].length;
        }
    }


    return length + offset;
};

/**
 * Расчет параметров гибочного станка (ПВХ / Листовой материал)
 * @param {Object} params - Входные данные для расчета
 * @returns {Object} Объект с искомыми параметрами gapFolding и stopPosition
 */
export const calculateBendingMachineParams = ({
                                                  alpha,
                                                  lInput,
                                                  isInnerMode,
                                                  t,
                                                  rTool
                                              }) => {
    const bendAngle = 180 - alpha;
    const rad = Math.PI * bendAngle / 180;

    const lPivotToCenter = Math.sqrt(
        Math.pow(rTool + t, 2) + Math.pow(rTool, 2)
    );

    const angle1 = Math.asin(rTool / lPivotToCenter);
    const angle2 = Math.PI / 2 - rad + angle1;

    const deltaShelfInOut = t * Math.tan(rad / 2);
    const lShelf = isInnerMode === 1
        ? lInput + deltaShelfInOut
        : lInput;

    const gapFolding =
        (rTool + t) -
        lPivotToCenter * Math.sin(angle2);

    const stopPosition =
        lShelf -
        gapFolding / Math.sin(rad);

    return {
        stopPosition: Number(stopPosition.toFixed(2)),
        bendAngle: Number(bendAngle.toFixed(2)),
        gapFolding: Number(gapFolding.toFixed(2))
    };
};

