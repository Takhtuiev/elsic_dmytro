import {FONT_WATERMARK, UPLOAD_IMAGE, WATERMARK} from "../../../CONSTANTS/Constants";


// Сжатие изображения и добавление водяного знака (если нужно)
export const convertImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function () {
                let newWidth = img.width;
                let newHeight = img.height;

                // Масштабируем изображение, если нужно
                if (newWidth > UPLOAD_IMAGE.maxWidth) {
                    newHeight *= UPLOAD_IMAGE.maxWidth / newWidth;
                    newWidth = UPLOAD_IMAGE.maxWidth;
                }
                if (newHeight > UPLOAD_IMAGE.maxHeight) {
                    newWidth *= UPLOAD_IMAGE.maxHeight / newHeight;
                    newHeight = UPLOAD_IMAGE.maxHeight;
                }

                // Рисуем изображение на канвасе
                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                // Добавляем водяной знак, если нужно
                if (WATERMARK) {
                    let fontSize = Math.floor(newWidth / WATERMARK.length / 0.6);
                    ctx.font = `${fontSize}px ${FONT_WATERMARK}`;
                    ctx.fillStyle = 'rgba(140,75,0,0.3)';
                    ctx.fillText(WATERMARK, (newWidth - ctx.measureText(WATERMARK).width) / 2, newHeight * 0.9);
                }

                // Преобразуем канвас в Blob и возвращаем как файл
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error("Ошибка при сжатии изображения"));
                    }
                }, 'image/png');
            };
        };
        reader.onerror = function () {
            reject(new Error("Ошибка загрузки файла"));
        };
    });
};
