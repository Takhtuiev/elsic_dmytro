

export const uploadBlobFile = async (blobUrl, nameImg) => {
    if (blobUrl && blobUrl.startsWith('blob:')) {
        try {
            const res = await fetch(blobUrl);
            const blob = await res.blob();

            const mimeToExt = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif",
            };

            const ext = mimeToExt[blob.type] || "png"; // fallback: png
            const finalName = nameImg.endsWith(`.${ext}`) ? nameImg : `${nameImg}.${ext}`;

            return new File([blob], finalName, { type: blob.type });
        } catch (error) {
            console.error("Ошибка загрузки Blob-файла:", error);
            return null;
        }
    }
    return null;
};
