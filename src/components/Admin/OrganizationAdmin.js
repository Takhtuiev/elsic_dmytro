import React from "react";
import { Box, useTheme } from "@mui/material";
import { OrganizationProfile } from "@clerk/clerk-react";
import { dark } from "@clerk/ui/themes"; // Импортируем темную тему так же, как в UserBar

function OrganizationAdmin() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "center", py: 2 }}>
            <OrganizationProfile
                appearance={{
                    // По аналогии с UserBar: если тема темная, применяем dark
                    baseTheme: isDark ? dark : undefined,
                    elements: {
                        organizationProfileRoot: {
                            width: "100%",
                            maxWidth: "960px",
                        },
                        card: {
                            width: "100%",
                        },
                    },
                }}
            />
        </Box>
    );
}

export default OrganizationAdmin;
