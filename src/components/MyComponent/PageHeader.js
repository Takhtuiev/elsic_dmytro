import {Box} from "@mui/system";
import {Typography} from "@mui/material";
import React from "react";


function PageHeader({text}) {
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center', // по горизонтали
                alignItems: 'center',     // по вертикали (если нужно)
                height: '100%',           // при необходимости
            }}
        >
            <Box
                sx={{
                    display: "inline-block",
                    backgroundColor: 'background.paper',
                    borderRadius: "4px",
                    color: 'text.secondary',
                    mt: 1,
                    mx: 1,
                    px: 1,
                }}
            >
                <Typography variant="body1" component="h1">
                    {text}
                </Typography>
            </Box>
        </Box>
    )
}

export default PageHeader;