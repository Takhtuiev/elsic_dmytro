import {IconButton, Modal } from "@mui/material";
import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import {Box, useTheme} from "@mui/system";


// отображает изображение на весь экран
const ModalImage = ({openImage, closeImageFunc, optically}) => {
    const theme = useTheme(); // Access the theme

    return (
        <Modal
            open={!!openImage}
            onClose={closeImageFunc}
            closeAfterTransition
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Box
                elevation={3}
                sx={{
                    position: "relative",
                    background: optically ? "rgba(255, 255, 255, 0.3)" : theme.palette.background.paper,
                    outline: "none", // Убираем рамку при фокусе
                    border: `1px solid ${theme.palette.divider}`,
                    display: "flex", // Делаем flex-контейнером
                    alignItems: "center", // Центрируем содержимое по вертикали
                    justifyContent: "center", // Центрируем по горизонтали
                }}            >
                <IconButton
                    onClick={closeImageFunc}
                    sx={{
                        position: "absolute",
                        top: 5,
                        right: 5,
                        zIndex: 1,
                        backgroundColor: "rgba(255, 255, 255, 0.3)",
                    }}
                >
                    <CloseIcon />
                </IconButton>
                <img
                    src={openImage}
                    alt="viewer"
                    style={{
                        maxHeight: "99vh", // Ограничиваем высоту экраном
                        maxWidth: "99vw",  // Ограничиваем ширину экраном
                        objectFit: "contain", // Гарантирует, что изображение полностью помещается
                    }}
                />
            </Box>
        </Modal>
    )
};

export default ModalImage;
