import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    IconButton,
    InputAdornment,
    Link,
    Menu,
    MenuItem,
    Paper,
    TextField
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import DatabaseIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import InsightsIcon from "@mui/icons-material/Insights";
import MenuBookIcon from "@mui/icons-material/MenuBookOutlined";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import ProfileRow from "./ProfileRow";
import PreviewToolbar from "./PreviewToolbar";
import BendingPreview from "./BendingPreview";
import { SectionHeader, SelectorField, NUMERIC_SX } from "./uiKit";
import {
    calculateBlankLength,
    calculateOuterLengthToEnd,
    calculateBendingMachineParams
} from "./Calculations";
import buildProfileGeometry from "./BuildProfileGeometry";
import { getShelfVector, getPreferredSide, calculateBendView } from "./profileViewMath";
import { setProfile } from "../../Store/bendingSlice";
import { openDialog, selectLastReturnedData, clearDialogDataReturned } from "../../Store/dialogSlice";
import { MATERIALS, MACHINES } from "./parameters";
import { BayeusianLogDialog } from "./Heating2DSimulation/BayeusianLogDialog";
import { ACCURACY_MODES } from "./Heating2DSimulation/heating2DModel";

const EDITOR_WIDTH = "23rem";
const THICKNESS_PRESETS = [2, 3, 4, 5, 6, 8, 10];
const DEFAULT_MATERIAL = MATERIALS.PVC_CAW_RED;

const INITIAL_STATE = {
    name: "Detail-4301",

    material: DEFAULT_MATERIAL,
    machine: MACHINES.MACHINE_LINE_1,

    geometry: {
        thickness: 4,
        width: 430,
        shelves: [
            { length: 50, side: "right" },
            { length: 100, side: "right" },
            { length: 150, side: "left" }
        ],
        bends: [
            { angle: 90, direction: "right" },
            { angle: 135, direction: "left" }
        ]
    },

    simulation: {
        // --- Физические параметры ---
        target: {
            type: "minTemperature",
            value: (DEFAULT_MATERIAL?.minFormingTemp + DEFAULT_MATERIAL?.maxFormingTemp) / 2
        },
        widthHalfMm: 20,
        temperatures: { ambientC: 20, ambientRadiationC: 20, initialC: 20 },
        cooling: { timeSeconds: 10, convectiveHeatTransferCoefficient: 8 },
        stopAtMaxTemperature: false,
        maxTimeSeconds: 1800,

        // Точность расчёта: "fast" | "optimal" | "accurate" | объект пользовательских параметров
        accuracyMode: "optimal",
        calculateAccuracyError: true,

        // Какие графики показывать
        ui: {
            showVerticalSlice: true,
            showHorizontalWidth: false,
            showTimeDynamics: true,
            showHeaterDynamics: true,
            showContours2D: true
        }
    },

    view: {
        rotation: 0,
        mirrored: false,
        bendIndex: -1,
        bendSide: "toEnd"
    }
};

const setByPath = (object, path, value) => {
    const result = Array.isArray(object) ? [...object] : { ...object };
    let current = result;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        current = current[key];
    }
    current[path[path.length - 1]] = value;
    return result;
};

// Геометрия профиля из состояния страницы (для расчётов вида)
const profileGeometryOf = (state) => buildProfileGeometry({
    ...state,
    ...state.geometry,
    rTool: state.machine?.rTool,
    kFactor: state.material?.kFactor
});

const normalizeAngle = (a) => ((a + 180) % 360 + 360) % 360 - 180;
const angleDistance = (a, b) => Math.abs(normalizeAngle(a - b));

// Пустая строка остаётся пустой (поле в процессе ввода), иначе — число
const toNumberOrEmpty = (value) => (value === "" ? "" : Number(value));

const hideSpinnersSx = {
    "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { display: "none" },
    "& input[type=number]": { MozAppearance: "textfield" }
};

const UnitText = ({ children }) => (
    <Box component="span" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{children}</Box>
);

const ParamField = ({ label, value, onChange, step = 1, endAdornment, error }) => (
    <TextField
        label={label}
        size="small"
        type="number"
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        sx={hideSpinnersSx}
        slotProps={{
            htmlInput: { step, min: 0, inputMode: "decimal", style: NUMERIC_SX },
            input: {
                endAdornment: endAdornment && <InputAdornment position="end">{endAdornment}</InputAdornment>
            }
        }}
    />
);

// Краткое описание настроек симуляции для поля-селектора
const describeSimulation = (simulation) => {
    const target = simulation?.target;
    const targetText = target?.type === "time"
        ? `${target.value} s`
        : target?.type === "surfaceTemperature"
            ? `Surface ${target?.value} °C`
            : `Min ${target?.value} °C`;
    const mode = typeof simulation?.accuracyMode === "string"
        ? simulation.accuracyMode.charAt(0).toUpperCase() + simulation.accuracyMode.slice(1)
        : "Custom";
    return `${targetText} · pause ${simulation?.cooling?.timeSeconds ?? "—"} s · ${mode}`;
};

export default function Biegeberechnung() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Вид до выбора гиба — восстанавливается, когда вид гиба закрыт
    const savedView = useRef({ rotation: 0, mirrored: false });

    const profile = useSelector((state) => state.bending.profile);
    const lastReturnedData = useSelector(selectLastReturnedData);

    const [state, setState] = useState(profile ?? INITIAL_STATE);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [rotationPreview, setRotationPreview] = useState(null);
    const [verticalShelfIndex, setVerticalShelfIndex] = useState(null);
    const [thicknessMenuAnchor, setThicknessMenuAnchor] = useState(null);

    useEffect(() => {
        dispatch(setProfile(state));
    }, [state, dispatch]);

    // Результат диалогов справочников
    useEffect(() => {
        if (!lastReturnedData) return;
        const { dialogType, data } = lastReturnedData;
        const value = data?.value;

        if (value !== undefined && ["material", "machine", "simulation"].includes(dialogType)) {
            setState((prev) => ({ ...prev, [dialogType]: value }));
        }
        dispatch(clearDialogDataReturned());
    }, [lastReturnedData, dispatch]);

    const { material, machine, geometry, simulation, view } = state;
    const { thickness, width, shelves, bends } = geometry;
    const { rotation, mirrored, bendIndex, bendSide } = view;
    const selectedBend = bends[bendIndex] ?? null;

    // Изменение геометрии. Читает вид из prev — без устаревших значений из замыкания.
    const updateGeometry = useCallback((changes) => {
        setState((prev) => {
            if (!changes.path) {
                return { ...prev, geometry: { ...prev.geometry, ...changes } };
            }

            const [collection, index, field] = changes.path;
            const nextGeometry = setByPath(prev.geometry, changes.path, changes.value);
            let nextView = prev.view;

            // Угол/направление гиба до выбранного вида меняют ориентацию — пересчитать вид
            const { bendIndex: selected, bendSide: side } = prev.view;
            const selectedShelfIndex = side === "fromStart" ? selected : selected + 1;
            if (
                selected >= 0 &&
                collection === "bends" &&
                (field === "angle" || field === "direction") &&
                index <= selectedShelfIndex
            ) {
                const built = profileGeometryOf({ ...prev, geometry: nextGeometry });
                nextView = {
                    ...prev.view,
                    ...calculateBendView(built, selected, side, prev.view.mirrored, prev.view.rotation)
                };
            }

            return { ...prev, geometry: nextGeometry, view: nextView };
        });
    }, []);

    const geometryProfile = useMemo(
        () => ({
            ...state,
            ...geometry,
            kFactor: material?.kFactor,
            rTool: machine?.rTool
        }),
        [state, geometry, material, machine]
    );

    const builtGeometry = useMemo(() => buildProfileGeometry(geometryProfile), [geometryProfile]);

    // Выбор гиба: первый клик — вид гиба с предпочтительной стороны, второй — другая
    // сторона, третий — закрыть вид и вернуть сохранённый поворот
    const handleSelectBend = useCallback((index) => {
        setState((prev) => {
            const built = profileGeometryOf(prev);
            const preferredSide = getPreferredSide(prev.geometry.shelves, index);

            if (prev.view.bendIndex !== index) {
                if (prev.view.bendIndex < 0) {
                    savedView.current = { rotation: prev.view.rotation, mirrored: prev.view.mirrored };
                }
                return {
                    ...prev,
                    view: {
                        ...prev.view,
                        bendIndex: index,
                        bendSide: preferredSide,
                        ...calculateBendView(built, index, preferredSide, prev.view.mirrored, prev.view.rotation)
                    }
                };
            }

            if (prev.view.bendSide !== preferredSide) {
                return {
                    ...prev,
                    view: { ...prev.view, bendIndex: -1, bendSide: "toEnd", ...savedView.current }
                };
            }

            const nextSide = prev.view.bendSide === "fromStart" ? "toEnd" : "fromStart";
            return {
                ...prev,
                view: {
                    ...prev.view,
                    bendSide: nextSide,
                    ...calculateBendView(built, index, nextSide, prev.view.mirrored, prev.view.rotation)
                }
            };
        });
    }, []);

    // Полка вертикально; повторный клик — переворот на 180°
    const handleVerticalShelfChange = useCallback((index) => {
        setState((prev) => {
            const vector = getShelfVector(profileGeometryOf(prev), index);
            if (!vector) return prev;

            const dx = prev.view.mirrored ? -vector.x : vector.x;
            const rotation0 = ((-Math.PI / 2 - Math.atan2(vector.y, dx)) * 180) / Math.PI;
            const rotation180 = rotation0 + 180;
            const current = prev.view.rotation;
            const isVertical = angleDistance(current, rotation0) < 1 || angleDistance(current, rotation180) < 1;

            const next = isVertical
                ? (angleDistance(current, rotation0) < 1 ? rotation180 : rotation0)
                : (angleDistance(current, rotation0) <= angleDistance(current, rotation180) ? rotation0 : rotation180);

            return { ...prev, view: { ...prev.view, rotation: normalizeAngle(next) } };
        });
        setVerticalShelfIndex(index);
    }, []);

    const handleProfileRotationChange = useCallback((value) => setRotationPreview(Number(value)), []);

    const handleProfileRotationCommitted = useCallback((value) => {
        setState((prev) => ({ ...prev, view: { ...prev.view, rotation: Number(value) } }));
        setVerticalShelfIndex(null);
        setRotationPreview(null);
    }, []);

    const handleMirror = useCallback(() => {
        setState((prev) => ({
            ...prev,
            view: { ...prev.view, mirrored: !prev.view.mirrored, rotation: -prev.view.rotation }
        }));
    }, []);

    const addBend = useCallback(() => {
        setState((prev) => ({
            ...prev,
            geometry: {
                ...prev.geometry,
                shelves: [...prev.geometry.shelves, { length: 50, side: "right" }],
                bends: [...prev.geometry.bends, { angle: 90, direction: "right" }]
            }
        }));
    }, []);

    const removeBend = useCallback((index) => {
        setState((prev) => {
            const selected = prev.view.bendIndex;
            const nextView = selected === index
                ? { ...prev.view, bendIndex: -1, bendSide: "toEnd", ...savedView.current }
                : { ...prev.view, bendIndex: selected > index ? selected - 1 : selected };
            return {
                ...prev,
                geometry: {
                    ...prev.geometry,
                    bends: prev.geometry.bends.filter((_, i) => i !== index),
                    shelves: prev.geometry.shelves.filter((_, i) => i !== index + 1)
                },
                view: nextView
            };
        });
        setVerticalShelfIndex(null);
    }, []);

    const distanceToOuterApex = useMemo(
        () => (bendIndex < 0
            ? 0
            : Number(calculateOuterLengthToEnd(geometryProfile, bendIndex, bendSide).toFixed(2))),
        [geometryProfile, bendIndex, bendSide]
    );

    const machineParams = useMemo(
        () => (selectedBend
            ? calculateBendingMachineParams({
                alpha: Number(selectedBend.angle),
                lInput: distanceToOuterApex,
                isInnerMode: false,
                t: Number(thickness),
                rTool: machine?.rTool
            })
            : null),
        [selectedBend, distanceToOuterApex, thickness, machine]
    );

    const blankLength = useMemo(() => calculateBlankLength(geometryProfile), [geometryProfile]);

    const openMaterialDialog = useCallback(() => {
        dispatch(openDialog({ id: "material", dialogType: "material", title: "Material", data: { value: material, materials: MATERIALS } }));
    }, [dispatch, material]);

    const openMachineDialog = useCallback(() => {
        dispatch(openDialog({ id: "machine", dialogType: "machine", title: "Machine", data: { value: machine, machines: MACHINES } }));
    }, [dispatch, machine]);

    const openSimulationDialog = useCallback(() => {
        dispatch(openDialog({
            id: "simulation",
            dialogType: "simulation",
            title: "Simulation parameters",
            data: { value: simulation, accuracyModes: ACCURACY_MODES }
        }));
    }, [dispatch, simulation]);

    const thicknessNumber = Number(thickness);
    const widthNumber = Number(width);

    return (
        <Box
            className="biege-main-page"
            sx={{
                display: "grid",
                gridTemplateColumns: `${EDITOR_WIDTH} minmax(0, 1fr)`,
                gridTemplateAreas: `"editor preview"`,
                alignItems: "start",
                gap: 1.5,
                m: 1.5,
                [`@media (max-width: 52rem)`]: {
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gridTemplateAreas: `"preview" "editor"`,
                    m: 0.5,
                    gap: 1
                }
            }}
        >
            <Paper
                variant="outlined"
                className="bending-preview-paper"
                sx={{ gridArea: "preview", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
            >
                <PreviewToolbar
                    rotation={rotationPreview ?? rotation}
                    bendIndex={bendIndex}
                    mirrored={mirrored}
                    onRotationChange={handleProfileRotationChange}
                    onRotationCommitted={handleProfileRotationCommitted}
                    onMirror={handleMirror}
                />

                <Box className="bending-preview-content" sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
                    <BendingPreview
                        profile={geometryProfile}
                        geometry={builtGeometry}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        simulation={simulation}
                        rotationPreview={rotationPreview}
                    />
                </Box>
            </Paper>

            <Paper
                variant="outlined"
                className="bending-editor-paper"
                sx={{
                    gridArea: "editor",
                    minWidth: 0,
                    pb: 1.5
                }}
            >
                <SectionHeader title="Part" sx={{ pt: 1.25 }} />
                <Box sx={{ px: 1.5 }}>
                    <TextField
                        label="Part name"
                        size="small"
                        fullWidth
                        value={state.name ?? ""}
                        onChange={(e) => {
                            const name = e.target.value;
                            setState((prev) => ({ ...prev, name }));
                        }}
                    />
                </Box>

                <SectionHeader title="Profile" />
                <Box>
                    {shelves.map((shelf, index) => (
                        <ProfileRow
                            key={index}
                            shelf={shelf}
                            bend={bends[index]}
                            index={index}
                            thickness={thicknessNumber}
                            bendIndex={bendIndex}
                            bendSide={bendSide}
                            isVertical={verticalShelfIndex === index}
                            onUpdate={updateGeometry}
                            onSelectBend={handleSelectBend}
                            onVerticalShelfChange={handleVerticalShelfChange}
                            onRemoveBend={removeBend}
                            canRemove={bends.length > 1}
                        />
                    ))}
                </Box>
                <Box sx={{ px: 1.5, pt: 0.75 }}>
                    <Button fullWidth size="small" variant="outlined" startIcon={<AddIcon />} onClick={addBend} sx={{ borderStyle: "dashed" }}>
                        Add bend
                    </Button>
                </Box>

                <SectionHeader title="Setup" />
                <Box sx={{ px: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <SelectorField label="Machine" value={machine?.name} onOpen={openMachineDialog} icon={<DatabaseIcon fontSize="small" />} />
                    <SelectorField label="Material" value={material?.name} onOpen={openMaterialDialog} icon={<DatabaseIcon fontSize="small" />} />

                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                        <ParamField
                            label="Thickness"
                            value={thickness}
                            step="0.1"
                            error={!(thicknessNumber > 0)}
                            onChange={(value) => updateGeometry({ thickness: toNumberOrEmpty(value) })}
                            endAdornment={
                                <Box sx={{ display: "flex", alignItems: "center" }}>
                                    <UnitText>mm</UnitText>
                                    <IconButton
                                        size="small"
                                        aria-label="Thickness presets"
                                        onClick={(e) => setThicknessMenuAnchor(e.currentTarget)}
                                        sx={{ p: 0.25, ml: 0.25, color: "text.secondary" }}
                                    >
                                        <KeyboardArrowDownIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            }
                        />
                        <ParamField
                            label="Part width"
                            value={width}
                            step="1"
                            error={!(widthNumber > 0)}
                            onChange={(value) => updateGeometry({ width: toNumberOrEmpty(value) })}
                            endAdornment={<UnitText>mm</UnitText>}
                        />
                    </Box>

                    <SelectorField
                        label="Simulation"
                        value={describeSimulation(simulation)}
                        onOpen={openSimulationDialog}
                        icon={<TuneIcon fontSize="small" />}
                    />
                </Box>

                <SectionHeader title="Tools" />
                <Box sx={{ px: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button variant="contained" fullWidth disableElevation startIcon={<InsightsIcon />} onClick={() => setIsLogOpen(true)}>
                        Optimizer dashboard
                    </Button>
                    <Link
                        component="button"
                        type="button"
                        underline="hover"
                        onClick={() => navigate("/heating-methodology_de")}
                        sx={{ alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}
                    >
                        <MenuBookIcon sx={{ fontSize: 16 }} />
                        Heating methodology
                    </Link>
                </Box>

                <BayeusianLogDialog
                    open={isLogOpen}
                    onClose={() => setIsLogOpen(false)}
                    parentState={state}
                    setParentState={setState}
                    accuracyModes={ACCURACY_MODES}
                />

                <Menu anchorEl={thicknessMenuAnchor} open={Boolean(thicknessMenuAnchor)} onClose={() => setThicknessMenuAnchor(null)}>
                    {THICKNESS_PRESETS.map((value) => (
                        <MenuItem
                            key={value}
                            dense
                            selected={thicknessNumber === value}
                            onClick={() => {
                                updateGeometry({ thickness: value });
                                setThicknessMenuAnchor(null);
                            }}
                            sx={NUMERIC_SX}
                        >
                            {value} mm
                        </MenuItem>
                    ))}
                </Menu>
            </Paper>
        </Box>
    );
}
