import { LinearProgress, Box } from "@mui/material";
import React from "react";

function TopLinearLoading({ active }: { active: boolean }) {
    if (!active) return null;

    return (
        <Box sx={{ width: '100%', position: 'fixed', top: 0, left: 0, zIndex: 1300 }}>
            <LinearProgress />
        </Box>
    );
}

export default TopLinearLoading;
