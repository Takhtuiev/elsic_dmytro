import React from "react";
import {Box} from "@mui/system";
import {Card} from "@mui/material";

function MyCard({ children, onClick, sx }) {

    return (
        <Card
            onClick={onClick}
            sx={{
                height: "100%",
                width: "100%",
                wordBreak: 'break-word',
                hyphens: 'auto',
                overflowWrap: 'break-word',

                display: 'flex',
                justifyContent: "space-between",

                overflow: "visible",

                border: "1px solid",  // Явно задаем стиль рамки
                borderColor: theme => theme.palette.background.paper, // Цвет рамки

                //backgroundColor: theme => theme.palette.background.paper,

                transition: "all 0.2s ease",  // Плавный переход фона
                "&:hover": {
                    cursor: "pointer",
                    borderColor: theme => theme.palette.primary.main, // Цвет рамки
                },

                ...sx
            }}
        >

            {children}

        </Card>

    );
}

export default MyCard;
