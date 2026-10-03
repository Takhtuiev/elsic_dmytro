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

    const previousStackLength = useRef(0);
    const historyDepth = useRef(0);

    // Back браузера/телефона уже обработал изменение history.
    const browserBack = useRef(false);

    // Закрытие Dialog программно.
    const programmaticClose = useRef(false);

    /*
     * Синхронизация Redux stack -> browser history.
     */
    useEffect(() => {
        const currentLength = stack.length;
        const previousLength = previousStackLength.current;

        /*
         * Открылись новые Dialog.
         */
        if (currentLength > previousLength) {
            const count = currentLength - previousLength;

            for (let i = 0; i < count; i++) {
                window.history.pushState(
                    {
                        ...(window.history.state || {}),
                        bendingDialog: true
                    },
                    ""
                );

                historyDepth.current += 1;
            }
        }

        /*
         * Dialog закрылся.
         */
        if (currentLength < previousLength) {
            const count = previousLength - currentLength;

            /*
             * Если закрытие произошло через системный Back,
             * history уже была изменена самим браузером.
             *
             * НИКАКОЙ history.back() здесь больше не нужен.
             */
            if (browserBack.current) {
                browserBack.current = false;

                historyDepth.current = Math.max(
                    0,
                    historyDepth.current - count
                );
            } else {
                /*
                 * Закрытие произошло через:
                 * Cancel / крестик / Save.
                 *
                 * Поэтому теперь удаляем соответствующие
                 * записи из browser history.
                 */
                historyDepth.current = Math.max(
                    0,
                    historyDepth.current - count
                );

                programmaticClose.current = true;

                window.history.go(-count);
            }
        }

        previousStackLength.current = currentLength;
    }, [stack.length]);

    /*
     * Обработка системной кнопки Back / браузерной Back.
     */
    useEffect(() => {
        const handlePopState = () => {
            /*
             * Это popstate, который мы сами вызвали
             * через history.go(-count) после обычного закрытия.
             */
            if (programmaticClose.current) {
                programmaticClose.current = false;
                return;
            }

            /*
             * Если открыт хотя бы один Dialog,
             * системный Back закрывает только верхний.
             */
            if (
                historyDepth.current > 0 &&
                stack.length > 0
            ) {
                browserBack.current = true;

                dispatch(closeDialog());
            }
        };

        window.addEventListener(
            "popstate",
            handlePopState
        );

        return () => {
            window.removeEventListener(
                "popstate",
                handlePopState
            );
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