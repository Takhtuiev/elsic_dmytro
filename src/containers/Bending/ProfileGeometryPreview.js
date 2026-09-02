import React, { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";

const D = 180 / Math.PI;
const AR = 12;           // Фиксированный радиус дуги угла в пикселях
const LABEL_OFFSET = 12; // Чистый воздушный зазор от грани до текста
const FONT_SIZE = 11;
const TEXT_HALF_HEIGHT = FONT_SIZE / 2;

const ProfileGeometryPreview = ({ profile }) => {

    const svgData = useMemo(() => {
        const geometry = buildProfileGeometry(profile);
        if (!geometry.sideA || !geometry.sideA.length) return null;

        const pts = [...geometry.sideA, ...geometry.sideB];

        // 1. Авто-масштабирование чертежа под SVG-контейнер
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);

        const w = maxX - minX || 1, h = maxY - minY || 1;
        const VW = 600, VH = 350, P = 60;
        const scale = Math.min((VW - P * 2) / w, (VH - P * 2) / h);
        const ox = (VW - w * scale) / 2, oy = (VH - h * scale) / 2;

        const cv = p => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale });
        const a = geometry.sideA.map(cv);
        const b = geometry.sideB.map(cv);

        const sideAPath = a.map(p => `${p.x} ${p.y}`).join(" L ");
        const sideBPath = b.map(p => `${p.x} ${p.y}`).join(" L ");

        const labels = [], angles = [];
        const profileBends = profile.bends || [];

        // 2. Расчет размерных надписей длин полок и дуг углов за ОДИН проход O(N)
        geometry.shelvesData.forEach((sh, i) => {
            const cur = sh.isTop ? a : b;
            const p1 = cur[i], p2 = cur[i + 1];

            // Идеальный геометрический центр линии размерной грани
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);

            if (len > 1e-5) {
                let angle = Math.atan2(dy, dx) * D;
                if (angle > 90) angle -= 180;
                if (angle < -90) angle += 180;

                // Чистый экранный перпендикуляр к полке
                const nx = -dy / len, ny = dx / len;

                // Находим центр противоположной грани для определения вектора наружу
                const opp = sh.isTop ? b : a;
                const xOpp = (opp[i].x + opp[i + 1].x) / 2;
                const yOpp = (opp[i].y + opp[i + 1].y) / 2;

                const sign = ((midX - xOpp) * nx + (midY - yOpp) * ny) >= 0 ? 1 : -1;
                const totalShift = LABEL_OFFSET + TEXT_HALF_HEIGHT;

                labels.push({
                    text: `${sh.length}`,
                    x: midX + nx * sign * totalShift,
                    y: midY + ny * sign * totalShift,
                    angle
                });
            }

            // 3. Расчет дуг и градусов углов строго по синхронному индексу i
            const bend = profileBends[i]; // Прямой мгновенный вызов без циклов поиска!
            const jointIdx = i + 1;       // Индекс точки апекса стыка на экране

            if (bend && jointIdx < a.length - 1) {
                const isInnerB = bend.direction === "right";
                const p = isInnerB ? b : a;
                const oppP = isInnerB ? a : b;

                const q = p[jointIdx - 1], z = p[jointIdx], n = p[jointIdx + 1];
                const zOpp = oppP[jointIdx];

                const v1x = q.x - z.x, v1y = q.y - z.y;
                const v2x = n.x - z.x, v2y = n.y - z.y;
                const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);

                if (l1 > 1e-5 && l2 > 1e-5) {
                    const u1x = v1x / l1, u1y = v1y / l1;
                    const u2x = v2x / l2, u2y = v2y / l2;

                    const arcP1 = { x: z.x + u1x * AR, y: z.y + u1y * AR };
                    const arcP2 = { x: z.x + u2x * AR, y: z.y + u2y * AR };

                    let bx = u1x + u2x, by = u1y + u2y;
                    const bl = Math.hypot(bx, by);
                    if (bl > 1e-5) { bx /= bl; by /= bl; } else { bx = -u1y; by = u1x; }

                    if (bx * (z.x - zOpp.x) + by * (z.y - zOpp.y) < 0) {
                        bx = -bx; by = -by;
                    }

                    const rawCross = u1x * u2y - u1y * u2x;
                    let sweep = rawCross > 0 ? 1 : 0;
                    if (rawCross * (isInnerB ? -1 : 1) < 0) sweep = sweep === 1 ? 0 : 1;

                    angles.push({
                        text: `${bend.angle}°`,
                        x: z.x + bx * (AR + 12),
                        y: z.y + by * (AR + 12),
                        path: `M ${arcP1.x} ${arcP1.y} A ${AR} ${AR} 0 0 ${sweep} ${arcP2.x} ${arcP2.y}`
                    });
                }
            }
        });

        return { VW, VH, a, b, sideAPath, sideBPath, labels, angles };
    }, [profile]);

    if (!svgData) return null;

    return (
        <Paper elevation={1} sx={{ mt: 2, p: 2 }}>
            <Typography variant="subtitle1" fontWeight="500" sx={{ mb: 1, color: "text.secondary" }}>
                Профиль гибки (Чертеж геометрии)
            </Typography>
            <Box sx={{ width: "100%", height: 350 }}>
                <svg viewBox={`0 0 ${svgData.VW} ${svgData.VH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                    <BendProfileRender data={svgData} />
                </svg>
            </Box>
        </Paper>
    );
};

export default ProfileGeometryPreview;
