export const printBendProfile = (selector = ".fullscreen-print-area") => {
    const printElement = document.querySelector(selector);
    if (!printElement) return;

    const svg = printElement.querySelector("svg");
    if (!svg) return;

    // 1. Клонируем SVG и очищаем фиксированные размеры
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

    // 3. Создаем временный контейнер для печати прямо в body основного документа
    const printContainer = document.createElement("div");
    printContainer.id = "pure-print-container";
    printContainer.innerHTML = `
        <div class="print-page">
            <div class="print-title">Bend Profile (Geometric Drawing)</div>
            <div class="print-drawing">${svgClone.outerHTML}</div>
            <div class="print-parameters">
                ${parameters.map(text => `
                    <div class="print-row">${text.replace(/\n/g, " ")}</div>
                `).join("")}
            </div>
        </div>
    `;

    // 4. Создаем динамические стили, которые СКРОЮТ весь сайт во время печати, кроме нашего контейнера
    const style = document.createElement("style");
    style.id = "pure-print-styles";
    style.innerHTML = `
        /* Эти стили сработают ТОЛЬКО в режиме печати/сохранения в PDF */
        @media print {
            /* Жестко скрываем абсолютно ВСЕ элементы на странице... */
            body > * {
                display: none !important;
            }
            /* ...кроме нашего специального контейнера для печати */
            body > #pure-print-container, 
            body > #pure-print-container * {
                display: block !important;
            }

            @page { 
                margin: 10mm; 
                size: auto; 
            }
            
            html, body { 
                margin: 0; 
                padding: 0; 
                width: 100%; 
                background: #fff; 
            }

            body {
                font-family: Roboto, Helvetica, Arial, sans-serif;
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
                margin: 0 0 4mm;
                font-size: 12pt;
                color: #555;
            }

            .print-drawing {
                width: 100%;
                margin: 0 0 4mm;
                text-align: center;
            }

            .print-drawing svg {
                display: block;
                width: 100%;
                height: auto;
                max-width: 100%;
                max-height: 95mm; /* Ограничение высоты, чтобы гарантированно влезло на 1 страницу в ландшафте */
                margin: 0 auto;
            }

            .print-parameters {
                width: 100%;
                font-size: 9pt;
            }

            .print-row {
                margin: 1mm 0;
                white-space: nowrap;
            }
        }
    `;

    // 5. Внедряем элементы в документ
    document.head.appendChild(style);
    document.body.appendChild(printContainer);

    // 6. Вызываем системное окно печати основного окна (теперь оно сработает корректно везде)
    window.print();

    // 7. Удаляем временные элементы из DOM после закрытия окна печати
    setTimeout(() => {
        style.remove();
        printContainer.remove();
    }, 1000);
};
