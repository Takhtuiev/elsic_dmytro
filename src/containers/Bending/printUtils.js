/**
 * Функция для печати чертежа профиля гибки и его параметров.
 * Временно подменяет текущий экран на печатный формат, обходя блокировки iframe и window.open на смартфонах.
 */
export const printBendProfile = (selector = ".fullscreen-print-area") => {
    const printElement = document.querySelector(selector);
    if (!printElement) return;

    const svg = printElement.querySelector("svg");
    if (!svg) return;

    // 1. Клонируем SVG и сбрасываем жесткие размеры
    const svgClone = svg.cloneNode(true);
    svgClone.removeAttribute("width");
    svgClone.removeAttribute("height");
    svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // 2. Собираем параметры
    const parameters = [
        ...printElement.querySelectorAll(":scope > .MuiStack-root")
    ]
        .map(stack => stack.innerText.trim())
        .filter(Boolean);

    // 3. Создаем временный элемент-контейнер для печати в текущем документе
    const printContainer = document.createElement("div");
    printContainer.id = "pure-print-root";
    printContainer.innerHTML = `
        <div class="print-page">
            <div class="print-title">Bend Profile (Geometric Drawing)</div>
            <div class="print-drawing">
                ${svgClone.outerHTML}
            </div>
            <div class="print-parameters">
                ${parameters.map(text => `
                    <div class="print-row">${text.replace(/\n/g, " ")}</div>
                `).join("")}
            </div>
        </div>
    `;

    // 4. Стили, которые заставят принтер видеть ТОЛЬКО чертеж и вернут ориентацию на ПК
    const style = document.createElement("style");
    style.id = "pure-print-styles";
    style.innerHTML = `
        /* Стили экрана (пока открыто окно печати) */
        #pure-print-root {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: #fff; z-index: 999999;
            padding: 10mm; overflow-y: auto;
            font-family: Roboto, Helvetica, Arial, sans-serif;
        }

        /* Жесткие стили ИМЕННО ДЛЯ ПРИНТЕРА */
        @media print {
            @page { 
                size: auto; /* Возвращает выбор ориентации (книжная/альбомная) на ПК */
                margin: 10mm; 
            }
            
            /* Скрываем весь основной сайт (React-приложение, кнопки, шапки) */
            body > *:not(#pure-print-root) {
                display: none !important;
            }

            #pure-print-root {
                position: static;
                padding: 0;
                width: 210mm; /* Ограничиваем ширину под книжный А4, чтобы на мобилках не ехало */
                max-width: 210mm;
            }

            body {
                background: #fff;
                color: #000;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .print-page {
                width: 100%;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            .print-title {
                margin: 0 0 5mm;
                font-size: 14pt;
                font-weight: bold;
                color: #333;
            }

            .print-drawing {
                width: 100%;
                margin: 0 0 6mm;
                text-align: center;
            }

            .print-drawing svg {
                display: block;
                width: 100%;
                height: auto;
                max-width: 100%;
                max-height: 150mm; /* Ограничение, чтобы параметры не улетели на вторую страницу */
                margin: 0 auto;
            }

            .print-parameters {
                width: 100%;
                font-size: 10pt;
                line-height: 1.4;
                margin-top: 5mm;
                border-top: 1px solid #eee;
                padding-top: 4mm;
            }

            .print-row {
                margin: 2mm 0;
                white-space: nowrap;
            }
        }
    `;

    // 5. Внедряем элементы в документ
    document.head.appendChild(style);
    document.body.appendChild(printContainer);

    // 6. Даем мобильному браузеру 100мс на отрисовку и вызываем печать основного окна
    setTimeout(() => {
        window.print();

        // 7. Функция очистки: возвращает интерфейс сайта обратно
        const cleanUp = () => {
            style.remove();
            printContainer.remove();
            window.removeEventListener("afterprint", cleanUp);
        };

        // Сработает сразу, как только пользователь закроет системную шторку печати
        window.addEventListener("afterprint", cleanUp);
    }, 100);
};
