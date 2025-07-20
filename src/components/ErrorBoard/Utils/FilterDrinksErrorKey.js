
export function filterItemErrorKey(item, errorData) {

    if (!item) { // Если item === null, то возвращаем как есть
        return errorData
    }

    // Если errorData не объект (строка, число и т.д.) или это массив — возвращаем как есть
    if (typeof errorData !== 'object' || errorData === null || Array.isArray(errorData)) {
        return errorData;
    }

    // Получаем все ключи из объекта `item` и его `variants`
    const allKeys = Object.keys(item).flatMap(key =>
        key === 'variants'
            ? item[key].flatMap((variant, index) =>
                Object.keys(variant).map(variantKey => `${index}-${variantKey}`)
            )
            : [key]
    );

    // Фильтруем ключи из `errorData`, оставляя только те, которых нет в `allKeys`
    return Array.isArray(errorData)
        ? errorData.filter(([key, value]) => !allKeys.includes(key))
        : Object.entries(errorData).reduce((acc, [key, value]) => {
            if (!allKeys.includes(key)) {
                acc[key] = value;
            }
            return acc;
        }, {});
}
