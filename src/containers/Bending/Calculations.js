// =====================================================
// Calculations.js
// =====================================================

const getBendLength = (angle, thickness, kFactor, rTool) => {
    const radiusNeutral = rTool + kFactor * thickness;
    return radiusNeutral * Number(angle) * Math.PI / 180;
};

const getBendOffset = (
    angle, thickness, kFactor, rTool, isInsideDimension = false
) => {
    if (Number(angle) === 180) return 0;

    const radius = isInsideDimension
        ? rTool
        : rTool + thickness;

    return radius * Math.tan(Number(angle) * Math.PI / 360);
};


// =====================================================
// Прямая часть полки
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
// Элементы профиля
// =====================================================

export const calculateProfileElements = profile => {
    const shelves = profile.shelves || [];
    const bends = profile.bends || [];
    const elements = [];

    shelves.forEach((shelf, shelfIndex) => {
        elements.push({
            type: "straight",
            shelf: shelfIndex + 1,
            inputLength: Number(shelf.length),
            side: shelf.side,
            length: getStraightLength(shelfIndex, profile)
        });

        if (bends[shelfIndex]) {
            const bend = bends[shelfIndex];
            const angle = Number(bend.angle);

            elements.push({
                type: "bend",
                bend: shelfIndex + 1,
                angle,
                direction: bend.direction,
                length: getBendLength(
                    180 - angle,
                    Number(profile.thickness),
                    Number(profile.kFactor),
                    Number(profile.rTool)
                )
            });
        }
    });

    return elements;
};


// =====================================================
// Общая длина заготовки
// =====================================================

export const calculateBlankLength = profile =>
    calculateProfileElements(profile).reduce(
        (total, element) => total + element.length,
        0
    );


// =====================================================
// Расстояние до наружной вершины
// =====================================================

export const calculateDistanceToOuterApexViaNeutral = ({
                                                           shelves,
                                                           bends,
                                                           thickness,
                                                           kFactor,
                                                           rTool,
                                                           firstBendIndex,
                                                           bendViewMode
                                                       }) => {
    const profile = {
        shelves,
        bends,
        thickness,
        kFactor,
        rTool
    };

    const elements = calculateProfileElements(profile);

    const targetElementIndex = elements.findIndex(
        el => el.type === "bend" && el.bend === firstBendIndex + 1
    );

    if (targetElementIndex === -1) return 0;

    const bend = elements[targetElementIndex];

    const angleRad =
        (180 - Number(bend.angle)) * Math.PI / 180;

    const radius =
        Number(rTool || 0) + Number(thickness || 0);

    const offset =
        radius * Math.tan(angleRad / 2);

    let length = 0;

    if (bendViewMode === "toEnd") {
        for (let i = elements.length - 1; i > targetElementIndex; i--) {
            length += elements[i].length;
        }
    } else if (bendViewMode === "fromStart") {
        for (let i = 0; i < targetElementIndex; i++) {
            length += elements[i].length;
        }
    }

    return length + offset;
};


// =====================================================
// Параметры гибочного станка
// =====================================================

export const calculateBendingMachineParams = ({
                                                  alpha,
                                                  lInput,
                                                  isInnerMode,
                                                  t,
                                                  rTool
                                              }) => {
    console.log("dddd ", alpha,
        lInput,
        isInnerMode,
        t,
        rTool)
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