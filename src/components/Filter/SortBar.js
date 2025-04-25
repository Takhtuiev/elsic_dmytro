import {FormControl, InputLabel, Select} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import {ID_EL_START} from "../../CONSTANTS/Constants";

function SortBar({ sortList, sortValue, updateSort, sx }) {

    const onChange = (event) => {
        updateSort(event.target.value)
    };

    const selectId = `${ID_EL_START}sortBox`;

    return (
        <FormControl sx={sx} size="small">
            <InputLabel htmlFor={selectId}>
                сортування
            </InputLabel>
            <Select
                value={sortValue || ''}
                size={'small'}
                onChange={onChange}
                label={'сортування'}
                variant="outlined"
                sx={{
                    backgroundColor: theme => theme.palette.background.paper,
                }}
                inputProps={{
                    id: selectId,
                }}
            >
                {sortList?.map((value, index) => (
                    <MenuItem
                        key={index}
                        value={value}
                        sx={{
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            },
                        }}
                    >
                        {value}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}

export default SortBar;
