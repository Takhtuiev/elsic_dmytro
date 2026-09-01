import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Paper, Typography, useTheme } from "@mui/material";
import ShieldAlertIcon from "@mui/icons-material/Security";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

function AccessDenied() {
    const navigate = useNavigate();
    const { palette } = useTheme();
    const isDark = palette.mode === "dark";

    const accentColor = isDark ? "#00f0ff" : "#0066cc";
    const errorGlow = isDark
        ? "rgba(255, 46, 99, 0.12)"
        : "rgba(255, 46, 99, 0.03)";

    return (
        <Box
            sx={{
                minHeight: "40vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: 1,
                position: "relative",
                overflow: "visible",
                bgcolor: isDark ? "#0a0d14" : "transparent",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    opacity: isDark ? 0.04 : 0.02,
                    backgroundImage:
                        "linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 0,
                    pointerEvents: "none",
                }}
            />

            <Box
                sx={{
                    position: "absolute",
                    width: 400,
                    height: 400,
                    background: isDark
                        ? `radial-gradient(circle, rgba(0, 240, 255, 0.05) 0%, ${errorGlow} 40%, transparent 70%)`
                        : "radial-gradient(circle, rgba(0, 102, 204, 0.03) 0%, rgba(255, 0, 0, 0.01) 50%, transparent 70%)",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    filter: "blur(25px)",
                    zIndex: 0,
                    pointerEvents: "none",
                }}
            />

            <Paper
                elevation={0}
                sx={{
                    width: "100%",
                    maxWidth: 520,
                    position: "relative",
                    zIndex: 1,
                    backdropFilter: "blur(12px)",
                    bgcolor: isDark
                        ? "rgba(18, 22, 33, 0.8)"
                        : "rgba(255, 255, 255, 0.92)",
                    border: "1px solid",
                    borderColor: isDark
                        ? "rgba(255, 255, 255, 0.07)"
                        : "rgba(0, 0, 0, 0.08)",
                    borderRadius: 2.5,
                    overflow: "visible",
                    boxShadow: isDark
                        ? "0 25px 55px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08)"
                        : "0 18px 40px rgba(20,30,50,.06)",
                }}
            >
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        borderRadius: "10px 10px 0 0",
                        background: `linear-gradient(90deg, transparent, ${
                            isDark ? "#ff2e63" : palette.error.main
                        }, transparent)`,
                        boxShadow: isDark
                            ? "0 0 14px rgba(255,46,99,.7)"
                            : `0 0 12px ${palette.error.main}55`,
                    }}
                />

                <Box sx={{ p: { xs: 2.75, sm: 3.5 }, textAlign: "center" }}>
                    <Box
                        sx={{
                            width: 68,
                            height: 68,
                            mx: "auto",
                            mb: 1.75,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "20px",
                            bgcolor: isDark
                                ? "rgba(255,46,99,.06)"
                                : "rgba(244,67,54,.04)",
                            border: "1px solid",
                            borderColor: isDark
                                ? "rgba(255,46,99,.22)"
                                : "rgba(244,67,54,.18)",
                            boxShadow: isDark
                                ? "0 6px 20px rgba(255,46,99,.12), inset 0 0 12px rgba(255,46,99,.08)"
                                : "0 6px 18px rgba(244,67,54,.08)",
                            color: isDark ? "#ff2e63" : "error.main",
                            transform: "rotate(-4deg)",
                        }}
                    >
                        <ShieldAlertIcon sx={{ fontSize: 36 }} />
                    </Box>

                    <Typography
                        component="div"
                        sx={{
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            fontSize: 10,
                            fontWeight: 700,
                            color: isDark ? accentColor : "primary.main",
                            textTransform: "uppercase",
                            letterSpacing: 1.8,
                            mb: 1,
                        }}
                    >
                        [ system_security_alert ]
                    </Typography>

                    <Typography
                        component="h1"
                        sx={{
                            fontSize: { xs: "1.55rem", sm: "1.85rem" },
                            fontWeight: 800,
                            letterSpacing: "-.025em",
                            lineHeight: 1.2,
                            mb: 1,
                        }}
                    >
                        Access Denied
                    </Typography>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            maxWidth: 420,
                            mx: "auto",
                            lineHeight: 1.5,
                            mb: 2.25,
                            fontSize: ".875rem",
                        }}
                    >
                        Your current session does not possess the required
                        security clearance to access this resource. Please
                        verify your credentials or contact an administrator.
                    </Typography>

                    <Box
                        sx={{
                            bgcolor: isDark
                                ? "rgba(0,0,0,.25)"
                                : "rgba(0,0,0,.02)",
                            border: "1px solid",
                            borderColor: isDark
                                ? "rgba(255,255,255,.04)"
                                : "rgba(0,0,0,.05)",
                            borderRadius: 1.5,
                            p: 1.25,
                            mb: 2.5,
                            textAlign: "left",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: "text.secondary",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                                mb: 0.5,
                            }}
                        >
                            <span
                                style={{
                                    color: isDark ? "#ff9f43" : "#d35400",
                                }}
                            >
                                Exception:
                            </span>
                            <span>HTTP_403_FORBIDDEN</span>
                        </Box>

                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                            }}
                        >
                            <span>Endpoint:</span>
                            <span
                                style={{
                                    opacity: 0.7,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: 240,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {window.location.pathname}
                            </span>
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
                        onClick={() => navigate(-1)}
                        sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            fontSize: ".9rem",
                            px: 3,
                            py: 0.9,
                            borderRadius: 1.5,
                            bgcolor: isDark
                                ? "rgba(255,255,255,.08)"
                                : "text.primary",
                            color: isDark ? "#fff" : "background.paper",
                            border: isDark
                                ? "1px solid rgba(255,255,255,.1)"
                                : "none",
                            boxShadow: isDark
                                ? "0 7px 20px rgba(0,0,0,.3)"
                                : "0 7px 18px rgba(0,0,0,.12)",
                            transition: "all .2s ease-in-out",
                            "&:hover": {
                                bgcolor: isDark
                                    ? "rgba(255,255,255,.15)"
                                    : "rgba(0,0,0,.8)",
                                boxShadow: "none",
                                transform: "translateY(-1px)",
                            },
                            "&:active": {
                                transform: "translateY(1px)",
                            },
                        }}
                    >
                        Go Back
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}

export default AccessDenied;