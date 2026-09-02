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
