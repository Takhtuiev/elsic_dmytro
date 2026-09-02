const EPSILON = 1e-10;

const getDirection = angle => ({
    x: Math.cos(angle),
    y: -Math.sin(angle)
});

const getNormal = dir => ({
    x: -dir.y,
    y: dir.x
});

const intersectLines = (p1, d1, p2, d2) => {
    const det = d1.x * d2.y - d1.y * d2.x;

    if (Math.abs(det) < EPSILON) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const t = (dx * d2.y - dy * d2.x) / det;

    return {
        x: p1.x + d1.x * t,
        y: p1.y + d1.y * t
    };
};

const buildProfileGeometry = profile => {
    const thickness = Number(profile.thickness) || 0;
    const shelves = [];
    let currentAngle = 0;

    // Шаг 1: Первичный сбор элементов профиля
    profile.elements.forEach(element => {
        if (element.type === "shelf") {
            shelves.push({
                length: Number(element.length) || 0,
                isTop: element.side !== "left",
                dir: getDirection(currentAngle),
                // Сохраняем исходный угол в радианах для выноса текстовых надписей
                angleRad: currentAngle
            });
        } else if (element.type === "bend") {
            const turningAngle =
                ((180 - (Number(element.angle) || 0)) * Math.PI) / 180;

            currentAngle +=
                (element.direction === "left" ? 1 : -1) * turningAngle;
        }
    });

    // Если нет полок — возвращаем пустую структуру (включая пустой массив данных полок)
    if (!shelves.length) return { sideA: [], sideB: [] , shelvesData: [] };

    const sideA = [];
    const sideB = [];
    const shelvesData = []; // Массив обогащенных технологических данных для каждой полки

    const firstShelf = shelves[0];
    const firstNormal = getNormal(firstShelf.dir);

    let currentTop = firstShelf.isTop
        ? { x: 0, y: 0 }
        : {
            x: -firstNormal.x * thickness,
            y: -firstNormal.y * thickness
        };

    let currentBottom = firstShelf.isTop
        ? {
            x: firstNormal.x * thickness,
            y: firstNormal.y * thickness
        }
        : { x: 0, y: 0 };

    sideA.push({ ...currentTop });
    sideB.push({ ...currentBottom });

    // Шаг 2: Расчет пересечений контуров и формирование геометрии
    for (let i = 0; i < shelves.length; i++) {
        const shelf = shelves[i];
        const nextShelf = shelves[i + 1];
        const normal = getNormal(shelf.dir);

        let targetTop;
        let targetBottom;

        if (shelf.isTop) {
            targetTop = {
                x: currentTop.x + shelf.dir.x * shelf.length,
                y: currentTop.y + shelf.dir.y * shelf.length
            };

            targetBottom = {
                x: targetTop.x + normal.x * thickness,
                y: targetTop.y + normal.y * thickness
            };
        } else {
            targetBottom = {
                x: currentBottom.x + shelf.dir.x * shelf.length,
                y: currentBottom.y + shelf.dir.y * shelf.length
            };

            targetTop = {
                x: targetBottom.x - normal.x * thickness,
                y: targetBottom.y - normal.y * thickness
            };
        }

        if (!nextShelf) {
            currentTop = targetTop;
            currentBottom = targetBottom;
        } else {
            const nextNormal = getNormal(nextShelf.dir);

            if (shelf.isTop) {
                currentTop = targetTop;

                const nextOffset = {
                    x: currentTop.x + nextNormal.x * thickness,
                    y: currentTop.y + nextNormal.y * thickness
                };

                currentBottom =
                    intersectLines(
                        currentBottom,
                        shelf.dir,
                        nextOffset,
                        nextShelf.dir
                    ) || targetBottom;
            } else {
                currentBottom = targetBottom;

                const nextOffset = {
                    x: currentBottom.x - nextNormal.x * thickness,
                    y: currentBottom.y - nextNormal.y * thickness
                };

                currentTop =
                    intersectLines(
                        currentTop,
                        shelf.dir,
                        nextOffset,
                        nextShelf.dir
                    ) || targetTop;
            }
        }

        sideA.push({ ...currentTop });
        sideB.push({ ...currentBottom });

        // Вектор нормали, который смотрит во внешнюю среду («на воздух») от размерной стороны:
        // Для внешней грани (isTop) базовая нормаль (nx, ny) уже автоматически направлена наружу.
        // Для внутренней грани (isBottom) направление наружу будет противоположным (-nx, -ny).
        const outwardX = shelf.isTop ? normal.x : -normal.x;
        const outwardY = shelf.isTop ? normal.y : -normal.y;

        // Пакуем готовую технологическую карту полки, чтобы не вычислять векторы заново при рендере
        shelvesData.push({
            index: i,
            length: shelf.length,
            isTop: shelf.isTop,
            angleRad: shelf.angleRad,
            // Передаем единичный вектор движения этой полки
            dir: { x: shelf.dir.x, y: shelf.dir.y },
            // Передаем вектор направления от полки строго «на воздух» (для выноса размеров)
            outward: { x: outwardX, y: outwardY }
        });
    }

    return {
        sideA,
        sideB,
        shelvesData // <- Новый массив с полными данными векторов направлений и нормалей наружу
    };
};

export default buildProfileGeometry;
