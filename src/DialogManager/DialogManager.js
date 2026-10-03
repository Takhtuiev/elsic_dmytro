import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import BendingDialog from "./BendingDialog";

import {
    selectCurrentDialog,
    selectDialogStack,
    updateDialogDraft,
    closeDialog
} from "../Store/dialogSlice";

import MaterialContent from "../containers/Bending/MaterialContent";
import MaterialEditContent from "../containers/Bending/MaterialEditContent";
import MachineContent from "../containers/Bending/MachineContent";
import SimulationContent from "../containers/Bending/SimulationContent";
import MachineEditContent from "../containers/Bending/MachineEditContent";

const dialogContent = {
    material: MaterialContent,
    "material-edit": MaterialEditContent,
    machine: MachineContent,
    "machine-edit": MachineEditContent,
    simulation: SimulationContent,
};

export default function DialogManager() {
    const dispatch = useDispatch();

    const dialog = useSelector(selectCurrentDialog);
    const stack = useSelector(selectDialogStack);

    const historyDepth = useRef(0);
    const previousStackLength = useRef(0);

    // Флаг: history.back() был вызван нами,
    // поэтому popstate не должен повторно закрывать Dialog.
    const programmaticBack = useRef(false);

    /*
     * Синхронизация Redux stack <-> browser history.
     *
     * Каждый Dialog = одна history-запись.
     *
     * Например:
     *
     * Redux:
     * [A, B, C]
     *
     * History:
     * page -> A -> B -> C
     */
    useEffect(() => {
        const currentLength = stack.length;
        const previousLength = previousStackLength.current;

        // Открыли один или несколько Dialog.
        if (currentLength > previousLength) {
            const count = currentLength - previousLength;

            for (let i = 0; i < count; i++) {
                window.history.pushState(
                    {
                        ...(window.history.state || {}),
                        bendingDialog: true,
                    },
                    ""
                );

                historyDepth.current += 1;
            }
        }

        // Dialog был закрыт через крестик / Cancel / Save
        // или stack был очищен.
        if (currentLength < previousLength) {
            const count = previousLength - currentLength;

            if (historyDepth.current >= count) {
                historyDepth.current -= count;

                programmaticBack.current = true;

                window.history.go(-count);
            }
        }

        previousStackLength.current = currentLength;
    }, [stack.length]);

    /*
     * Системная кнопка Back / браузерная кнопка Back.
     *
     * Если есть открытые Dialog, закрываем только верхний.
     */
    useEffect(() => {
        const handlePopState = () => {
            // Это был history.go(-count), вызванный нами
            // после обычного закрытия Dialog.
            if (programmaticBack.current) {
                programmaticBack.current = false;
                return;
            }

            // Если Dialog открыт — Back закрывает верхний.
            if (historyDepth.current > 0 && stack.length > 0) {
                historyDepth.current -= 1;

                dispatch(closeDialog());
            }
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [dispatch, stack.length]);

    if (!dialog) {
        return null;
    }

    const Content = dialogContent[dialog.dialogType];

    if (!Content) {
        console.error(
            `Unknown dialog type: ${dialog.dialogType}`
        );
        return null;
    }

    const handleChange = value => {
        dispatch(
            updateDialogDraft(value)
        );
    };

    const handleClose = () => {
        dispatch(
            closeDialog()
        );
    };

    const handleApply = value => {
        dispatch(
            closeDialog({
                value
            })
        );
    };

    return (
        <BendingDialog
            open
            title={dialog.title}
            value={dialog.draft}
            onChange={handleChange}
            onClose={handleClose}
            onApply={handleApply}
            renderContent={({ value, onChange }) => (
                <Content
                    {...dialog.data}
                    value={value}
                    onChange={onChange}
                />
            )}
        />
    );
}