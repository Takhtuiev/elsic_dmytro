import React, { useState } from "react";
import {
    Box, Button, InputAdornment, Paper, Stack, TextField,
    Typography, ToggleButton, ToggleButtonGroup,
    FormControl, InputLabel, Select, MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import ProfilePreview from "./ProfilePreview";
import ProfileRow from "./ProfileRow";
import { calculateBlankLength } from "./Calculations";
import ProfileGeometryPreview from "./ProfileGeometryPreview";

function Biegeberechnung() {
    // Профиль: полка → гибка → полка
    const [profile, setProfile] = useState({
        thickness: "4",
        kFactor: "0.32",
        rTool: "1.2",
        elements: [
            { type: "shelf", length: "20", side: "right" },
            { type: "bend", angle: "180", direction: "right" },
            { type: "shelf", length: "20", side: "right" },
        ],
    });

    // Вертикальная полка на схеме
    const [verticalShelf, setVerticalShelf] = useState(1);

    // Исходная гибка и направление от неё
    const [referenceBend, setReferenceBend] = useState({
        index: -1,
        direction: "right",
    });

    // Получаем полки и гибки из общего массива
    const shelves = profile.elements.filter(e => e.type === "shelf");
    const bends = profile.elements.filter(e => e.type === "bend");

    // Изменение параметров
    const handleProfileParameterChange = (parameter, value) => {
        setProfile(prev => ({ ...prev, [parameter]: value }));
    };

    // Изменение длины полки
    const handleShelfChange = (shelfIndex, value) => {
        setProfile(prev => {
            let current = -1;

            return {
                ...prev,
                elements: prev.elements.map(e => {
                    if (e.type !== "shelf") return e;
                    current++;
                    return current === shelfIndex ? { ...e, length: value } : e;
                }),
            };
        });
    };

    // Изменение стороны размера полки
    const handleShelfSideChange = (shelfIndex, side) => {
        if (side === null) return;

        setProfile(prev => {
            let current = -1;

            return {
                ...prev,
                elements: prev.elements.map(e => {
                    if (e.type !== "shelf") return e;
                    current++;
                    return current === shelfIndex ? { ...e, side } : e;
                }),
            };
        });
    };

    // Выбор вертикальной полки
    const handleVerticalShelfChange = index => {
        setVerticalShelf(index + 1);
    };

    // Изменение угла гибки
    const handleBendChange = (bendIndex, value) => {
        setProfile(prev => {
            let current = -1;

            return {
                ...prev,
                elements: prev.elements.map(e => {
                    if (e.type !== "bend") return e;
                    current++;
                    return current === bendIndex ? { ...e, angle: value } : e;
                }),
            };
        });
    };

    // Изменение направления гибки
    const handleBendDirectionChange = (bendIndex, direction) => {
        if (direction === null) return;

        setProfile(prev => {
            let current = -1;

            return {
                ...prev,
                elements: prev.elements.map(e => {
                    if (e.type !== "bend") return e;
                    current++;
                    return current === bendIndex ? { ...e, direction } : e;
                }),
            };
        });
    };

    // Выбор исходной гибки
    const handleReferenceBendChange = event => {
        setReferenceBend(prev => ({
            ...prev,
            index: Number(event.target.value),
        }));
    };

    // Выбор направления от исходной гибки
    const handleReferenceDirectionChange = (_, direction) => {
        if (direction === null) return;

        setReferenceBend(prev => ({
            ...prev,
            direction,
        }));
    };

    // Добавление гибки и следующей полки
    const addBend = () => {
        setProfile(prev => ({
            ...prev,
            elements: [
                ...prev.elements,
                { type: "bend", angle: "180", direction: "right" },
                { type: "shelf", length: "20", side: "right" },
            ],
        }));
    };

    // Удаление гибки и следующей полки
    const removeBend = bendIndex => {
        if (bends.length <= 1) return;

        setProfile(prev => {
            let current = -1;
            const elements = [];

            for (let i = 0; i < prev.elements.length; i++) {
                const element = prev.elements[i];

                if (element.type !== "bend") {
                    elements.push(element);
                    continue;
                }

                current++;

                if (current === bendIndex) {
                    if (prev.elements[i + 1]?.type === "shelf") i++;
                    continue;
                }

                elements.push(element);
            }

            return { ...prev, elements };
        });

        // Корректируем исходную гибку
        if (referenceBend.index === bendIndex) {
            setReferenceBend(prev => ({ ...prev, index: -1 }));
        } else if (referenceBend.index > bendIndex) {
            setReferenceBend(prev => ({
                ...prev,
                index: prev.index - 1,
            }));
        }

        // Корректируем вертикальную полку
        const removedShelf = bendIndex + 2;

        if (verticalShelf === removedShelf) {
            setVerticalShelf(Math.max(1, verticalShelf - 1));
        } else if (verticalShelf > removedShelf) {
            setVerticalShelf(verticalShelf - 1);
        }
    };

    // Длина заготовки
    const blankLength = calculateBlankLength(profile);

    // Выбранная гибка
    const selectedReferenceBend =
        referenceBend.index >= 0
            ? bends[referenceBend.index]
            : null;

    return (
        <Box sx={{
            display: "flex",
            gap: 3,
            alignItems: "flex-start",
            width: "100%",
            flexWrap: "wrap",
        }}>
            <Box sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                width: "fit-content",
                maxWidth: "100%",
                flexShrink: 0,
            }}>

                {/* Профиль детали */}
                <Paper elevation={2} sx={{
                    p: 3,
                    width: "fit-content",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        Part Profile
                    </Typography>

                    <Stack spacing={2}>
                        {shelves.map((shelf, shelfIndex) => (
                            <ProfileRow
                                key={`row-${shelfIndex}`}
                                shelf={shelf}
                                bend={bends[shelfIndex] || null}
                                index={shelfIndex}
                                verticalShelf={verticalShelf}
                                onShelfChange={handleShelfChange}
                                onShelfSideChange={handleShelfSideChange}
                                onVerticalShelfChange={handleVerticalShelfChange}
                                onBendChange={handleBendChange}
                                onBendDirectionChange={handleBendDirectionChange}
                                onRemoveBend={removeBend}
                                canRemove={
                                    Boolean(bends[shelfIndex]) &&
                                    bends.length > 1
                                }
                            />
                        ))}
                    </Stack>

                    <Box sx={{ mt: 3 }}>
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={addBend}
                            sx={{ width: "100%" }}
                        >
                            Add Bend
                        </Button>
                    </Box>
                </Paper>

                {/* Параметры расчёта */}
                <Paper elevation={2} sx={{
                    p: 3,
                    width: "100%",
                    boxSizing: "border-box",
                }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        Parameters
                    </Typography>

                    <Stack spacing={2}>
                        <TextField
                            label="Thickness"
                            type="number"
                            value={profile.thickness}
                            size="small"
                            sx={{ width: "16ch" }}
                            onChange={e =>
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

                        <TextField
                            label="K-Factor"
                            type="number"
                            value={profile.kFactor}
                            size="small"
                            sx={{ width: "16ch" }}
                            onChange={e =>
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

                        <TextField
                            label="R_tool"
                            type="number"
                            value={profile.rTool}
                            size="small"
                            sx={{ width: "16ch" }}
                            onChange={e =>
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

                    {/* Длина заготовки */}
                    <Box sx={{
                        mt: 3,
                        pt: 2,
                        borderTop: "1px solid",
                        borderColor: "divider",
                    }}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                        >
                            Blank Length
                        </Typography>

                        <Typography variant="h5">
                            {blankLength !== null
                                ? `${blankLength.toFixed(2)} mm`
                                : "—"}
                        </Typography>
                    </Box>
                </Paper>

                {/* Исходная гибка для стоп-позиции */}
                <Paper elevation={2} sx={{
                    p: 2,
                    width: "100%",
                    boxSizing: "border-box",
                }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ width: 150 }}>
                            <InputLabel>Bend</InputLabel>

                            <Select
                                value={referenceBend.index}
                                label="Bend"
                                onChange={handleReferenceBendChange}
                            >
                                <MenuItem value={-1}>
                                    Not selected
                                </MenuItem>

                                {bends.map((bend, index) => (
                                    <MenuItem key={index} value={index}>
                                        {index + 1} — {bend.angle}°
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <ToggleButtonGroup
                            value={referenceBend.direction}
                            exclusive
                            size="small"
                            onChange={handleReferenceDirectionChange}
                        >
                            <ToggleButton value="left">
                                ←
                            </ToggleButton>

                            <ToggleButton value="right">
                                →
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                </Paper>
            </Box>

            {/* Схема профиля */}
            <Box sx={{
                flex: "1 1 400px",
                minWidth: 0,
                maxWidth: 700,
            }}>
                <ProfileGeometryPreview
                    profile={profile}
                />
                <ProfilePreview
                    profile={profile}
                    verticalShelf={verticalShelf}
                    referenceBend={referenceBend}
                />

            </Box>
        </Box>
    );
}

export default Biegeberechnung;
