import { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import {ID_EL_START} from "../../CONSTANTS/Constants";

function MyTextField({ obj, setValue, type, sx, sxInput, autoComplete, multiline }) {

    // Управляемое состояние для значения input
    const [inputValue, setInputValue] = useState(obj.value !== undefined && obj.value !== null ? (type === 'number' ? String(obj.value) : obj.value) : '');
    const [errorValue, setErrorValue] = useState(false);

    const idElement = obj.indexVariant !== undefined
        ? `${ID_EL_START}${obj.field}${obj.key}-${obj.indexVariant}`
        : `${ID_EL_START}${obj.field}${obj.key}`;

    useEffect(() => {
        if (obj.value !== inputValue) {
            setInputValue(obj.value !== undefined && obj.value !== null ? (type === 'number' ? String(obj.value) : obj.value) : ''); // Обновляем inputValue, если obj.value изменился
        }
    }, [obj.value]); // Зависимость от obj.value

    function onBlur(event) {
        if (type === 'number') {
            const newValue = parseFloat(event.target.value);
            if (newValue) setInputValue(String(newValue))
            if (newValue !== obj.value) {
                setValue(newValue, obj.key, obj.indexVariant);
            }
        } else {
            const newValue = event.target.value;
            if (newValue !== obj.value) {
                setValue(newValue, obj.key, obj.indexVariant);
            }
        }

    }

    function onChange(event) {
        const newValue = event.target.value;
        if (type === 'number') {
            const regex = /^[0-9]*[.]?[0-9]*$/;
            if (regex.test(newValue) || newValue === '') {
                setInputValue(newValue);
            } else {
                // Восстанавливаем курсор и выделение после изменения значения с использованием requestAnimationFrame
                const target = event.target;
                const lengthIns = newValue.length - inputValue.length
                const cursorPosition = { // Получаем текущую позицию курсора
                    start: target.selectionStart-lengthIns,
                    end: target.selectionEnd-lengthIns
                };
                requestAnimationFrame(() => {
                    target.setSelectionRange(cursorPosition.start, cursorPosition.end); // Восстанавливаем курсор
                });
            }
        } else {
            setInputValue(newValue);
        }


        if (errorValue && newValue) {
            setErrorValue(false);
        }
    }

    return (
        <TextField
            id={idElement}
            name={obj.key}
            type="text"  // Используем 'text', но контролируем ввод вручную для чисел
            value={inputValue} // Управляемое значение
            label={obj.label}
            sx={sx || {}}
            size={'small'}
            multiline={multiline}
            autoComplete={autoComplete || 'off'}
            onChange={onChange}
            onBlur={setValue && onBlur}
            variant="outlined"
            error={obj.error !== undefined || Boolean(errorValue)}
            helperText={obj.error || errorValue}
            slotProps={{
                htmlInput: {
                    sx: sxInput, // Стили для поля ввода
                }
            }}
        />
    );
}

export default MyTextField;

