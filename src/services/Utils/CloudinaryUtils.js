import {CLOUD_NAME} from "../../config";


/**
 * Получить полный URL изображения на Cloudinary по public_id
 * @param {string} publicId - public_id изображения, например "drinks/variant_1_2"
 * @param {string} format - формат файла, по умолчанию "webp"
 * @param {string} transformation - дополнительные трансформации, например "w_300,h_300,c_fill"
 * @returns {string} - полный URL изображения
 */
export function getCloudinaryUrl(publicId, format = "webp", transformation = "") {

    if(!publicId) { return null }

    const baseUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
    const transform = transformation ? `${transformation}/` : "";
    return `${baseUrl}/${transform}${publicId}.${format}`;
}