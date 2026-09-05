import React from "react";
import {
    Box,
    IconButton,
    Paper,
    Typography
} from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {useNavigate} from "react-router-dom";

import BendingPreview from "./BendingPreview";

const BendingPreviewPage = ({
                                profile,
                                blankLength,
                                machineParams
                            }) => {
    const navigate = useNavigate();

    return (
        <Paper
            elevation={1}
            sx={{
                mt:2,
                p:2,
                position:"relative"
            }}
        >
            <Typography
                variant="subtitle1"
                fontWeight="500"
                color="text.secondary"
                sx={{
                    mb:1,
                    pr:5
                }}
            >
                Bend Profile (Geometric Drawing)
            </Typography>

            <IconButton
                size="small"
                onClick={() =>
                    navigate("/biegeberechnung/preview")
                }
                title="Full screen"
                sx={{
                    color:"text.secondary",
                    position:"absolute",
                    top:12,
                    right:12
                }}
            >
                <FullscreenIcon fontSize="small"/>
            </IconButton>

            <Box
                sx={{
                    width:"100%",
                    height:"65vh",
                    minHeight:500,
                    maxHeight:700
                }}
            >
                <BendingPreview
                    profile={profile}
                    blankLength={blankLength}
                    machineParams={machineParams}
                />
            </Box>
        </Paper>
    );
};

export default BendingPreviewPage;