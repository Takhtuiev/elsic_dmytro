import {
    Button,
    Drawer,
    ListItemButton,
    Typography,
    useTheme,
} from "@mui/material";
import { Box } from "@mui/system";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import React, { useState } from "react";
import FiltersAccordion from "./FiltersAccordion";

function FiltersDrawer({
                           params,
                           FILTER_PARAMS,
                           TEXT_COLUMNS,
                           updateParams,
                           selectLists,
                           minMaxPrice,
                       }) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const theme = useTheme();

    const filterInParams = Object.keys(FILTER_PARAMS).some((key) => key in params);

    const appliedFiltersCount = Object.keys(FILTER_PARAMS).reduce(
        (count, key) => (key in params && params[key] ? count + 1 : count),
        0
    );

    const handleReset = () => {
        updateParams(null, null);
        setFiltersOpen(false);
    };

    return (
        <>
            <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={() => setFiltersOpen(true)}
                sx={{
                    borderRadius: "0.5rem",
                    textTransform: "none",
                    backgroundColor: theme.palette.background.paper,
                }}
                startIcon={<FilterAltIcon />}
            >
                {`Фільтри${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
            </Button>

            <Drawer anchor="left" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
                <Box sx={{ minWidth: "18rem", height: "100%", display: "flex", flexDirection: "column" }}>

                    {/* Контент с фильтрами */}
                    <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
                        <FiltersAccordion
                            params={params}
                            FILTER_PARAMS={FILTER_PARAMS}
                            TEXT_COLUMNS={TEXT_COLUMNS}
                            updateParams={updateParams}
                            selectLists={selectLists}
                            minMaxPrice={minMaxPrice}
                            mode="drawer"
                            closeDrawer={() => setFiltersOpen(false)}
                        />
                    </Box>
                </Box>
            </Drawer>
        </>
    );
}

export default FiltersDrawer;
