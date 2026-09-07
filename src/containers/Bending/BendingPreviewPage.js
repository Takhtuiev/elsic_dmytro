import React from "react";
import {Box} from "@mui/material";

import BendingPreview from "./BendingPreview";

const BendingPreviewPage=({
    profile,
    blankLength,
    machineParams,
    rotationPreview
})=>{
    return(
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
     );
};

export default BendingPreviewPage;
