import React, { useMemo } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./profileGeometryBasing";

const VW = 600;
const VH = 450;
const PADDING = 40;

const ProfileGeometryPreview = ({
                                    profile,
                                    blankLength,
                                    machineParams
                                }) => {
    const theme = useTheme();

    const ACTIVE_LINE_COLOR = theme.palette.text.primary;
    const ACTIVE_FILL_COLOR = alpha(theme.palette.text.primary, 0.08);

    const GHOST_LINE_COLOR = theme.palette.text.disabled;
    const GHOST_FILL_COLOR = alpha(theme.palette.text.disabled, 0.08);

    const BLUE_LINE_COLOR = theme.palette.primary.main;
    const BLUE_FILL_COLOR = alpha(theme.palette.primary.main, 0.08);

    const svgData = useMemo(() => {
        const geometry = buildProfileGeometry(profile);

        return prepareSvgLayers(
            geometry,
            profile,
            VW,
            VH,
            PADDING,
            profile.referenceBend
        );
    }, [profile]);

    if (!svgData) return null;

    return (
        <Paper elevation={1} sx={{ mt: 2, p: 2 }}>
            <Typography
                variant="subtitle1"
                fontWeight="500"
                sx={{ mb: 1, color: "text.secondary" }}
            >
                Bend Profile (Geometric Drawing)
            </Typography>

            <Box
                sx={{
                    width: "100%",
                    // Вместо фиксированных 450px задаем пропорции чертежа (600 / 450 = 1.333)
                    aspectRatio: `${VW} / ${VH}`,
                    maxHeight: "75vh",
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

            <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                    mt: 1,
                    pt: 1,
                    borderTop: "1px dashed",
                    borderColor: "divider"
                }}
            >
                <Typography variant="caption" color="text.secondary">
                    Thickness:
                </Typography>

                <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.primary"
                >
                    {profile.thickness !== undefined
                        ? `${profile.thickness.toFixed(2)} mm`
                        : "—"}
                </Typography>

                <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ mx: 0.5 }}
                >
                    •
                </Typography>

                <Typography variant="caption" color="text.secondary">
                    Blank Length:
                </Typography>

                <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.primary"
                >
                    {blankLength !== null
                        ? `${blankLength.toFixed(2)} mm`
                        : "—"}
                </Typography>
            </Stack>

            {machineParams && (
                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                        mt: 1,
                        pt: 1,
                        borderTop: "1px dashed",
                        borderColor: "divider"
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        Bend Angle:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.bendAngle.toFixed(2)}°
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ mx: 0.5 }}
                    >
                        •
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Gap Folding:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.gapFolding.toFixed(2)} mm
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ mx: 0.5 }}
                    >
                        •
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Stop Position:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.stopPosition.toFixed(2)} mm
                    </Typography>
                </Stack>
            )}
        </Paper>
    );
};

export default ProfileGeometryPreview;