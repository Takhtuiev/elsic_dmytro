import { jsPDF } from "jspdf";

/**
 * Функция для идеальной печати чертежа профиля гибки и его параметров.
 * Генерирует изолированный PDF в памяти, что решает проблемы адаптивности и баги мобильных браузеров.
 *
 * @param {string} selector - Класс контейнера, в котором лежит SVG и параметры
 */
export const printBendProfile = (selector = ".fullscreen-print-area") => {
    const printElement = document.querySelector(selector);
    if (!printElement) return;

    const svg = printElement.querySelector("svg");
    if (!svg) return;

    // Считываем параметры (.MuiStack-root)
    const parameters = [
        ...printElement.querySelectorAll(":scope > .MuiStack-root")
    ]
        .map(stack => stack.innerText.trim())
        .filter(Boolean);

    // 1. Создаем PDF в книжной ориентации ('p' - portrait) формата A4
    const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();   // ~210 мм
    const pageHeight = doc.internal.pageSize.getHeight(); // ~297 мм

    // Добавляем заголовок документа
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(85, 85, 85);
    doc.text("Bend Profile (Geometric Drawing)", 15, 15);

    // Конвертируем SVG в строку и Blob-ссылку для рендеринга на Canvas
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.src = blobURL;

    image.onload = () => {
        const canvas = document.createElement("canvas");

        // Получаем исходные пропорции из viewBox или текущих размеров SVG
        const svgWidth = svg.viewBox.baseVal.width || svg.clientWidth || 800;
        const svgHeight = svg.viewBox.baseVal.height || svg.clientHeight || 600;
        const aspectRatio = svgWidth / svgHeight;

        // Задаем повышенное разрешение Canvas для максимальной четкости линий
        canvas.width = svgWidth * 2;
        canvas.height = svgHeight * 2;

        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const imgData = canvas.toDataURL("image/png");

        // Расчет размеров чертежа с ЖЕСТКИМ СОХРАНЕНИЕМ ПРОПОРЦИЙ под А4
        const maxWidth = pageWidth - 30;  // Доступная ширина (180 мм)
        const maxHeight = 160;            // Предельная высота под чертеж (160 мм)

        let printWidth = maxWidth;
        let printHeight = printWidth / aspectRatio;

        // Если по высоте чертеж превышает лимит, масштабируем относительно высоты
        if (printHeight > maxHeight) {
            printHeight = maxHeight;
            printWidth = printHeight * aspectRatio;
        }

        // Центрируем чертеж по горизонтали на листе
        const startX = 15 + (maxWidth - printWidth) / 2;
        const startY = 25; // Отступ сверху от заголовка

        // Вставляем чертеж в PDF
        doc.addImage(imgData, "PNG", startX, startY, printWidth, printHeight);

        // 2. Добавляем параметры (динамический расчет Y, чтобы текст шел строго под чертежом)
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        let currentY = startY + printHeight + 12; // Отступ 12 мм вниз от чертежа

        parameters.forEach(text => {
            // Проверяем, чтобы текст не вылезал за нижнюю границу листа
            if (currentY < pageHeight - 15) {
                doc.text(text.replace(/\n/g, " "), 15, currentY);
                currentY += 6; // Шаг строки
            }
        });

        // 3. Переводим готовый PDF в Blob URL для отправки в iframe
        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // 4. Создаем скрытый полноразмерный iframe
        const printIframe = document.createElement("iframe");
        Object.assign(printIframe.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            border: "0",
            opacity: "0",
            visibility: "hidden",
            pointerEvents: "none"
        });

        printIframe.src = pdfUrl;
        document.body.appendChild(printIframe);

        printIframe.onload = () => {
            // ИСПРАВЛЕНИЕ: Удаляем фрейм ТОЛЬКО после реального закрытия или отмены печати пользователем.
            // Теперь при смене параметров (размер бумаги, копия, ориентация) окно не будет захлопываться.
            printIframe.contentWindow.addEventListener("afterprint", () => {
                printIframe.remove();
                URL.revokeObjectURL(pdfUrl);
            });

            // Запускаем диалог печати
            setTimeout(() => {
                printIframe.contentWindow.focus();
                printIframe.contentWindow.print();
            }, 300);
        };

        // Освобождаем память от Blob картинки SVG
        URL.revokeObjectURL(blobURL);
    };
};
