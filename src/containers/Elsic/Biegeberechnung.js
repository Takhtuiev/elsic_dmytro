import React, { useState } from "react";

import {
    Box,
    Button,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";

import BendingProfilePreview
    from "./BendingProfilePreview";

import BendingProfileRow
    from "./BendingProfileRow";

import {
    calculateBlankLength,
} from "./bendingCalculations";


// =====================================================
// Component
// =====================================================

function Biegeberechnung() {

    const [profile, setProfile,] = useState({

        // =================================================
        // Параметры материала и инструмента
        // =================================================
        thickness: "4",
        kFactor: "0.32",
        rTool: "1.2",

        // =================================================
        // Полки
        // =================================================
        shelves: [
            {
                length: "20",
                side: "right",
            },
            {
                length: "20",
                side: "right",
            },
        ],

        // =================================================
        // Гибки
        // =================================================
        bends: [
            {
                angle: "180",
                direction: "right",
            },
        ],
    });


    // =================================================
    // Вертикальная полка
    // =================================================

    const [verticalShelf, setVerticalShelf,] = useState(1);


    // =================================================
    // Изменение параметра профиля
    // =================================================

    const handleProfileParameterChange = (parameter, value) => {

        setProfile((prev) => ({...prev, [parameter]: value,}));
    };


    // =================================================
    // Изменение длины полки
    // =================================================

    const handleShelfChange = (index, value) => {

        setProfile(
            (prev) => ({
                ...prev,
                shelves: prev.shelves.map((shelf, i) =>
                            i === index ? {...shelf, length: value,} : shelf
                    ),
            })
        );
    };


    // =================================================
    // Изменение направления размера полки
    // =================================================

    const handleShelfSideChange = (index, side) => {

        if (side === null) {return;}

        setProfile(
            (prev) => ({
                ...prev,
                shelves:
                    prev.shelves.map((shelf, i) =>
                            i === index ? {...shelf, side} : shelf
                    ),
            })
        );
    };


    // =================================================
    // Выбор вертикальной полки
    // =================================================

    const handleVerticalShelfChange = (index) => {

        setVerticalShelf(index + 1);
    };


    // =================================================
    // Изменение угла
    // =================================================

    const handleBendChange = (index, value) => {

        setProfile(
            (prev) => ({
                ...prev,
                bends: prev.bends.map((bend, i) =>
                            i === index ? {...bend, angle: value,} : bend
                    ),
            })
        );
    };


    // =================================================
    // Изменение направления гибки
    // =================================================

    const handleBendDirectionChange = (index, direction) => {

        if (direction === null) {return;}

        setProfile(
            (prev) => ({
                ...prev,
                bends:
                    prev.bends.map((bend, i) =>
                            i === index ? {...bend, direction} : bend),
            })
        );
    };


    // =================================================
    // Добавить гибку
    // =================================================

    const addBend = () => {

        setProfile(
            (prev) => ({
                ...prev,
                shelves: [...prev.shelves, {length: "20", side: "right",},],
                bends: [...prev.bends, {angle: "180", direction: "right",},],
            })
        );
    };


    // =================================================
    // Удалить гибку
    // =================================================

    const removeBend = (index) => {

        if (profile.bends.length <= 1) {return;}

        setProfile(
            (prev) => ({
                ...prev,
                shelves: prev.shelves.filter((_, i) => i !== index + 1),
                bends: prev.bends.filter((_, i) => i !== index),
            })
        );


        // =============================================
        // Корректируем вертикальную полку
        // =============================================

        const removedShelf = index + 2;

        if (verticalShelf === removedShelf) {
            setVerticalShelf(Math.max(1, verticalShelf - 1));

        } else if (verticalShelf > removedShelf) {
            setVerticalShelf(verticalShelf - 1);
        }
    };


    // =================================================
    // Числовой профиль
    // =================================================

    const getNumericProfile = () => {

        return {

            thickness: profile.thickness === "" ? null : Number(profile.thickness),

            kFactor: profile.kFactor === "" ? null : Number(profile.kFactor),

            rTool: profile.rTool === "" ? null : Number(profile.rTool),

            shelves: profile.shelves.map(
                    (shelf) => ({
                        ...shelf,
                        length: shelf.length === "" ? null : Number(shelf.length),
                    })
                ),

            bends: profile.bends.map(
                    (bend) => ({...bend,
                        angle: bend.angle === ""
                            ? null
                            : Number(bend.angle)
                    })
            ),
        };
    };


    // =================================================
    // Размер заготовки
    // =================================================

    const blankLength = calculateBlankLength(profile);

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
            {/* Левая часть */}
            {/* ================================================= */}

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    width: "fit-content",
                    maxWidth: "100%",
                    flexShrink: 0,
                }}
            >

                {/* ================================================= */}
                {/* Профиль детали */}
                {/* ================================================= */}

                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        width: "fit-content",
                        maxWidth: "100%",
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
                        {/* Полки + гибки */}
                        {/* ================================================= */}

                        {profile.bends.map(
                            (
                                bend,
                                index
                            ) => (

                                <BendingProfileRow
                                    key={index}
                                    shelf={profile.shelves[index]}
                                    bend={bend}
                                    index={index}
                                    verticalShelf={verticalShelf}
                                    onShelfChange={handleShelfChange}
                                    onShelfSideChange={handleShelfSideChange}
                                    onVerticalShelfChange={handleVerticalShelfChange}
                                    onBendChange={handleBendChange}
                                    onBendDirectionChange={handleBendDirectionChange}
                                    onRemoveBend={removeBend}
                                    canRemove={profile.bends.length > 1}
                                />

                            )
                        )}


                        {/* ================================================= */}
                        {/* Последняя полка */}
                        {/* ================================================= */}

                        <BendingProfileRow
                            shelf={profile.shelves[profile.shelves.length - 1]}
                            bend={null}
                            index={profile.shelves.length - 1}
                            verticalShelf={verticalShelf}
                            onShelfChange={handleShelfChange}
                            onShelfSideChange={handleShelfSideChange}
                            onVerticalShelfChange={handleVerticalShelfChange}
                            onBendChange={handleBendChange}
                            onBendDirectionChange={handleBendDirectionChange}
                            onRemoveBend={removeBend}
                            canRemove={false}
                        />

                    </Stack>


                    {/* ================================================= */}
                    {/* Добавить гибку */}
                    {/* ================================================= */}

                    <Box
                        sx={{
                            mt: 3,
                        }}
                    >

                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={addBend}
                            sx={{
                                width: "100%",
                            }}
                        >
                            Добавить гибку
                        </Button>

                    </Box>

                </Paper>


                {/* ================================================= */}
                {/* Параметры */}
                {/* ================================================= */}

                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                    }}
                >

                    <Typography
                        variant="h6"
                        sx={{
                            mb: 3,
                        }}
                    >
                        Параметры
                    </Typography>


                    <Stack spacing={2}>

                        {/* ================================================= */}
                        {/* Толщина */}
                        {/* ================================================= */}

                        <TextField
                            label="Dicke"
                            type="number"
                            value={
                                profile.thickness
                            }
                            size="small"
                            sx={{
                                width: "16ch",
                            }}
                            onChange={(e) =>
                                handleProfileParameterChange(
                                    "thickness",
                                    e.target.value
                                )
                            }
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    step: 0.01,
                                },

                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            mm
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />


                        {/* ================================================= */}
                        {/* K-Faktor */}
                        {/* ================================================= */}

                        <TextField
                            label="K-Faktor"
                            type="number"
                            value={
                                profile.kFactor
                            }
                            size="small"
                            sx={{
                                width: "16ch",
                            }}
                            onChange={(e) =>
                                handleProfileParameterChange(
                                    "kFactor",
                                    e.target.value
                                )
                            }
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    max: 1,
                                    step: 0.01,
                                },
                            }}
                        />


                        {/* ================================================= */}
                        {/* R_tool */}
                        {/* ================================================= */}

                        <TextField
                            label="R_tool"
                            type="number"
                            value={
                                profile.rTool
                            }
                            size="small"
                            sx={{
                                width: "16ch",
                            }}
                            onChange={(e) =>
                                handleProfileParameterChange(
                                    "rTool",
                                    e.target.value
                                )
                            }
                            slotProps={{
                                htmlInput: {
                                    min: 0,
                                    step: 0.01,
                                },

                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            mm
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />

                    </Stack>


                    {/* ================================================= */}
                    {/* Размер заготовки */}
                    {/* ================================================= */}

                    <Box
                        sx={{
                            mt: 3,

                            pt: 2,

                            borderTop: "1px solid",

                            borderColor: "divider",
                        }}
                    >

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                mb: 0.5,
                            }}
                        >
                            Размер заготовки
                        </Typography>


                        <Typography
                            variant="h5"
                        >
                            {blankLength !== null
                                ? `${blankLength.toFixed(2)} mm`
                                : "—"
                            }
                        </Typography>

                    </Box>

                </Paper>

            </Box>


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


export default Biegeberechnung;
