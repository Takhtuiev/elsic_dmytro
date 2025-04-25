

export const uploadBlobFile = async (blobUrl, nameImg) => {
    if (blobUrl && blobUrl.startsWith('blob:')) {
        try {
            const res = await fetch(blobUrl);
            const blob = await res.blob();
            return new File([blob], nameImg, { type: 'image/png' });
        } catch (error) {
            console.error("Ошибка загрузки Blob-файла:", error);
            return null;
        }
    }
    return null;
};
