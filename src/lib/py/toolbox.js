import {BLOCKS, CATEGORIES} from './defs';

const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const blockXML = block => {
    const inner = [];
    for (const part of block.parts) {
        for (const arg of part.args) {
            if (arg.k === 'value' && arg.shadow) {
                inner.push(`<value name="${arg.name}"><shadow type="${arg.shadow.shadow}">` +
                    `<field name="${arg.shadow.field}">${esc(arg.shadow.def)}</field></shadow></value>`);
            }
        }
    }
    return `<block type="${block.type}">${inner.join('')}</block>`;
};

const categoryXML = (category, blocks, colors) => {
    const c = colors[category.color] || colors.more;
    return `<category name="${esc(category.name)}" id="${category.id}" ` +
        `colour="${c.primary}" secondaryColour="${c.tertiary}">\n` +
        `${blocks.map(blockXML).join('\n')}\n</category>`;
};

/**
 * Тулбокс: каждая категория со всеми своими блоками, плюс общий список «Все блоки»,
 * где подряд лежит абсолютно каждый блок.
 * @param {object} colors - цвета блоков темы
 * @returns {string} XML тулбокса
 */
const makePyToolboxXML = colors => {
    const parts = CATEGORIES.map(category =>
        categoryXML(category, BLOCKS.filter(b => b.cat === category.id), colors));
    const all = {id: 'all', name: 'Все блоки', color: 'more'};
    parts.push(categoryXML(all, BLOCKS, colors));
    return `<xml style="display: none">\n${parts.join('\n<sep gap="36"/>\n')}\n</xml>`;
};

export default makePyToolboxXML;
