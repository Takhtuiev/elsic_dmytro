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

export const calculatePlasticZoneWidth = (xTgPauseValue) =>
    xTgPauseValue !== undefined && xTgPauseValue !== null
        ? xTgPauseValue * 2
        : null;

export const calculateMaxInnerRadius = (plasticZoneWidth, bendAngle, thickness, kFactor) => {
    if (bendAngle == null || plasticZoneWidth == null) return null;
    const turnAngleRad = (Number(bendAngle) * Math.PI) / 180;
    if (turnAngleRad <= 0) return 0;
    const innerRadius = plasticZoneWidth / turnAngleRad - kFactor * thickness;
    return innerRadius > 0 ? innerRadius : 0;
};
