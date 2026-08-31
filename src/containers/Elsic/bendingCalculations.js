// =====================================================
// bendingCalculations.js
//
// Расчёт длины заготовки по нейтральной линии
// =====================================================



// =====================================================
// Длина нейтральной дуги
//
// L = R * α
// α в радианах
// =====================================================

const getBendLength = (
    angle,
    thickness,
    kFactor,
    rTool
) => {

    const radiusNeutral = rTool + kFactor * thickness;
    const angleRad = angle * Math.PI / 180;

    return (
        radiusNeutral * angleRad
    );
};


// =====================================================
// Отступ от точки пересечения прямых
// до начала нейтральной дуги
//
// offset = R * tan(α / 2)
//
// =====================================================

const getBendOffset = (
    angle,
    thickness,
    kFactor,
    rTool,
    isInsideDimension=false
) => {

    // 180° — виртуальная гибка на краю
    if (angle === 180) {return 0;}

    const radius = isInsideDimension ? rTool : rTool + thickness;

    const angleRad = Number(angle) * Math.PI / 180;

    return (
        radius * Math.tan(angleRad / 2 )
    );
};


// =====================================================
// Расчёт прямой части полки
//
// Для крайних полок:
//
// размер задан от внешней кромки
// до начала/конца гибки.
//
// Для средней полки:
//
// размер может быть задан:
//     left  → от левой гибки
//     right → от правой гибки
//
// Поэтому учитываем соответствующие offset.
// =====================================================

export const getStraightLength = (
    shelf,
    shelfIndex,
    profile
) => {

    const thickness =
        Number(profile.thickness);

    const kFactor =
        Number(profile.kFactor);

    const rTool =
        Number(profile.rTool);


    // =================================================
    // Левая гибка
    // Для первой полки — виртуальная гибка 180°
    // =================================================

    const leftBend =
        shelfIndex === 0
            ? 180
            : 180-profile.bends[shelfIndex - 1].angle;

    const leftIsInsideDimension =
        shelfIndex === 0
            ? 0
            : profile.bends[shelfIndex - 1].direction !== profile.shelves[shelfIndex].side;

    // =================================================
    // Смещение от размера до начала
    // нейтральной дуги слева
    // =================================================

    const leftOffset =
        getBendOffset(
            leftBend,
            thickness,
            kFactor,
            rTool,
            leftIsInsideDimension
        );




    // =================================================
    // Правая гибка
    // Для последней полки — виртуальная гибка 180°
    // =================================================

    const rightBend =
        shelfIndex === profile.shelves.length - 1
            ? 180
            : 180-profile.bends[shelfIndex].angle;

    const rightIsInsideDimension =
        shelfIndex === profile.shelves.length - 1
            ? 0
            : profile.bends[shelfIndex].direction !== profile.shelves[shelfIndex].side;



    // =================================================
    // Смещение справа
    // =================================================

    const rightOffset =
        getBendOffset(
            rightBend,
            thickness,
            kFactor,
            rTool,
            rightIsInsideDimension
        );

    // =================================================
    // Длина прямой части
    // =================================================

    return (
        Number(shelf.length) - leftOffset - rightOffset
    );
};


// =====================================================
// Получение всех элементов нейтральной линии
// =====================================================

export const calculateProfileElements = (
    profile
) => {

    const elements = [];


    // =================================================
    // Полки и гибки идут последовательно
    // =================================================

    profile.shelves.forEach(
        (
            shelf,
            shelfIndex
        ) => {

            // =============================================
            // Прямая часть
            // =============================================

            const straightLength =
                getStraightLength(
                    shelf,
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


            // =============================================
            // Гибка после полки
            // =============================================

            if (shelfIndex < profile.bends.length) {

                const bendLength =
                    getBendLength(
                        180-Number(profile.bends[shelfIndex].angle),
                        Number(profile.thickness),
                        Number(profile.kFactor),
                        Number(profile.rTool)
                    );


                elements.push({
                    type: "bend",
                    bend: shelfIndex + 1,
                    angle: Number(profile.bends[shelfIndex].angle),
                    direction: profile.bends[shelfIndex].direction,
                    length: bendLength,
                });
            }
        }
    );


    return elements;
};


// =====================================================
// Общая длина заготовки
// =====================================================

export const calculateBlankLength = (profile) => {

    const elements = calculateProfileElements(profile);

    return elements.reduce(
        (total, element) => {
            return total + element.length;
        },
        0
    );
};

