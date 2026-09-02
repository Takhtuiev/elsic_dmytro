//
// =====================================================
// Calculations.js
//
// Расчёт длины заготовки по нейтральной линии.
//
// Структура profile.elements:
//
// shelf → bend → shelf → bend → shelf
//
// ВАЖНО:
// Полки и гибки находятся в одном массиве,
// поэтому их количество может быть любым.
// =====================================================


// =====================================================
// Длина нейтральной дуги
//
// L = R × α
//
// R = R_tool + K-factor × thickness
// α — угол гибки в радианах.
//
// Например:
// угол 90° → рассчитывается дуга 90°.
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
// offset = R × tan(α / 2)
//
// Для 180° offset = 0,
// поскольку это виртуальная гибка
// на конце детали.
//
// isInsideDimension:
// true  → используется R_tool
// false → используется R_tool + thickness
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
// Получить только полки из общего массива.
// =====================================================

const getShelves = profile =>
    profile.elements.filter(element => element.type === "shelf");


// =====================================================
// Получить только гибки из общего массива.
// =====================================================

const getBends = profile =>
    profile.elements.filter(element => element.type === "bend");


// =====================================================
// Расчёт длины прямой части полки.
//
// Введённый размер полки является размером
// от теоретической точки до теоретической точки.
//
// Поэтому из него необходимо вычесть:
//   левый offset + правый offset.
//
// Для первой и последней полки используется
// виртуальная гибка 180°.
// =====================================================

export const getStraightLength = (shelfIndex, profile) => {
    const shelves = getShelves(profile);
    const bends = getBends(profile);
    const shelf = shelves[shelfIndex];

    if (!shelf) return 0;

    const thickness = Number(profile.thickness);
    const kFactor = Number(profile.kFactor);
    const rTool = Number(profile.rTool);

    // -------------------------------------------------
    // Гибка слева от полки
    // -------------------------------------------------

    const leftBend = shelfIndex === 0
        ? 180
        : 180 - Number(bends[shelfIndex - 1]?.angle || 0);

    // Если размер полки задан по внутренней стороне,
    // используем R_tool.
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

    // -------------------------------------------------
    // Гибка справа от полки
    // -------------------------------------------------

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

    // -------------------------------------------------
    // Реальная прямая часть нейтральной линии
    // -------------------------------------------------

    return Number(shelf.length) - leftOffset - rightOffset;
};


// =====================================================
// Построение всех элементов нейтральной линии.
//
// Результат:
//
// [
//     { type: "straight", ... },
//     { type: "bend", ... },
//     { type: "straight", ... },
//     { type: "bend", ... },
//     { type: "straight", ... }
// ]
// =====================================================

export const calculateProfileElements = profile => {
    const shelves = getShelves(profile);
    const bends = getBends(profile);
    const elements = [];

    shelves.forEach((shelf, shelfIndex) => {
        // -------------------------------------------------
        // Прямая часть
        // -------------------------------------------------

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

        // -------------------------------------------------
        // Гибка после этой полки
        // -------------------------------------------------

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
//
// Складываются все прямые участки
// и все нейтральные дуги гибок.
// =====================================================

export const calculateBlankLength = profile => {
    const elements = calculateProfileElements(profile);

    return elements.reduce(
        (total, element) => total + element.length,
        0
    );
};
