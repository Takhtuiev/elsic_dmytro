import React from "react";
import {Box} from "@mui/material";

import BendingPreview from "./BendingPreview";

const BendingPreviewPage=({
                              profile,
                              blankLength,
                              machineParams,
                              rotationPreview
                          })=>(
    <Box
        sx={{
            width:"100%",
            height:"100%",
            minHeight:0,
            display:"flex",
            flexDirection:"column"
        }}
    >
        <BendingPreview
            profile={profile}
            blankLength={blankLength}
            machineParams={machineParams}
            rotationPreview={rotationPreview}
        />
    </Box>
);

export default BendingPreviewPage;