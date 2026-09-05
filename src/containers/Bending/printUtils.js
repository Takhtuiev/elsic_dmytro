export const printBendProfile = (selector = ".fullscreen-print-area") => {
    const printElement = document.querySelector(selector);
    if (!printElement) return;

    const svg = printElement.querySelector("svg");
    if (!svg) return;

    const svgClone = svg.cloneNode(true);
    svgClone.removeAttribute("width");
    svgClone.removeAttribute("height");
    svgClone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const parameters = [
        ...printElement.querySelectorAll(":scope > .MuiStack-root")
    ]
        .map(stack => stack.innerText.trim())
        .filter(Boolean);

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

    const style = document.createElement("style");
    style.id = "pure-print-styles";
    style.innerHTML = `
        #pure-print-container {
            display: none;
        }

        @media print {
            @page {
                margin: 10mm;
                size: auto;
            }

            html,body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100%;
                background: #fff !important;
            }

            body {
                font-family: Roboto,Helvetica,Arial,sans-serif;
                color: #000;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            body > * {
                display: none !important;
            }

            body > #pure-print-container {
                display: block !important;
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

    setTimeout(() => {
        window.print();

        setTimeout(() => {
            style.remove();
            printContainer.remove();
        }, 1000);
    }, 150);
};