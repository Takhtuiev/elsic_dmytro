import React, { useState } from "react";

import {
    Box,
    Button,
    IconButton,
    Paper,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import BendingProfilePreview
    from "./BendingProfilePreview";


// =====================================================
// Настройки
// =====================================================

const SHELF_FIELD_WIDTH = "16ch";
const ANGLE_FIELD_WIDTH = "12ch";

const FIELD_COLUMN_WIDTH = "16ch";

const SHELF_LABEL = "Полка";
const ANGLE_LABEL = "Угол";


// =====================================================
// Component
// =====================================================

function BendingProfileInput() {

    const [
        profile,
        setProfile,
    ] = useState({

        shelves: [

            {
                length: "",
                side: "right",
            },

            {
                length: "",
                side: "right",
            },
        ],

        bends: [

            {
                angle: "",
                direction: "right",
            },
        ],
    });


    // =================================================
    // Какая полка должна быть вертикальной
    // Нумерация начинается с 1
    // =================================================

    const [
        verticalShelf,
        setVerticalShelf,
    ] = useState(1);


    // =================================================
    // Изменение длины полки
    // =================================================

    const handleShelfChange = (
        index,
        value
    ) => {

        setProfile(
            (prev) => ({

                ...prev,

                shelves:
                    prev.shelves.map(
                        (
                            shelf,
                            i
                        ) =>
                            i === index
                                ? {
                                    ...shelf,
                                    length: value,
                                }
                                : shelf
                    ),
            })
        );
    };


    // =================================================
    // Изменение направления размера полки
    // =================================================

    const handleShelfSideChange = (
        index,
        side
    ) => {

        if (side === null) {
            return;
        }


        setProfile(
            (prev) => ({

                ...prev,

                shelves:
                    prev.shelves.map(
                        (
                            shelf,
                            i
                        ) =>
                            i === index
                                ? {
                                    ...shelf,
                                    side,
                                }
                                : shelf
                    ),
            })
        );
    };


    // =================================================
    // Выбор вертикальной полки
    // =================================================

    const handleVerticalShelfChange = (
        index
    ) => {

        setVerticalShelf(
            index + 1
        );
    };


    // =================================================
    // Изменение угла
    // =================================================

    const handleBendChange = (
        index,
        value
    ) => {

        setProfile(
            (prev) => ({

                ...prev,

                bends:
                    prev.bends.map(
                        (
                            bend,
                            i
                        ) =>
                            i === index
                                ? {
                                    ...bend,
                                    angle: value,
                                }
                                : bend
                    ),
            })
        );
    };


    // =================================================
    // Изменение направления гибки
    // =================================================

    const handleBendDirectionChange = (
        index,
        direction
    ) => {

        if (direction === null) {
            return;
        }


        setProfile(
            (prev) => ({

                ...prev,

                bends:
                    prev.bends.map(
                        (
                            bend,
                            i
                        ) =>
                            i === index
                                ? {
                                    ...bend,
                                    direction,
                                }
                                : bend
                    ),
            })
        );
    };


    // =================================================
    // Добавить гибку
    // =================================================

    const addBend = () => {

        setProfile(
            (prev) => ({

                shelves: [

                    ...prev.shelves,

                    {
                        length: "",
                        side: "right",
                    },
                ],

                bends: [

                    ...prev.bends,

                    {
                        angle: "",
                        direction: "right",
                    },
                ],
            })
        );
    };


    // =================================================
    // Удалить гибку
    // =================================================

    const removeBend = (
        index
    ) => {

        if (
            profile.bends.length <= 1
        ) {
            return;
        }


        setProfile(
            (prev) => ({

                shelves:
                    prev.shelves.filter(
                        (_, i) =>
                            i !== index + 1
                    ),

                bends:
                    prev.bends.filter(
                        (_, i) =>
                            i !== index
                    ),
            })
        );


        // =============================================
        // Корректируем выбранную вертикальную полку
        // =============================================

        const removedShelf =
            index + 2;


        if (
            verticalShelf ===
            removedShelf
        ) {

            setVerticalShelf(
                Math.max(
                    1,
                    verticalShelf - 1
                )
            );

        } else if (
            verticalShelf >
            removedShelf
        ) {

            setVerticalShelf(
                verticalShelf - 1
            );
        }
    };


    // =================================================
    // Сетка строки
    // =================================================

    const rowGrid = {

        display: "grid",

        gridTemplateColumns: `
${FIELD_COLUMN_WIDTH}
3ch
max-content
max-content
max-content
    `,

        alignItems: "center",

        columnGap: 1,

        width: "max-content",

        maxWidth: "100%",
    };


    // =================================================
    // Получение числовых данных
    // =================================================

    const getNumericProfile = () => {

        return {

            shelves:
                profile.shelves.map(
                    (shelf) => ({

                        ...shelf,

                        length:
                            shelf.length === ""
                                ? null
                                : Number(
                                    shelf.length
                                ),
                    })
                ),

            bends:
                profile.bends.map(
                    (bend) => ({

                        ...bend,

                        angle:
                            bend.angle === ""
                                ? null
                                : Number(
                                    bend.angle
                                ),
                    })
                ),
        };
    };


    // =================================================
    // Render
    // =================================================

    return (

        <Box
            sx={{
                display: "flex",

                gap: 3,

                alignItems: "flex-start",

                width: "100%",

                flexWrap: "wrap",
            }}
        >

            {/* ================================================= */}
            {/* Левая часть — ввод данных */}
            {/* ================================================= */}

            <Paper
                elevation={2}
                sx={{
                    p: 3,

                    width: "fit-content",

                    maxWidth: "100%",

                    flexShrink: 0,

                    boxSizing: "border-box",
                }}
            >

                <Typography
                    variant="h6"
                    sx={{
                        mb: 3,
                    }}
                >
                    Профиль детали
                </Typography>


                <Stack spacing={2}>

                    {/* ================================================= */}
                    {/* Полки + углы */}
                    {/* ================================================= */}

                    {profile.bends.map(
                        (
                            bend,
                            index
                        ) => (

                            <React.Fragment
                                key={index}
                            >

                                {/* ===================================== */}
                                {/* Полка */}
                                {/* ===================================== */}

                                <Box
                                    sx={
                                        rowGrid
                                    }
                                >

                                    <TextField
                                        label={`${SHELF_LABEL} ${index + 1}`}
                                        type="number"
                                        value={
                                            profile
                                                .shelves[
                                                index
                                                ].length
                                        }
                                        size="small"
                                        sx={{
                                            width:
                                            SHELF_FIELD_WIDTH,
                                        }}
                                        onChange={(
                                            e
                                        ) =>
                                            handleShelfChange(
                                                index,
                                                e
                                                    .target
                                                    .value
                                            )
                                        }
                                        slotProps={{
                                            htmlInput:
                                                {
                                                    min: 0,
                                                    step: 0.01,
                                                },
                                        }}
                                    />


                                    {/* Единица */}

                                    <Typography
                                        color="
                                            text.secondary
                                        "
                                        sx={{
                                            textAlign:
                                                "center",
                                        }}
                                    >
                                        мм
                                    </Typography>


                                    {/* Направление размера */}

                                    <ToggleButtonGroup
                                        exclusive
                                        size="small"
                                        value={
                                            profile
                                                .shelves[index].side
                                        }
                                        onChange={(
                                            e,
                                            value
                                        ) =>
                                            handleShelfSideChange(
                                                index,
                                                value
                                            )
                                        }
                                    >

                                        <ToggleButton
                                            value="left"
                                        >
                                            ←
                                        </ToggleButton>

                                        <ToggleButton
                                            value="right"
                                        >
                                            →
                                        </ToggleButton>

                                    </ToggleButtonGroup>


                                    {/* ================================= */}
                                    {/* Выбор вертикальной полки */}
                                    {/* ================================= */}

                                    <IconButton
                                        size="small"
                                        color={
                                            verticalShelf === index + 1
                                                ? "primary"
                                                : "default"
                                        }
                                        onClick={() =>
                                            handleVerticalShelfChange(index)
                                        }
                                        title="Сделать полку вертикальной"
                                        sx={{
                                            borderRadius: "4px",

                                            border:
                                                verticalShelf === index + 1
                                                    ? "1px solid"
                                                    : "1px solid transparent",
                                        }}
                                    >

                                        <span
                                            style={{
                                                fontSize: "20px",
                                                lineHeight: 1,
                                            }}
                                        >
                                            ↕

                                        </span>
                                    </IconButton>

                                    {/* Место под кнопку удаления */}

                                    <Box />

                                </Box>


                                {/* ===================================== */}
                                {/* Угол */}
                                {/* ===================================== */}

                                <Box
                                    sx={
                                        rowGrid
                                    }
                                >

                                    <TextField
                                        label={`${ANGLE_LABEL} ${index + 1}`}
                                        type="number"
                                        value={
                                            bend.angle
                                        }
                                        size="small"
                                        sx={{
                                            width:
                                            ANGLE_FIELD_WIDTH,

                                            justifySelf:
                                                "end",
                                        }}
                                        onChange={(
                                            e
                                        ) =>
                                            handleBendChange(
                                                index,
                                                e
                                                    .target
                                                    .value
                                            )
                                        }
                                        slotProps={{
                                            htmlInput:
                                                {
                                                    min: 0,
                                                    max: 180,
                                                    step: 0.01,
                                                },
                                        }}
                                    />


                                    {/* Единица */}

                                    <Typography
                                        color="
                                            text.secondary
                                        "
                                        sx={{
                                            textAlign:
                                                "center",
                                        }}
                                    >
                                        °
                                    </Typography>


                                    {/* Направление гибки */}

                                    <ToggleButtonGroup
                                        exclusive
                                        size="small"
                                        value={
                                            bend.direction
                                        }
                                        onChange={(
                                            e,
                                            value
                                        ) =>
                                            handleBendDirectionChange(
                                                index,
                                                value
                                            )
                                        }
                                    >

                                        <ToggleButton
                                            value="right"
                                        >

                                            <span
                                                style={{
                                                    display:
                                                        "inline-block",

                                                    transform:
                                                        "rotate(180deg)",
                                                }}
                                            >
                                                ↷
                                            </span>

                                        </ToggleButton>


                                        <ToggleButton
                                            value="left"
                                        >

                                            <span
                                                style={{
                                                    display:
                                                        "inline-block",

                                                    transform:
                                                        "rotate(180deg)",
                                                }}
                                            >
                                                ↶
                                            </span>

                                        </ToggleButton>

                                    </ToggleButtonGroup>


                                    {/* Удаление угла */}

                                    {profile.bends
                                        .length >
                                    1 ? (

                                        <IconButton
                                            color="error"
                                            size="small"
                                            title={
                                                `Удалить ${
                                                    ANGLE_LABEL
                                                } ${
                                                    index + 1
                                                }`
                                            }
                                            onClick={() =>
                                                removeBend(
                                                    index
                                                )
                                            }
                                        >

                                            <DeleteIcon />

                                        </IconButton>

                                    ) : (

                                        <Box />

                                    )}

                                </Box>

                            </React.Fragment>
                        )
                    )}


                    {/* ================================================= */}
                    {/* Последняя полка */}
                    {/* ================================================= */}

                    <Box
                        sx={
                            rowGrid
                        }
                    >

                        <TextField
                            label={`${SHELF_LABEL} ${profile.shelves.length}`}
                            type="number"
                            value={
                                profile
                                    .shelves[
                                profile
                                    .shelves
                                    .length -
                                1
                                    ].length
                            }
                            size="small"
                            sx={{
                                width:
                                SHELF_FIELD_WIDTH,
                            }}
                            onChange={(
                                e
                            ) =>
                                handleShelfChange(
                                    profile
                                        .shelves
                                        .length -
                                    1,
                                    e.target.value
                                )
                            }
                            slotProps={{
                                htmlInput:
                                    {
                                        min: 0,
                                        step: 0.01,
                                    },
                            }}
                        />


                        <Typography
                            color="
                                text.secondary
                            "
                            sx={{
                                textAlign:
                                    "center",
                            }}
                        >
                            мм
                        </Typography>


                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={
                                profile
                                    .shelves[
                                profile
                                    .shelves
                                    .length -
                                1
                                    ].side
                            }
                            onChange={(
                                e,
                                value
                            ) =>
                                handleShelfSideChange(
                                    profile
                                        .shelves
                                        .length -
                                    1,
                                    value
                                )
                            }
                        >

                            <ToggleButton
                                value="left"
                            >
                                ←
                            </ToggleButton>

                            <ToggleButton
                                value="right"
                            >
                                →
                            </ToggleButton>

                        </ToggleButtonGroup>


                        {/* ============================================= */}
                        {/* Выбор вертикальной последней полки */}
                        {/* ============================================= */}


                        <IconButton
                            size="small"
                            color={
                                verticalShelf ===
                                profile.shelves.length
                                    ? "primary"
                                    : "default"
                            }
                            onClick={() =>
                                setVerticalShelf(
                                    profile.shelves.length
                                )
                            }
                            title="Сделать полку вертикальной"
                            sx={{
                                borderRadius: "4px",

                                border:
                                    verticalShelf ===
                                    profile.shelves.length
                                        ? "1px solid"
                                        : "1px solid transparent",
                            }}
                        >

                            <span
                                style={{
                                    fontSize: "20px",
                                    lineHeight: 1,
                                }}
                            >
                                ↕
                            </span>
                        </IconButton>


                        <Box />

                    </Box>

                </Stack>


                {/* ================================================= */}
                {/* Кнопки */}
                {/* ================================================= */}

                <Box
                    sx={{
                        display: "flex",

                        gap: 1,

                        flexWrap: "wrap",

                        mt: 3,
                    }}
                >

                    <Button
                        variant="outlined"
                        startIcon={
                            <AddIcon />
                        }
                        onClick={
                            addBend
                        }
                    >
                        Добавить гибку
                    </Button>


                    <Button
                        variant="contained"
                        onClick={() => {

                            console.log(
                                getNumericProfile()
                            );

                            console.log(
                                "Вертикальная полка:",
                                verticalShelf
                            );

                        }}
                    >
                        Получить данные
                    </Button>

                </Box>

            </Paper>


            {/* ================================================= */}
            {/* Правая часть — схема */}
            {/* ================================================= */}

            <Box
                sx={{
                    flex: "1 1 400px",

                    minWidth: 0,

                    maxWidth: 700,
                }}
            >

                <BendingProfilePreview
                    profile={
                        profile
                    }

                    verticalShelf={
                        verticalShelf
                    }
                />

            </Box>

        </Box>
    );
}


export default BendingProfileInput;
