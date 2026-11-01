/**
 * Генератор Python-кода из блоков.
 * Работает с минимальным интерфейсом блока Blockly:
 * type, getFieldValue(name), getInputTargetBlock(name), getNextBlock().
 */

const INDENT = '\t';

const KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
    'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
    'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
]);

export const ident = name => {
    let result = String(name === null || name === undefined ? '' : name)
        .trim()
        .replace(/[^\p{L}\p{Nd}_]/gu, '_');
    if (!result) result = '_';
    if (/^\p{Nd}/u.test(result)) result = `_${result}`;
    if (KEYWORDS.has(result)) result = `${result}_`;
    return result;
};

const pyString = value => JSON.stringify(String(value === null || value === undefined ? '' : value));

const oneLine = value => String(value === null || value === undefined ? '' : value).replace(/[\r\n]+/g, ' ').trim();

const pyNumber = value => {
    const text = String(value === null || value === undefined ? '' : value).trim().replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return '0';
    return text.startsWith('-') ? `(${text})` : text;
};

const indent = lines => lines.map(line => INDENT + line);

class Context {
    constructor () {
        this.imports = new Set();
        this.graphics = false;
    }
}

const field = (block, name) => block.getFieldValue(name);

const expression = (block, name, ctx, fallback = 'None') => {
    const target = block.getInputTargetBlock(name);
    if (!target) return fallback;
    return generateExpression(target, ctx); // eslint-disable-line no-use-before-define
};

const body = (block, name, ctx) => {
    const lines = generateStack(block.getInputTargetBlock(name), ctx); // eslint-disable-line no-use-before-define
    return indent(lines.length ? lines : ['pass']);
};

const EXPRESSIONS = {
    // базовые значения (тени тоже блоки)
    text: (b) => pyString(field(b, 'TEXT')),
    math_number: (b) => pyNumber(field(b, 'NUM')),
    py_input: (b, ctx) => `input(${expression(b, 'PROMPT', ctx, '""')})`,
    py_var: b => ident(field(b, 'NAME')),
    py_math: (b, ctx) => `(${expression(b, 'A', ctx, '0')} ${field(b, 'OP')} ${expression(b, 'B', ctx, '0')})`,
    py_compare: (b, ctx) => `(${expression(b, 'A', ctx, '0')} ${field(b, 'OP')} ${expression(b, 'B', ctx, '0')})`,
    py_and: (b, ctx) => `(${expression(b, 'A', ctx, 'False')} and ${expression(b, 'B', ctx, 'False')})`,
    py_or: (b, ctx) => `(${expression(b, 'A', ctx, 'False')} or ${expression(b, 'B', ctx, 'False')})`,
    py_not: (b, ctx) => `(not ${expression(b, 'A', ctx, 'False')})`,
    py_bool: b => (field(b, 'VAL') === 'False' ? 'False' : 'True'),
    py_none: () => 'None',
    py_in: (b, ctx) => `(${expression(b, 'A', ctx, '""')} in ${expression(b, 'B', ctx, '""')})`,
    py_join: (b, ctx) => `(str(${expression(b, 'A', ctx, '""')}) + str(${expression(b, 'B', ctx, '""')}))`,
    py_func1: (b, ctx) => `${field(b, 'FUNC')}(${expression(b, 'VALUE', ctx)})`,
    py_mathfn: (b, ctx) => {
        ctx.imports.add('math');
        return `math.${field(b, 'FUNC')}(${expression(b, 'VALUE', ctx, '0')})`;
    },
    py_random: (b, ctx) => {
        ctx.imports.add('random');
        return `random.randint(${expression(b, 'A', ctx, '0')}, ${expression(b, 'B', ctx, '0')})`;
    },
    py_range: (b, ctx) => `range(${expression(b, 'A', ctx, '0')}, ${expression(b, 'B', ctx, '0')})`,
    py_strmethod: (b, ctx) => `${expression(b, 'OBJ', ctx, '""')}.${field(b, 'METHOD')}()`,
    py_list: b => `[${oneLine(field(b, 'ITEMS'))}]`,
    py_dict: b => `{${oneLine(field(b, 'ITEMS'))}}`,
    py_getitem: (b, ctx) => `${expression(b, 'OBJ', ctx)}[${expression(b, 'KEY', ctx, '0')}]`,
    py_callr: b => `${ident(field(b, 'NAME'))}(${oneLine(field(b, 'ARGS'))})`,
    py_expr: b => oneLine(field(b, 'CODE')) || 'None'
};

const gfxCall = (name, args) => `gfx.${name}(${args.join(', ')})`;

const STATEMENTS = {
    py_print: (b, ctx) => [`print(${expression(b, 'VALUE', ctx, '""')})`],
    py_comment: b => [`# ${oneLine(field(b, 'TEXT'))}`],
    py_set: (b, ctx) => [`${ident(field(b, 'NAME'))} = ${expression(b, 'VALUE', ctx, '0')}`],
    py_change: (b, ctx) => [`${ident(field(b, 'NAME'))} += ${expression(b, 'VALUE', ctx, '1')}`],
    py_if: (b, ctx) => [`if ${expression(b, 'COND', ctx, 'False')}:`, ...body(b, 'SUBSTACK', ctx)],
    py_ifelse: (b, ctx) => [
        `if ${expression(b, 'COND', ctx, 'False')}:`, ...body(b, 'SUBSTACK', ctx),
        'else:', ...body(b, 'SUBSTACK2', ctx)
    ],
    py_while: (b, ctx) => [`while ${expression(b, 'COND', ctx, 'False')}:`, ...body(b, 'SUBSTACK', ctx)],
    py_for_range: (b, ctx) => [
        `for ${ident(field(b, 'VAR'))} in range(${expression(b, 'FROM', ctx, '0')}, ${expression(b, 'TO', ctx, '0')}):`,
        ...body(b, 'SUBSTACK', ctx)
    ],
    py_for_each: (b, ctx) => [
        `for ${ident(field(b, 'VAR'))} in ${expression(b, 'ITER', ctx, '[]')}:`,
        ...body(b, 'SUBSTACK', ctx)
    ],
    py_try: (b, ctx) => [
        'try:', ...body(b, 'SUBSTACK', ctx),
        'except Exception:', ...body(b, 'SUBSTACK2', ctx)
    ],
    py_break: () => ['break'],
    py_continue: () => ['continue'],
    py_return: (b, ctx) => [`return ${expression(b, 'VALUE', ctx)}`],
    py_pass: () => ['pass'],
    py_setitem: (b, ctx) => [`${expression(b, 'OBJ', ctx)}[${expression(b, 'KEY', ctx, '0')}] = ${expression(b, 'VALUE', ctx)}`],
    py_append: (b, ctx) => [`${expression(b, 'LIST', ctx, '[]')}.append(${expression(b, 'VALUE', ctx)})`],
    py_call: b => [`${ident(field(b, 'NAME'))}(${oneLine(field(b, 'ARGS'))})`],
    py_import: (b, ctx) => {
        const module = String(field(b, 'MODULE') || '').trim().replace(/[^\p{L}\p{Nd}_.]/gu, '');
        if (module) ctx.imports.add(module);
        return [];
    },
    py_sleep: (b, ctx) => {
        ctx.imports.add('time');
        return [`time.sleep(${expression(b, 'SECS', ctx, '1')})`];
    },
    py_exec: b => String(field(b, 'CODE') || '').split(/\r?\n/).filter(line => line.trim()),
    gfx_size: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('size', [expression(b, 'W', ctx, '400'), expression(b, 'H', ctx, '300')])];
    },
    gfx_clear: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('clear', [expression(b, 'COLOR', ctx, '"white"')])];
    },
    gfx_circle: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('circle', ['X', 'Y', 'R', 'COLOR'].map(n => expression(b, n, ctx, n === 'COLOR' ? '"black"' : '0')))];
    },
    gfx_rect: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('rect', ['X', 'Y', 'W', 'H', 'COLOR'].map(n => expression(b, n, ctx, n === 'COLOR' ? '"black"' : '0')))];
    },
    gfx_line: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('line', ['X1', 'Y1', 'X2', 'Y2', 'COLOR', 'WIDTH']
            .map(n => expression(b, n, ctx, n === 'COLOR' ? '"black"' : '1')))];
    },
    gfx_text: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('text', ['TEXT', 'X', 'Y', 'COLOR', 'SIZE']
            .map(n => expression(b, n, ctx, n === 'COLOR' ? '"black"' : (n === 'TEXT' ? '""' : '0'))))];
    },
    gfx_wait: (b, ctx) => {
        ctx.graphics = true;
        return [gfxCall('wait', [expression(b, 'SECS', ctx, '0.05')])];
    }
};

function generateExpression (block, ctx) {
    const fn = EXPRESSIONS[block.type];
    if (!fn) return `None  # неподдерживаемый блок: ${block.type}`;
    return fn(block, ctx);
}

function generateStack (first, ctx) {
    const lines = [];
    for (let block = first; block; block = block.getNextBlock()) {
        const fn = STATEMENTS[block.type];
        if (fn) {
            lines.push(...fn(block, ctx));
        } else if (!EXPRESSIONS[block.type]) {
            lines.push(`# неподдерживаемый блок: ${block.type}`);
        }
    }
    return lines;
}

/**
 * @param {Array} topBlocks - верхние блоки рабочей области (в порядке сверху вниз)
 * @returns {{code: string, usesGraphics: boolean}} готовая программа
 */
export const generatePython = topBlocks => {
    const ctx = new Context();
    const functions = [];
    const main = [];

    for (const top of topBlocks) {
        if (top.type === 'py_def') {
            const lines = generateStack(top.getNextBlock(), ctx);
            functions.push(`def ${ident(field(top, 'NAME'))}(${oneLine(field(top, 'PARAMS'))}):`);
            functions.push(...indent(lines.length ? lines : ['pass']));
        } else if (STATEMENTS[top.type]) {
            main.push(...generateStack(top, ctx));
        }
    }

    const header = [];
    if (ctx.graphics) header.push('import pyide_gfx as gfx');
    header.push(...Array.from(ctx.imports).sort().map(name => `import ${name}`));

    const sections = [header, functions, main].filter(section => section.length);
    const code = sections.map(section => section.join('\n')).join('\n\n');
    return {code: code ? `${code}\n` : '', usesGraphics: ctx.graphics};
};
