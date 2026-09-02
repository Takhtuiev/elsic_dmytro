import React, { useMemo } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles"; // Импортируем хелпер прозрачности для MUI
import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./profileGeometryBasing";

const VW = 600;
const VH = 450;
const PADDING = 40;

const ProfileGeometryPreview = ({ profile, blankLength }) => {
    const theme = useTheme();

    const ACTIVE_LINE_COLOR = theme.palette.text.primary;
    const ACTIVE_FILL_COLOR = alpha(theme.palette.text.primary, 0.08);

    const GHOST_LINE_COLOR = theme.palette.text.disabled;
    const GHOST_FILL_COLOR = alpha(theme.palette.text.disabled, 0.08);

    const BLUE_LINE_COLOR = theme.palette.primary.main;
    const BLUE_FILL_COLOR = alpha(theme.palette.primary.main, 0.08);

    const svgData = useMemo(() => {
        const geometry = buildProfileGeometry(profile);
        return prepareSvgLayers(geometry, profile, VW, VH, PADDING);
    }, [profile]);

    if (!svgData) return null;

    return (
        <Paper elevation={1} sx={{ mt: 2, p: 2 }}>
            <Typography
                variant="subtitle1"
                fontWeight="500"
                sx={{ mb: 1, color: "text.secondary" }}
            >
                Профиль гибки (Чертеж геометрии)
            </Typography>

            <Box
                sx={{
                    width: "100%",
                    height: `${VH}px`,
                    maxHeight: "80vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                }}
            >
                <svg
                    viewBox={`0 0 ${VW} ${VH}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <BendProfileRender
                        data={svgData.activeData}
                        strokeColor={ACTIVE_LINE_COLOR}
                        fillColor={ACTIVE_FILL_COLOR}
                    />

                    {svgData.ghostData && (
                        <BendProfileRender
                            data={svgData.ghostData}
                            strokeColor={GHOST_LINE_COLOR}
                            fillColor={GHOST_FILL_COLOR}
                            isGhost
                        />
                    )}

                    {svgData.blueData && (
                        <BendProfileRender
                            data={svgData.blueData}
                            strokeColor={BLUE_LINE_COLOR}
                            fillColor={BLUE_FILL_COLOR}
                        />
                    )}
                </svg>
            </Box>

            {/* Толщина и Длина в одну мелкую строчку через разделитель */}
            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mt: 1, pt: 1, borderTop: "1px dashed", borderColor: "divider" }}
            >
                {/* Блок толщины */}
                <Typography variant="caption" color="text.secondary">
                    Thickness:
                </Typography>
                <Typography variant="caption" fontWeight="600" color="text.primary">
                    {profile.thickness !== undefined ? `${profile.thickness.toFixed(2)} mm` : "—"}
                </Typography>

                {/* Разделитель */}
                <Typography variant="caption" color="text.disabled" sx={{ mx: 0.5 }}>
                    •
                </Typography>

                {/* Блок длины развертки */}
                <Typography variant="caption" color="text.secondary">
                    Blank Length:
                </Typography>
                <Typography variant="caption" fontWeight="600" color="text.primary">
                    {blankLength !== null ? `${blankLength.toFixed(2)} mm` : "—"}
                </Typography>
            </Stack>
        </Paper>
    );
};

export default ProfileGeometryPreview;
