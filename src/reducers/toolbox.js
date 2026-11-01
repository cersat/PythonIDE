const UPDATE_TOOLBOX = 'scratch-gui/toolbox/UPDATE_TOOLBOX';
import makePyToolboxXML from '../lib/py/toolbox';
import {defaultBlockColors} from '../lib/themes';

const initialState = {
    toolboxXML: makePyToolboxXML(defaultBlockColors)
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE_TOOLBOX:
        return Object.assign({}, state, {
            toolboxXML: action.toolboxXML
        });
    default:
        return state;
    }
};

const updateToolbox = function (toolboxXML) {
    return {
        type: UPDATE_TOOLBOX,
        toolboxXML: toolboxXML
    };
};

export {
    reducer as default,
    initialState as toolboxInitialState,
    updateToolbox
};
