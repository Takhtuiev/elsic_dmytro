import {Checkbox, FormControlLabel, FormGroup, Typography} from "@mui/material";
import React from "react";
import {ID_EL_START} from "../../CONSTANTS/Constants";
import {Skeleton} from "@mui/lab";

const ContentCheckBoxList = ({ field, obj, updateObj }) => {

    const handleItemChange = (event) => {
        const value = event.target.value;
        obj[value] = event.target.checked;
        updateObj(obj,field);
    };

    // Если obj нет или он пустой — показываем скелетоны
    if (!obj || Object.keys(obj).length === 0) {
        // Отобразим 4 скелетона чекбоксов
        return (
            <FormGroup>
                {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton
                        key={idx}
                        variant="rectangular"
                        height={"1.5rem"}
                        width={"70%"}
                        sx={{ m: 1, borderRadius: 1 }}
                    />
                ))}
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

