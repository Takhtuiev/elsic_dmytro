import React, {useCallback} from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
    createObj,
    getSelectedCount,
    renderFieldContent,
    updateObj
} from "./filtersUtils";

const FiltersColumn = ({
                              params,
                              updateParams,
                              FILTER_PARAMS,
                              TEXT_COLUMNS,
                              selectLists,
                              minMaxPrice
                          }) => {

    const updateObjCallback = useCallback((newObj, field) => {
        updateObj(newObj, field, FILTER_PARAMS[field], updateParams);
    }, [updateParams, FILTER_PARAMS]);

    const renderField = (field, index) => {
        const obj = createObj(field, params, FILTER_PARAMS[field], selectLists?.[field], minMaxPrice);

        return (
            <Accordion key={index} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                        {TEXT_COLUMNS[field]}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                        {getSelectedCount(field, obj, FILTER_PARAMS[field])}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, maxHeight: '12rem', overflowY: 'auto' }}>
                    {renderFieldContent(field, obj, FILTER_PARAMS[field], updateObjCallback)}
                </AccordionDetails>
            </Accordion>
        );
    };

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {Object.keys(FILTER_PARAMS).map(renderField)}
        </Box>
    );
};

export default React.memo(FiltersColumn);