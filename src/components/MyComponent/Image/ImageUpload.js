import { Box } from "@mui/material";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseOutlinedIcon from '@mui/icons-material/Close';
import { useState, useCallback } from "react";
import React from "react";
import ModalImage from "./ModalImage";
import MyImageBox from "./MyImageBox";
import { API_URL } from "../../../config";
import IconButtonWithTooltip from "./IconButtonWithTooltip";
import {convertImage} from "./UtilsImage";


const ImageUpload = ({ obj, setValue, lastUpdated }) => {
    const [openImage, setOpenImage] = useState(false);

    // URL изображения
    const urlImage = obj.value ? (obj.value.startsWith("blob:") ? obj.value : `${API_URL}/${obj.value}?ts=${lastUpdated}`) : "";

    // Открытие изображения в модалке
    const showImage = useCallback((src) => setOpenImage(src), []);
    const closeShowImage = useCallback(() => setOpenImage(false), []);

    // Удаление изображения
    const handleDeleteImage = useCallback(() => {
        setValue(null, obj.key, obj.indexVariant);
    }, [setValue, obj.key, obj.indexVariant]);

    // Загрузка изображения
    const handleUploadClick = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const compressedFile = await convertImage(file);
            setValue(URL.createObjectURL(compressedFile), obj.key, obj.indexVariant);
        } catch (error) {
            console.error("Ошибка сжатия изображения:", error);
        }
    };


    return (
        <>
            <Box sx={{ position: 'relative', height: '5rem', minWidth: '4rem', p: '0.2rem' }}>
                <MyImageBox url={urlImage} name={obj.name} onClick={() => showImage(urlImage)}/>

                <IconButtonWithTooltip
                    icon={<UploadFileIcon fontSize={obj.value ? "small" : "medium"} />}
                    onClick={() => document.getElementById("contained-button-file-" + obj.indexVariant).click() }
                    tooltipTitle={"Load image"}
                    color={"primary.main"}
                    sx={{
                        bottom: obj.value ? 0 : '50%',
                        right: obj.value ? 0 : '50%',
                        transform: obj.value ? 'none' : 'translate(50%, 50%)',
                    }}
                />

                {urlImage && (
                    <IconButtonWithTooltip
                        icon={<CloseOutlinedIcon fontSize="small" />}
                        onClick={()=>handleDeleteImage() }
                        tooltipTitle={"Delete image"}
                        color={"error.main"}
                        sx={{
                            top: 0,
                            right: 0,
                        }}
                    />
                )}
            </Box>

            {/* Модалка для изображения */}
            <ModalImage openImage={openImage} closeImageFunc={closeShowImage} optically={true} />

            {/* Скрытое поле для загрузки изображения */}
            <input
                id={"contained-button-file-" + obj.indexVariant}
                accept="image/*"
                style={{ display: 'none' }}
                type="file"
                onChange={handleUploadClick}
            />
        </>
    );
};

export default ImageUpload;
