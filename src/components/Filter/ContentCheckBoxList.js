import {Checkbox, FormControlLabel, FormGroup, Typography} from "@mui/material";
import React from "react";
import {ID_EL_START} from "../../CONSTANTS/Constants";

const ContentCheckBoxList = ({ field, obj, updateObj }) => {

    const handleItemChange = (event) => {
        const value = event.target.value;
        obj[value] = event.target.checked;
        updateObj(obj,field);
    };

    return (
        <FormGroup>
            {Object.keys(obj).map((item, index) => (
                <FormControlLabel
                    key={index}
                    control={
                        <Checkbox
                            id={`${ID_EL_START}${field}-${item}-checkBox`}
                            checked={obj[item] ?? false}
                            onChange={handleItemChange}
                            size="small"
                            value={item}
                        />
                    }
                    label={<Typography variant="body2" py={0.5}>{item}</Typography>}
                    sx={{
                        width: '100%',
                        m: 0,
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.08)',
                            cursor: 'pointer',
                        }
                    }}
                />
            ))}
        </FormGroup>
    )
}

export default ContentCheckBoxList;

