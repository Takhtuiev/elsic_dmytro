import {Rating, TextField} from "@mui/material";
import React from "react";

const MyRating = ({ obj, setValue, sx }) => {

//    console.log(obj.key)

    const value = obj.value || 0;

    const onChange = (event) => {
        const newValue = event.target.value;
        setValue(!isNaN(parseFloat(newValue)) ? parseFloat(newValue) : 0, obj.key, obj.indexVariant);
    };

    return (

        <TextField
            name={obj.key}
            type="number"
            label={<Rating
                size={'small'}
                readOnly
                precision={0.5}
                value={value !== undefined ? value : 0}
            />}
            size={'small'}
            value={value !== undefined ? value : 0}
            onChange={onChange}
            variant="outlined"
            inputProps={{
                min: 0,
                max: 5,
                step: 0.5,
            }}
            sx={sx}
            error={ obj.error !== undefined }
            helperText={ obj.error }
        />
    );
};

export default React.memo(MyRating, (prevProps, nextProps) => {
    // Не перерисовывать, если не изменилось значение obj.value
    return (
        prevProps.obj.value === nextProps.obj.value &&
        prevProps.obj.error === nextProps.obj.error
    );
});