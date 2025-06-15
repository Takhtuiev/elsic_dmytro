import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

export function BoardSpinner() {
    return (
        <Box
            sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                borderRadius: 1,
                border: "1px solid rgba(0, 0, 0, 0.3)",
                px: 3,
                py: 2,
                zIndex: 1201,
            }}
        >
            <CircularProgress size={24} />
            <Typography variant="body1" color="primary" sx={{ ml: 2 }}>
                Loading...
            </Typography>
        </Box>
    );
}

function LoadingSpinner({ active, children }: { active: boolean; children: React.ReactNode }) {
    return (
        <Box sx={{ position: "relative" }}>
            {children}
            {active && (
                <>
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            backgroundColor: "rgba(0, 0, 0, 0.1)",
                            borderRadius: 1,
                            zIndex: 1200,
                        }}
                    />
                    <BoardSpinner />
                </>
            )}
        </Box>
    );
}

export default LoadingSpinner;
