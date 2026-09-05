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

    // 3. Создаем временный контейнер для печати
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

    // 4. Стили для печатной страницы
    const style = document.createElement("style");
    style.id = "pure-print-styles";
    style.innerHTML = `
        @media print {
            @page { 
                margin: 10mm; 
                size: auto; 
            }
            html, body { 
                margin: 0; 
                padding: 0; 
                width: 100%; 
                background: #fff !important; 
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
                max-height: 95mm; 
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

    document.head.appendChild(style);
    document.body.appendChild(printContainer);

    // 5. ЖЕСТКОЕ СКРЫТИЕ ЧЕРЕЗ JS: Находим все элементы в body (включая #root вашего приложения)
    // и скрываем их напрямую через inline-стили, кроме нашего контейнера для печати
    const elementsToHide = Array.from(document.body.children).filter(
        child => child !== printContainer && child.tagName !== "SCRIPT" && child.tagName !== "STYLE"
    );

    const originalDisplays = elementsToHide.map(el => {
        const prevDisplay = el.style.display;
        el.style.setProperty("display", "none", "important"); // Прячем интерфейс сайта полностью
        return prevDisplay;
    });

    // 6. Небольшая задержка, чтобы мобильный браузер успел перерисовать DOM перед вызовом печати
    setTimeout(() => {
        window.print();

        // 7. Восстанавливаем всё обратно после того, как пользователь закроет окно печати
        setTimeout(() => {
            elementsToHide.forEach((el, index) => {
                el.style.display = originalDisplays[index];
            });
            style.remove();
            printContainer.remove();
        }, 1000);
    }, 150);
};
