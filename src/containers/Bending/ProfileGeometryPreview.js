import React, { useMemo, useState, useEffect, useRef } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import buildProfileGeometry from "./BuildProfileGeometry";
import BendProfileRender from "./BendProfileRender";
import { prepareSvgLayers } from "./prepareSvgLayers";

const ProfileGeometryPreview = ({
                                    profile,
                                    blankLength,
                                    machineParams
                                }) => {
    const theme = useTheme();
    const containerRef = useRef(null);

    const [containerSize, setContainerSize] = useState({
        width: 800,
        height: 500
    });

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;

            if (width > 0 && height > 0) {
                setContainerSize({ width, height });
            }
        });

        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    const ACTIVE_LINE_COLOR = theme.palette.text.primary;
    const ACTIVE_FILL_COLOR = alpha(theme.palette.text.primary, 0.1);
    const ACTIVE_ANNOTATION_COLOR = alpha(theme.palette.text.primary, 0.75);

    const GHOST_LINE_COLOR = theme.palette.text.disabled;
    const GHOST_FILL_COLOR = alpha(theme.palette.text.disabled, 0.02);
    const GHOST_ANNOTATION_COLOR = alpha(theme.palette.text.disabled, 0.4);

    const BLUE_LINE_COLOR = theme.palette.primary.main;
    const BLUE_FILL_COLOR = alpha(theme.palette.primary.main, 0.08);
    const BLUE_ANNOTATION_COLOR = alpha(theme.palette.primary.main, 1);

    const svgData = useMemo(() => {
        const geometry = buildProfileGeometry(profile);

        return prepareSvgLayers(
            geometry,
            profile,
            containerSize
        );
    }, [profile, containerSize]);

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
                ref={containerRef}
                sx={{
                    width: "100%",
                    height: "65vh",
                    minHeight: 500,
                    maxHeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden"
                }}
            >
                <svg
                    viewBox={svgData.viewBox}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <BendProfileRender
                        data={svgData.activeData}
                        strokeColor={ACTIVE_LINE_COLOR}
                        fillColor={ACTIVE_FILL_COLOR}
                        annotationColor={ACTIVE_ANNOTATION_COLOR}
                    />

                    {svgData.ghostData && (
                        <BendProfileRender
                            data={svgData.ghostData}
                            strokeColor={GHOST_LINE_COLOR}
                            fillColor={GHOST_FILL_COLOR}
                            annotationColor={GHOST_ANNOTATION_COLOR}
                            isGhost
                        />
                    )}

                    {svgData.blueData && (
                        <BendProfileRender
                            data={svgData.blueData}
                            strokeColor={BLUE_LINE_COLOR}
                            fillColor={BLUE_FILL_COLOR}
                            annotationColor={BLUE_ANNOTATION_COLOR}
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

                <Typography
                    variant="caption"
                    color="text.secondary"
                >
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
                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Stop:
                    </Typography>

                    <Typography
                        variant="caption"
                        fontWeight="600"
                        color="text.primary"
                    >
                        {machineParams.stopPosition.toFixed(2)} mm
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Angle:
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

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        Gap:
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

                </Stack>
            )}
        </Paper>
    );
};

export default ProfileGeometryPreview;