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
    const profileShelves = profile.shelves || [];
    const profileBends = profile.bends || [];

    if (!profileShelves.length) return { sideA: [], sideB: [], shelvesData: [] };

    const sideA = [];
    const sideB = [];
    const shelvesData = [];

    // Шаг 1: Расчет чистых направлений полок на основе массива bends
    let currentAngle = 0;
    const computedShelves = profileShelves.map((shelf, i) => {
        const shelfData = {
            length: Number(shelf.length) || 0,
            isTop: shelf.side !== "left",
            dir: getDirection(currentAngle),
            angleRad: currentAngle
        };

        // Угол следующей полки меняется изгибом, который лежит между ними
        const bend = profileBends[i];
        if (bend) {
            const turningAngle = ((180 - (Number(bend.angle) || 0)) * Math.PI) / 180;
            currentAngle += (bend.direction === "left" ? 1 : -1) * turningAngle;
        }

        return shelfData;
    });

    // Шаг 2: Инициализация стартовых точек профиля
    const firstShelf = computedShelves[0];
    const firstNormal = getNormal(firstShelf.dir);

    let currentTop = firstShelf.isTop
        ? { x: 0, y: 0 }
        : { x: -firstNormal.x * thickness, y: -firstNormal.y * thickness };

    let currentBottom = firstShelf.isTop
        ? { x: firstNormal.x * thickness, y: firstNormal.y * thickness }
        : { x: 0, y: 0 };

    sideA.push({ ...currentTop });
    sideB.push({ ...currentBottom });

    // Шаг 3: Построение геометрии апексов по цепочке
    for (let i = 0; i < computedShelves.length; i++) {
        const shelf = computedShelves[i];
        const nextShelf = computedShelves[i + 1];
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
                currentBottom = intersectLines(currentBottom, shelf.dir, nextOffset, nextShelf.dir) || targetBottom;
            } else {
                currentBottom = targetBottom;
                const nextOffset = {
                    x: currentBottom.x - nextNormal.x * thickness,
                    y: currentBottom.y - nextNormal.y * thickness
                };
                currentTop = intersectLines(currentTop, shelf.dir, nextOffset, nextShelf.dir) || targetTop;
            }
        }

        sideA.push({ ...currentTop });
        sideB.push({ ...currentBottom });

        // Вектор наружу на воздух от размерной стороны
        const outwardX = shelf.isTop ? normal.x : -normal.x;
        const outwardY = shelf.isTop ? normal.y : -normal.y;

        shelvesData.push({
            index: i,
            length: shelf.length,
            isTop: shelf.isTop,
            angleRad: shelf.angleRad,
            dir: { x: shelf.dir.x, y: shelf.dir.y },
            outward: { x: outwardX, y: outwardY }
        });
    }

    return { sideA, sideB, shelvesData };
};

export default buildProfileGeometry;
