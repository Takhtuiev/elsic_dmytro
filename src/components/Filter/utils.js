// utils.js

export const updateSearchParams = (params, updatedKey, newValue, setSearchParams, HEAD_PARAMS, FILTER_PARAMS) => {
    // Создание нового объекта параметров
    const newParams = { ...params };

    // сбрасываем пагинацию
    if (updatedKey !== 'page' && newParams['page']) {
        delete newParams['page'];
    }

    // сбрасываем фильтр по цене, если дугой активируем фильтр
    if (updatedKey !== 'price' && Object.keys(FILTER_PARAMS).includes(updatedKey)) {
        delete newParams['price'];
    }


    if (updatedKey in params) {
        if (newValue) {
            // Обновление существующего параметра
            newParams[updatedKey] = newValue;
        } else {
            // Удаление параметра, если значение пустое
            delete newParams[updatedKey];
        }
    } else if (newValue) {
        // Если параметр не существует, добавляем его
        newParams[updatedKey] = newValue;
    }

    // Сортировка параметров по ключам HEAD_PARAMS и FILTER_PARAMS
    const sortedParams = Object.keys(HEAD_PARAMS)
        .filter((key) => key in newParams)
        .reduce((acc, key) => {
            acc[key] = newParams[key];
            return acc;
        }, {});

    if (updatedKey) {
        Object.keys(FILTER_PARAMS)
            .filter((key) => key in newParams)
            .forEach((key) => {
                sortedParams[key] = newParams[key];
            });
    }

    // Установка новых параметров
    setSearchParams(sortedParams);
};

// Создание объекта один раз
const createObj = (field, FILTER_PARAMS, selectLists, params, minMaxPrice) => {
    const selectedArr = params[field]?.split(','); // Преобразуем строку в массив

    switch (FILTER_PARAMS[field]) {
        case 'slider':
            return {
                value: selectedArr?.map(Number), // Преобразуем строковые значения в числа
                range: minMaxPrice || [undefined, undefined] // Минимум и максимум для слайдера
            };
        case 'checkbox':
            if (!selectLists) return {}; // Если нет selectLists, возвращаем пустой объект
            return selectLists[field].reduce((acc, item) => {
                acc[item] = selectedArr?.includes(String(item)); // Отмечаем, выбран ли элемент
                return acc;
            }, {});
        default:
            return null; // Если тип не найден, возвращаем null
    }
};

// Получаем выбранное количество из obj
const getSelectedCount = (field, obj, FILTER_PARAMS, params) => {
    if (!FILTER_PARAMS[field]) return "";

    switch (FILTER_PARAMS[field]) {
        case 'checkbox':
            const total = Object.keys(obj).length;
            const selected = Object.values(obj).filter(Boolean).length;
            return `${selected}/${total}`;
        case 'slider': {
            const [min, max] = obj.value || [undefined, undefined];
            return params[field] !== obj[field] ? `${min} - ${max}` : "";
        }
        default:
            return "";
    }
};

// Обновление параметров
const updateObj = (newObj, field, FILTER_PARAMS, updateParams) => {
    let newValue = [];

    switch (FILTER_PARAMS[field]) {
        case 'slider':
            newValue = newObj.join(',');
            break;
        case 'checkbox':
            newValue = Object.entries(newObj)
                .filter(([key, value]) => value) // Фильтруем только те пары, где value === true
                .map(([key]) => key).join(','); // Извлекаем ключи
            break;
        default:
            return null;
    }

    updateParams(field, newValue);
};