import React from "react";

const C = "#424242"; // Цвет линий и шрифта чертежа

const BendProfileRender = ({ data }) => {
    if (!data) return null;

    return (
        <g>
            {/* Внешняя грань профиля (Side A), построенная по апексам */}
            <path d={`M ${data.sideAPath}`} fill="none" stroke={C} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {/* Внутренняя грань профиля (Side B), построенная по апексам */}
            <path d={`M ${data.sideBPath}`} fill="none" stroke={C} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {/* Боковые торцы (заглушки заготовки металла по краям) */}
            {data.a.length > 0 && (
                <>
                    <line x1={data.a[0].x} y1={data.a[0].y} x2={data.b[0].x} y2={data.b[0].y} stroke={C} strokeWidth="2" />
                    <line
                        x1={data.a[data.a.length - 1].x}
                        y1={data.a[data.a.length - 1].y}
                        x2={data.b[data.b.length - 1].x}
                        y2={data.b[data.b.length - 1].y}
                        stroke={C}
                        strokeWidth="2"
                    />
                </>
            )}

            {/* Отрисовка пунктирных дуг и градусов углов */}
            {data.angles.map((ang, i) => (
                <g key={`ang-${i}`}>
                    <path d={ang.path} fill="none" stroke={C} strokeWidth="1" strokeDasharray="2,2" />
                    <text x={ang.x} y={ang.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={C} fontWeight="500">
                        {ang.text}
                    </text>
                </g>
            ))}

            {/* Отрисовка размерных надписей длин полок */}
            {data.labels.map((lbl, i) => (
                <text key={`lbl-${i}`} x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="bold" fill={C} transform={`rotate(${lbl.angle},${lbl.x},${lbl.y})`}>
                    {lbl.text}
                </text>
            ))}
        </g>
    );
};

export default BendProfileRender;
