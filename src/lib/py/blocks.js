import {BLOCKS, CATEGORIES} from './defs';

const SHAPES = {
    statement: ['shape_statement'],
    end: ['shape_end'],
    hat: ['shape_hat'],
    reporter: ['output_string'],
    boolean: ['output_boolean']
};

const argToJson = arg => {
    switch (arg.k) {
    case 'value':
        return {type: 'input_value', name: arg.name};
    case 'bool':
        return {type: 'input_value', name: arg.name, check: 'Boolean'};
    case 'field':
        return {type: 'field_input', name: arg.name, text: arg.def};
    case 'dropdown':
        return {type: 'field_dropdown', name: arg.name, options: arg.options};
    case 'stack':
        return {type: 'input_statement', name: arg.name};
    default:
        throw new Error(`Неизвестный тип аргумента: ${arg.k}`);
    }
};

const jsonForBlock = block => {
    const category = CATEGORIES.find(c => c.id === block.cat);
    const json = {
        extensions: [category.extension].concat(SHAPES[block.shape])
    };
    block.parts.forEach((part, i) => {
        json[`message${i}`] = part.message;
        if (part.args.length) {
            json[`args${i}`] = part.args.map(argToJson);
        }
    });
    return json;
};

/**
 * Регистрирует все Python-блоки в scratch-blocks.
 * @param {object} ScratchBlocks - загруженный scratch-blocks
 */
export default function registerPyBlocks (ScratchBlocks) {
    for (const block of BLOCKS) {
        const json = jsonForBlock(block);
        ScratchBlocks.Blocks[block.type] = {
            init: function () {
                this.jsonInit(json);
            }
        };
    }
}
