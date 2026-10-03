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

    // Флаг: назад пошел именно браузер/смартфон
    const browserBack = useRef(false);

    // СЧЕТЧИК: сколько событий popstate мы сами спровоцировали через history.go(-count)
    const expectedProgrammaticPops = useRef(0);

    /*
     * 1. Синхронизация Redux stack -> browser history.
     */
    useEffect(() => {
        const currentLength = stack.length;
        const previousLength = previousStackLength.current;

        // Открылись новые Dialog
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

        // Dialog закрылся
        if (currentLength < previousLength) {
            const count = previousLength - currentLength;

            if (browserBack.current) {
                // Закрытие пришло из popstate (физическая кнопка назад)
                browserBack.current = false;
                historyDepth.current = Math.max(0, historyDepth.current - count);
            } else {
                // Закрытие из UI (Крестик / Cancel / Save)
                historyDepth.current = Math.max(0, historyDepth.current - count);

                // Фиксируем, что следующие N событий popstate — наши технические
                expectedProgrammaticPops.current += count;

                window.history.go(-count);
            }
        }

        previousStackLength.current = currentLength;
    }, [stack.length]);

    /*
     * 2. Обработка системной кнопки Back / браузерной Back.
     */
    useEffect(() => {
        const handlePopState = () => {
            // Если это наш собственный программный переход — уменьшаем счетчик и игнорируем
            if (expectedProgrammaticPops.current > 0) {
                expectedProgrammaticPops.current -= 1;
                return;
            }

            // Если в истории есть наши диалоги и в редюсере что-то лежит
            if (historyDepth.current > 0 && stack.length > 0) {
                browserBack.current = true;
                dispatch(closeDialog());
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [dispatch, stack.length]); // stack.length в dependency необходим для актуального состояния в обработчике

    if (!dialog) {
        return null;
    }

    const Content = dialogContent[dialog.dialogType];

    if (!Content) {
        console.error(`Unknown dialog type: ${dialog.dialogType}`);
        return null;
    }

    return (
        <BendingDialog
            open
            title={dialog.title}
            value={dialog.draft}
            onChange={value => dispatch(updateDialogDraft(value))}
            onClose={() => dispatch(closeDialog())}
            onApply={value => dispatch(closeDialog({ value }))}
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
