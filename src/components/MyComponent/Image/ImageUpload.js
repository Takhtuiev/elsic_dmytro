import { Box } from "@mui/material";
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseOutlinedIcon from '@mui/icons-material/Close';
import { useState, useCallback } from "react";
import React from "react";
import ModalImage from "./ModalImage";
import MyImageBox from "./MyImageBox";
import IconButtonWithTooltip from "./IconButtonWithTooltip";
import { convertImage } from "./UtilsImage";
import { getCloudinaryUrl } from "../../../services/Utils/CloudinaryUtils";

const ImageUpload = ({ obj, setValue }) => {
    const [openImage, setOpenImage] = useState(false);

    const urlImage = obj.value
        ? (obj.value.startsWith("blob:") ? obj.value : getCloudinaryUrl(obj.value))
        : "";

    const showImage = useCallback((src) => setOpenImage(src), []);
    const closeShowImage = useCallback(() => setOpenImage(false), []);

    const handleDeleteImage = useCallback(() => {
        setValue(null, obj.key, obj.indexVariant);
    }, [setValue, obj.key, obj.indexVariant]);

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
            <Box
                sx={{
                    position: 'relative',
                    width: '5rem',
                    height: '5rem',
                    p: '0.2rem',
                    flexShrink: 0,
                }}
            >
                <MyImageBox
                    url={urlImage}
                    name={obj.name}
                    onClick={() => showImage(urlImage)}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        cursor: 'pointer'
                    }}
                />

                <IconButtonWithTooltip
                    icon={<UploadFileIcon fontSize={obj.value ? "small" : "medium"} />}
                    onClick={() =>
                        document.getElementById("contained-button-file-" + obj.indexVariant).click()
                    }
                    tooltipTitle={"Load image"}
                    color={"primary.main"}
                    sx={{
                        position: 'absolute',
                        bottom: obj.value ? 0 : '50%',
                        right: obj.value ? 0 : '50%',
                        transform: obj.value ? 'none' : 'translate(50%, 50%)',
                    }}
                />

                {urlImage && (
                    <IconButtonWithTooltip
                        icon={<CloseOutlinedIcon fontSize="small" />}
                        onClick={handleDeleteImage}
                        tooltipTitle={"Delete image"}
                        color={"error.main"}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                        }}
                    />
                )}
            </Box>

            <ModalImage openImage={openImage} closeImageFunc={closeShowImage} optically={true} />

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
