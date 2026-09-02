import React from "react";
import { Box } from "@mui/material";
import { OrganizationProfile } from "@clerk/clerk-react";

function OrganizationAdmin() {
    return (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "center", py: 2 }}>
            <OrganizationProfile
                appearance={{
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