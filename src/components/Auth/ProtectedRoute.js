import React from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { Box, Button, Paper, Typography } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import { useAuth } from "@clerk/clerk-react";

function ProtectedRoute({ permission }) {
    const { isLoaded, isSignedIn, has } = useAuth();
    const navigate = useNavigate();

    if (!isLoaded) {
        return null;
    }

    if (!isSignedIn) {
        return <Navigate to="/" replace />;
    }

    const hasPermission = permission
        ? has({ permission })
        : true;

    if (!hasPermission) {
        return (
            <Box
                sx={{
                    minHeight: "60vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 2,
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        width: "100%",
                        maxWidth: 600,
                        p: { xs: 3, sm: 5 },
                        textAlign: "center",
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                    }}
                >
                    <LockIcon
                        sx={{
                            fontSize: 50,
                            color: "warning.main",
                            mb: 2,
                        }}
                    />

                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        Zugriff nicht möglich
                    </Typography>

                    <Typography
                        color="text.secondary"
                        sx={{ mb: 3 }}
                    >
                        Sie haben nicht die erforderlichen Rechte,
                        um dieses Werkzeug zu verwenden.
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={() => navigate(-1)}
                    >
                        Zurück
                    </Button>
                </Paper>
            </Box>
        );
    }

    return <Outlet />;
}

export default ProtectedRoute;