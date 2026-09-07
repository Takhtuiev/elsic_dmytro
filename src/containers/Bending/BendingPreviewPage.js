import React from "react";
import {Box,Paper} from "@mui/material";

import BendingPreview from "./BendingPreview";

const BendingPreviewPage=({
    profile,
    blankLength,
    machineParams,
    rotationPreview
})=>{
    return(
        <Paper
            elevation={2}
            sx={{
                mt:2,
                p:2
            }}
        >
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
                    rotationPreview={rotationPreview}
                />
            </Box>
        </Paper>
    );
};

export default BendingPreviewPage;
