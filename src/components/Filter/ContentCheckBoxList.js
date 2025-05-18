import {Checkbox, FormControlLabel, FormGroup, Typography, Skeleton} from "@mui/material";
import React from "react";
import {ID_EL_START} from "../../CONSTANTS/Constants";

const ContentCheckBoxList = ({ field, obj, updateObj }) => {

    const handleItemChange = (event) => {
        const value = event.target.value;
        obj[value] = event.target.checked;
        updateObj(obj,field);
    };

    // Если obj нет или он пустой — показываем скелетоны
    if (!obj || Object.keys(obj).length === 0) {
        return (
            <FormGroup>
                {Array.from({ length: 4 }).map((_, idx) => {
                    const randomWidth = `${Math.floor(40 + Math.random() * 50)}%`; // от 40% до 90%
                    return (
                        <Skeleton
                            key={idx}
                            variant="rectangular"
                            height={"1.5rem"}
                            width={randomWidth}
                            sx={{ m: 1, borderRadius: 1 }}
                        />
                    );
                })}
            </FormGroup>
        );
    }

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

