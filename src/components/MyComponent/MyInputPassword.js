import {FormControl, FormHelperText, IconButton, InputAdornment, InputLabel, OutlinedInput} from "@mui/material";
import React, {useRef, useState} from "react";
import {ID_EL_START} from "../../CONSTANTS/Constants";
import {Visibility, VisibilityOff} from "@mui/icons-material";

function MyInputPassword({ obj, setValue, type="password", sx }) {
    const [passwordVisibility, setPasswordVisibility] = useState(false);
    const inputRef = useRef(null);

    const idElement = obj.indexVariant !== undefined
        ? `${ID_EL_START}${obj.field}${obj.key}-${obj.indexVariant}`
        : `${ID_EL_START}${obj.field}${obj.key}`;

    // Функция срабатывает при потере фокуса
    function onChange(event) {
        setValue(event.target.value, obj.key, obj.indexVariant);
    }

    return (
        <FormControl
            variant="outlined"
            sx={sx} size="small"
        >
            <InputLabel htmlFor={idElement}>{obj.label}</InputLabel>
            <OutlinedInput
                id={idElement}
                value={obj.value !== undefined ? obj.value : ''} // Используем defaultValue для начального значения
                onChange={setValue && onChange} // Сохраняем значение при потере фокуса
                label={obj.label}
                type={type}
                autoComplete={type}
                sx={sx || {}}
                inputRef={inputRef}
                endAdornment={
                    <InputAdornment position="end">
                        <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setPasswordVisibility(!passwordVisibility)}
                            onMouseDown={(event) => event.preventDefault()}
                            edge="end"
                        >
                            {passwordVisibility ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                    </InputAdornment>
                }
                error={obj.error !== undefined}
            />
            {obj.error && <FormHelperText error>{obj.error}</FormHelperText>}
        </FormControl>
    );
}

export default MyInputPassword;