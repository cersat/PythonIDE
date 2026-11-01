import {generatePython} from './generator';

let workspace = null;
let timer = null;
const listeners = new Set();

const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        const program = getProgram(); // eslint-disable-line no-use-before-define
        listeners.forEach(listener => listener(program));
    }, 150);
};

/**
 * Запоминает рабочую область scratch-blocks, из которой строится Python-код.
 * @param {object} newWorkspace - рабочая область
 */
export const setWorkspace = newWorkspace => {
    workspace = newWorkspace;
    workspace.addChangeListener(event => {
        if (!event.isUi) notify();
    });
    notify();
};

/**
 * @returns {{code: string, usesGraphics: boolean}} текущая программа
 */
export const getProgram = () => {
    if (!workspace) return {code: '', usesGraphics: false};
    return generatePython(workspace.getTopBlocks(true));
};

/**
 * @param {function} listener - вызывается с программой после каждого изменения блоков
 * @returns {function} отписка
 */
export const onProgramChange = listener => {
    listeners.add(listener);
    listener(getProgram());
    return () => listeners.delete(listener);
};
