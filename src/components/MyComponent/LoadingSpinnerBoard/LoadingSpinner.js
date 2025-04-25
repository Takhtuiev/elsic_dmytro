import { CircularProgress, Typography } from "@mui/material";
import React from "react";
import { Box } from "@mui/system";

function BoardSpinner() {
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
                backgroundColor: "rgba(0, 0, 0, 0.1)", // Затемнение фона
                borderRadius: "0.5rem",
                border: "1px solid rgba(0, 0, 0, 0.3)", // Полупрозрачный бордюр
                padding: "1rem",
                zIndex: "10000",
            }}
        >
            <CircularProgress />
            <Typography variant="body1" color="primary" ml={"1rem"}>
                Loading...
            </Typography>
        </Box>
    );
}

function LoadingSpinner({ active, children}) {
    return (
        <Box style={{ position: "relative" }}>
            {active && (
                <>
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            backgroundColor: "rgba(0, 0, 0, 0.1)", // Затемнение фона
                            borderRadius: '0.25rem',
                            zIndex: "1000",
                        }}
                    />
                    <BoardSpinner />
                </>
            )}
            {children}
        </Box>
    );
}

export default LoadingSpinner;
