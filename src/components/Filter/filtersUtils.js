// filtersUtils.js

import ContentSlider from "./ContentSlider";
import ContentCheckBoxList from "./ContentCheckBoxList";

/**
 * Создает объект состояния для фильтра.
 */
export const createObj = (field, params, fieldType, listItem, minMaxPrice) => {

    const selectedArr = params[field]?.split(',');

    switch (fieldType) {
        case 'slider':
            return {
                value: selectedArr?.map(Number),
                range: minMaxPrice || [undefined, undefined]
            };
        case 'checkbox':
            if (!listItem) return {};
            return listItem.reduce((acc, item) => {
                acc[item] = selectedArr?.includes(String(item));
                return acc;
            }, {});
        default:
            return null;
    }
};

/**
 * Возвращает отображаемое значение выбранных фильтров.
 */
export const getSelectedCount = (field, obj, fieldType) => {
    if (!fieldType) return "";

    switch (fieldType) {
        case 'checkbox': {
            const selected = Object.values(obj).filter(Boolean).length;
            const total = Object.keys(obj).length;
            return `${selected}/${total}`;
        }

        case 'slider': {
            if (!obj?.value) return "";
            const [min, max] = obj?.value || [];
            const [rangeMin, rangeMax] = obj?.range || [];
            const isDefault = min === rangeMin && max === rangeMax;
            return !isDefault ? `${min} - ${max}` : "";
        }

        default:
            return "";
    }
};

/**
 * Обновляет параметры фильтра.
 */
export const updateObj = (newObj, field, fieldType, updateParams) => {
    let newValue;

    switch (fieldType) {
        case 'slider':
            newValue = newObj.join(',');
            break;
        case 'checkbox':
            newValue = Object.entries(newObj)
                .filter(([, value]) => value)
                .map(([key]) => key)
                .join(',');
            break;
        default:
            return;
    }

    updateParams(field, newValue);
};

/**
 * Генерирует JSX-содержимое для поля фильтра.
 */
export const renderFieldContent = (field, obj, fieldType, updateObjCallback) => {

    if (fieldType === 'slider') {
        return <ContentSlider field={field} obj={obj} updateObj={updateObjCallback} />;
    }

    if (fieldType === 'checkbox') {
        return <ContentCheckBoxList field={field} obj={obj} updateObj={updateObjCallback} />;
    }

    return null;
};
