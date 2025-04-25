// Компонент для создания кнопок с иконками
import {useTheme} from "@mui/system";
import {IconButton, Tooltip} from "@mui/material";
import React from "react";

const IconButtonWithTooltip = ({ icon, onClick, tooltipTitle, color, sx = {} }) => {
    const theme = useTheme(); // Access the theme

    return(
        <Tooltip title={tooltipTitle} disableInteractive placement="right">
            <IconButton
                onClick={onClick}
                sx={{
                    position: 'absolute',
                    color: color,
                    border: 1,
                    borderColor: color,
                    backgroundColor: theme.palette.action.selected,
                    '&:hover': {
                        backgroundColor: theme.palette.background.paper
                    },
                    p: 0.2,
                    ...sx,
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );
};

export default IconButtonWithTooltip;
