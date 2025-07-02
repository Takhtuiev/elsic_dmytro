/**
 * Разбирает строку в формате "упаковка-объемl", например "bottle-0.5l"
 * @param {string} slug - строка с упаковкой и объемом
 * @returns {object|null} объект с { packaging: string, volume: number } или null если формат неверный
 */
export function parsePackagingVolume(slug) {
    // Регулярное выражение:
    // ^(.+)-([0-9.]+)l$
    // ^       - начало строки
    // (.+)    - захватывает упаковку (любые символы, минимум 1)
    // -       - дефис-разделитель
    // ([0-9.]+) - захватывает число (объем), допускаются цифры и точка
    // l       - буква "l" в конце
    // $       - конец строки
    const regex = /^(.+)-([0-9.]+)l$/;

    // Применяем регулярное выражение к входной строке
    const match = slug.match(regex);

    // Если не совпало, возвращаем null
    if (!match) {
        return null;
    }

    // Возвращаем объект с упаковкой и объемом (парсим объем в число)
    return {
        packaging: match[1],
        volume: parseFloat(match[2]),
    };
}

/**
 * Формирует строку из упаковки и объема в формате "упаковка-объемl"
 * @param {object} param0 - объект с полями packaging и volume
 * @param {string} param0.packaging - тип упаковки
 * @param {number} param0.volume - объем в литрах
 * @returns {string} строка формата "упаковка-объемl"
 */
export function buildPackagingVolume({ packaging, volume }) {
    return `${packaging}-${volume}l`;
}
