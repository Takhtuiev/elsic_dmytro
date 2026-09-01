import React from "react";
import { Box } from "@mui/material";
import { OrganizationProfile } from "@clerk/clerk-react";

function OrganizationAdmin() {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                py: 1,
            }}
        >
            <OrganizationProfile />
        </Box>
    );
}

export default OrganizationAdmin;