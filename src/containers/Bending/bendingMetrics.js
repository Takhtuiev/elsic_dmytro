// Pure derived metrics used by the preview UI. Units match the original formulas.

export const calculateMass = (blankLength, width, thickness, density) => {
    if (
        Number.isFinite(blankLength) &&
        Number.isFinite(width) &&
        Number.isFinite(thickness) &&
        Number.isFinite(density)
    ) {
        return (blankLength * width * thickness * density) / 1e9;
    }
    return null;
};

// Ширина гибочной зоны (полная) по её полуширине
export const calculatePlasticZoneWidth = (halfWidth) =>
    halfWidth !== undefined && halfWidth !== null ? halfWidth * 2 : null;

// Требуемая ширина нагрева для гиба: в изгиб уходит дуга нейтрального слоя
//   W = θ · (r + K·t),  θ — угол поворота полки (180° − угол между полками), r — радиус
//   инструмента машины (внутренний радиус гиба), K — коэффициент нейтрального слоя.
export const calculateRequiredZoneWidth = (bendAngleDeg, toolRadius, thickness, kFactor) => {
    const turn = 180 - Number(bendAngleDeg);
    const r = Number(toolRadius);
    const t = Number(thickness);
    const k = Number(kFactor);
    if (!Number.isFinite(turn) || !Number.isFinite(r) || !Number.isFinite(t) || !Number.isFinite(k) || turn <= 0) return null;
    return (turn * Math.PI / 180) * (r + k * t);
};

// Самый требовательный гиб профиля (наибольший поворот) или выбранный
export const findGoverningBend = (bends, selectedIndex = -1) => {
    const list = Array.isArray(bends) ? bends : [];
    if (selectedIndex >= 0 && list[selectedIndex]) return { index: selectedIndex, angle: Number(list[selectedIndex].angle) };
    let best = null;
    list.forEach((b, index) => {
        const angle = Number(b?.angle);
        if (Number.isFinite(angle) && (!best || angle < best.angle)) best = { index, angle };
    });
    return best;
};
