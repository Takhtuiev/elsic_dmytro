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
