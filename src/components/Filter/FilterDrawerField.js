import {Box, Button, Drawer, ListItemButton, MenuItem, Typography} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import React from "react";

const FilterDrawerField = ({expanded, setExpanded, headText, closeFilters, children}) => {

    return (
        <Drawer anchor="left" open={expanded} onClose={() => setExpanded(false)}>
            <Box sx={{ minWidth: "18rem", height: "100%", display: "flex", flexDirection: "column" }}>
                {/* Верхний заголовок */}
                <ListItemButton
                    onClick={() => setExpanded(false)}
                    sx={{
                        p: 1,
                        color: "primary.main",
                        width: "100%",
                    }}
                >
                    <ChevronLeftIcon sx={{ mr: "0.5rem" }} />
                    <Typography variant="h6" color="primary">
                        {headText}
                    </Typography>
                </ListItemButton>

                {/* Контент с чекбоксами */}
                {children}

                {/* Кнопки управления */}
                <Box sx={{ display: "flex", gap: 1, p: 1 }}>
                    <Button variant="outlined" color="primary" size="small" fullWidth
                            onClick={() => setExpanded(false)}
                    >
                        Назад
                    </Button>
                    <Button variant="contained" color="primary" size="small" fullWidth
                            onClick={() => {
                                setExpanded(false);
                                closeFilters();
                            }}
                    >
                        Показати
                    </Button>
                </Box>
            </Box>
        </Drawer>

    )

}

export default FilterDrawerField