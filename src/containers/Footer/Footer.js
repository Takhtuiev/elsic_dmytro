import React from "react";
import {
    Typography,
    Link,
    Divider,
    Box,
} from "@mui/material";

function Footer() {
    return (
        <Box
            component="footer"
            sx={{
                backgroundColor: "#172f3b",
                color: "#fff",
                mt: "auto",
            }}
        >
            <Box
                sx={{
                    maxWidth: 1200,
                    mx: "auto",
                    px: { xs: 2, sm: 3, md: 4 },
                }}
            >
                <Box
                    sx={{
                        py: { xs: 4, md: 5 },
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", md: "center" },
                        gap: 4,
                    }}
                >
                    <Box sx={{ maxWidth: 430 }}>
                        <Typography
                            sx={{
                                fontSize: "1.35rem",
                                fontWeight: 700,
                                letterSpacing: 1,
                                mb: 1,
                            }}
                        >
                            ELSIC_Dmytro
                        </Typography>

                        <Typography
                            variant="body2"
                            sx={{
                                color: "rgba(255,255,255,.6)",
                                lineHeight: 1.7,
                            }}
                        >
                            Praktische technische Werkzeuge
                            für Berechnungen und Aufgaben
                            in der Fertigung.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: { xs: 2, sm: 3 },
                        }}
                    >
                        <FooterLink href="/">
                            Startseite
                        </FooterLink>

                        <FooterLink href="/tools">
                            Werkzeuge
                        </FooterLink>

                        <FooterLink href="/biegeberechnung">
                            Biegeberechnung
                        </FooterLink>
                    </Box>
                </Box>

                <Divider
                    sx={{
                        borderColor: "rgba(255,255,255,.12)",
                    }}
                />

                <Box
                    sx={{
                        py: 2.5,
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", sm: "center" },
                        gap: 1.5,
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            color: "rgba(255,255,255,.4)",
                        }}
                    >
                        © {new Date().getFullYear()} ELSIC_Dmytro
                    </Typography>

                    <Typography
                        variant="caption"
                        sx={{
                            color: "rgba(255,255,255,.4)",
                        }}
                    >
                        Privates Hilfsprojekt ·
                        nicht offizielles ELSIC-Portal ·
                        Ergebnisse ohne Gewähr
                    </Typography>

                    <Typography
                        variant="caption"
                        sx={{
                            color: "rgba(255,255,255,.4)",
                        }}
                    >
                        Entwicklung:{" "}
                        <Link
                            href="#"
                            underline="hover"
                            sx={{
                                color: "rgba(255,255,255,.65)",
                                "&:hover": {
                                    color: "#fff",
                                },
                            }}
                        >
                            Dmytro Takhtuiev
                        </Link>
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

function FooterLink({ href, children }) {
    return (
        <Link
            href={href}
            underline="none"
            sx={{
                color: "rgba(255,255,255,.65)",
                fontSize: 14,
                transition: "color .2s ease",
                "&:hover": {
                    color: "#fff",
                },
            }}
        >
            {children}
        </Link>
    );
}

export default Footer;
