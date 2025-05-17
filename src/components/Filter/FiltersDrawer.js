import {Button, Drawer, Typography} from "@mui/material";
import {Box} from "@mui/system";
import MenuItem from "@mui/material/MenuItem";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";
import React from "react";
import {useState} from "react";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import FiltersAccordion from "./FiltersAccordion";
import Grid from "@mui/material/Grid2";

function FiltersDrawer({ params, FILTER_PARAMS, TEXT_COLUMNS, updateParams, selectLists }) {

    const [filtersOpen, setFiltersOpen] = useState(false); // Добавлено состояние для отслеживания видимости SortBar

    const filterInParams = Object.keys(FILTER_PARAMS).some(key => key in params)

    const appliedFiltersCount = Object.keys(FILTER_PARAMS).reduce((count, key) => {
        return key in params && params[key] ? count + 1 : count;
    }, 0);

    return (
        <>
            <Grid container alignItems={"center"} spacing={1}>
                <Grid>
                    <Button
                        variant="outlined"
                        color={'info'}
                        size="small"
                        onClick={()=>setFiltersOpen(true)}
                        sx={{
                            borderRadius: '0.5rem', // Закругляем углы для овальной формы
                            textTransform: 'none', // Сохраняем регистр текста кнопки
                            backgroundColor: theme => theme.palette.background.paper,
                        }}
                        startIcon={<FilterAltIcon />}
                    >
                        {`Фільтри${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ''}`}
                    </Button>
                </Grid>
            </Grid>

            <Drawer
                anchor="left"
                open={filtersOpen}
                onClose={()=>setFiltersOpen(false)}
                variant="temporary"
            >
                <Grid container direction={'column'} sx={{ minWidth: '18rem', height: '100%', flexWrap: 'nowrap' }}>
                    <Grid container sx={{flexWrap: 'nowrap'}}>
                        <MenuItem
                            onClick={()=>setFiltersOpen(false)}
                            sx={{
                                p: 1,
                                color: 'primary.main',
                                width: '100%',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <ChevronLeftIcon sx={{ marginRight: '0.5rem' }} />
                                <Typography variant={'h6'}>
                                    Фільтри
                                </Typography>
                            </Box>
                        </MenuItem>
                        { filterInParams && ( // Если фильтры не пустые...
                            <Button
                                variant="outlined"
                                size={'small'}
                                color="error"
                                onClick={()=>{
                                    updateParams(null,null);
                                    setFiltersOpen(false);
                                }}
                                sx={{
                                    my: 'auto',
                                    mr: '1rem',
                                    px: '1rem',
                                    borderRadius: '1rem', // Закругляем углы для овальной формы
                                    color: 'error.main',
                                }}
                                endIcon={<CloseIcon fontSize="small" color={'error'} />} // Иконка крестика
                            >
                                Reset
                            </Button>
                        )}

                    </Grid>
                    <Grid sx={{ flexGrow: 1, overflowY: 'auto' }}>
                        <FiltersAccordion
                            params={params}
                            FILTER_PARAMS={FILTER_PARAMS}
                            TEXT_COLUMNS={TEXT_COLUMNS}
                            updateParams={updateParams}
                            selectLists={selectLists}
                            mode={'drawer'}
                            closeDrawer={()=>setFiltersOpen(false)}
                        />
                    </Grid>
                    <Grid p={1}>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            onClick={()=>setFiltersOpen(false)}
                        >
                            Показати
                        </Button>
                    </Grid>
                </Grid>
            </Drawer>
        </>
    )
}

export default FiltersDrawer;
