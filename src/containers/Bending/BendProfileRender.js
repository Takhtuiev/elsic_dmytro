import React from "react";

import {
    LINE_WIDTH,
    ANNOTATION_LINE_WIDTH,
    ANNOTATION_FONT_WEIGHT
} from "./svgConstants";
import { ARROW_LENGTH, ARROW_WIDTH } from "./dimensionPlacement";

// Стрелка размерной линии: остриё в tip, направление dir, размеры от кегля подписи
const arrowPoints = ({ tip, dir, len: ownLen, half: ownHalf, arc }, fontSize) => {
    const len = ownLen ?? ARROW_LENGTH * fontSize;
    const half = ownHalf ?? ARROW_WIDTH * fontSize;
    if (arc) {
        // Стрелка дуги изогнута вместе с дугой: края — дуги радиусов r ± ширина
        const pts = [`${tip.x},${tip.y}`];
        const edge = (sign) => {
            const out = [];
            for (let k = 1; k <= 4; k++) {
                const t = k / 4;
                const ang = arc.tipAngle + arc.sweep * t;
                const r = arc.r + sign * half * t;
                out.push(`${arc.cx + Math.cos(ang) * r},${arc.cy + Math.sin(ang) * r}`);
            }
            return out;
        };
        return [...pts, ...edge(1), ...edge(-1).reverse()].join(" ");
    }
    const bx = tip.x - dir.x * len;
    const by = tip.y - dir.y * len;
    return `${tip.x},${tip.y} ${bx - dir.y * half},${by + dir.x * half} ${bx + dir.y * half},${by - dir.x * half}`;
};

const linesPath = (lines) => lines.map(([p, q]) => `M ${p.x} ${p.y} L ${q.x} ${q.y}`).join(" ");

const BendProfileRender = ({
    data,
    strokeColor = "#424242",
    fillColor = "#f0f0f0",
    annotationColor = strokeColor,
    haloColor = null,
    isGhost = false
}) => {
    if (!data) return null;

    // Обводка текста цветом фона: размер читается и поверх линий
    const halo = haloColor
        ? { stroke: haloColor, strokeWidth: 3, strokeLinejoin: "round", paintOrder: "stroke", vectorEffect: "non-scaling-stroke" }
        : null;
    const thin = {
        fill: "none",
        stroke: annotationColor,
        strokeWidth: ANNOTATION_LINE_WIDTH,
        strokeLinecap: "butt",
        vectorEffect: "non-scaling-stroke"
    };

    return (
        <g style={{ opacity: isGhost ? 0.5 : 1 }}>
            {data.fillPoints && <polygon points={data.fillPoints} fill={fillColor} />}

            {[data.sideAPath, data.sideBPath].map((side, i) => (
                <path
                    key={i}
                    d={`M ${side}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={LINE_WIDTH}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
            ))}

            {data.a.length > 0 && (
                <>
                    {data.strokeStartCap && (
                        <line
                            x1={data.a[0].x}
                            y1={data.a[0].y}
                            x2={data.b[0].x}
                            y2={data.b[0].y}
                            stroke={strokeColor}
                            strokeWidth={LINE_WIDTH}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                    {data.strokeEndCap && (
                        <line
                            x1={data.a[data.a.length - 1].x}
                            y1={data.a[data.a.length - 1].y}
                            x2={data.b[data.b.length - 1].x}
                            y2={data.b[data.b.length - 1].y}
                            stroke={strokeColor}
                            strokeWidth={LINE_WIDTH}
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </>
            )}

            {/* Размеры длин: выносные и размерные линии, стрелки */}
            {(data.dims || []).map((dim, i) => (
                <g key={`dim-${i}`}>
                    <path d={linesPath(dim.lines)} {...thin} />
                    {dim.arrows.map((ar, k) => (
                        <polygon key={k} points={arrowPoints(ar, dim.fontSize)} fill={annotationColor} />
                    ))}
                </g>
            ))}

            {/* Размеры углов: дуга со стрелками */}
            {data.angles.map((ang, i) => (
                <g key={`ang-${i}`}>
                    <path d={ang.path} {...thin} />
                    {(ang.arrows || []).map((ar, k) => (
                        <polygon key={k} points={arrowPoints(ar, ang.fontSize)} fill={annotationColor} />
                    ))}
                    <text
                        x={ang.x}
                        y={ang.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={ang.fontSize || 11}
                        fill={annotationColor}
                        fontWeight={ANNOTATION_FONT_WEIGHT}
                        {...halo}
                    >
                        {ang.text}
                    </text>
                </g>
            ))}

            {data.labels.map((lbl, i) => (
                <text
                    key={`lbl-${i}`}
                    x={lbl.x}
                    y={lbl.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={lbl.fontSize || 11}
                    fontWeight={ANNOTATION_FONT_WEIGHT}
                    fill={annotationColor}
                    transform={`rotate(${lbl.angle},${lbl.x},${lbl.y})`}
                    {...halo}
                >
                    {lbl.text}
                    {lbl.unit && (
                        <tspan fontSize="80%" fontWeight={ANNOTATION_FONT_WEIGHT}>{` ${lbl.unit}`}</tspan>
                    )}
                </text>
            ))}
        </g>
    );
};

export default BendProfileRender;
