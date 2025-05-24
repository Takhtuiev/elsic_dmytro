import {
    CardMedia,
    Typography
} from "@mui/material";
import React from "react";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {BrandActionsMas} from "./BrandActionsMas";
import {Box} from "@mui/system";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";

function BrandCard({ brand, setAction }) {

    if (!brand) { return null }

    return (
        <Box display="flex" justifyContent="center">
            <Box display="flex"
                 sx={(theme) => ({
                     m: 1,
                     p: 1,
                     width: "100%",
                     maxWidth: 'md',
                     height: "100%",
                     backgroundColor: theme.palette.background.paper
                 })}
            >
                {brand.imageUrl && (
                    <CardMedia
                        component="img"
                        image={getCloudinaryUrl(brand.imageUrl)}
                        alt={brand.name}
                        sx={{
                            m:2,
                            maxWidth: '20%',
                            maxHeight: '16rem',
                            objectFit: "contain",
                        }}
                    />
                )}
                <Box display="flex" flexDirection="column" flex="1" gap={2} justifyContent="space-between">
                    <Typography variant="h4" sx={{ textAlign: 'center' }}>
                        {brand.name}
                    </Typography>
                    <Typography variant="body1">{brand.description}</Typography>
                    <Box display="flex" justifyContent="flex-end">
                        <ActionGroupButton masActions={BrandActionsMas(brand)} setAction={setAction} />
                    </Box>
                </Box>
            </Box>
        </Box>

    );
}

export default BrandCard;
