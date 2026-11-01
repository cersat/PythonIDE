export const DEFAULT_WIDTH = 400;
export const DEFAULT_HEIGHT = 300;

const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Сбрасывает холст в исходное состояние.
 * @param {HTMLCanvasElement} canvas - холст превью
 */
export const resetCanvas = canvas => {
    canvas.width = DEFAULT_WIDTH;
    canvas.height = DEFAULT_HEIGHT;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
};

/**
 * Выполняет одну команду рисования из pyide_gfx.
 * @param {HTMLCanvasElement} canvas - холст превью
 * @param {object} command - команда {k, ...параметры}
 */
export const drawCommand = (canvas, command) => {
    const context = canvas.getContext('2d');
    switch (command.k) {
    case 'size':
        canvas.width = Math.max(1, Math.min(4096, num(command.w)));
        canvas.height = Math.max(1, Math.min(4096, num(command.h)));
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        break;
    case 'clear':
        context.fillStyle = command.color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        break;
    case 'circle':
        context.fillStyle = command.color;
        context.beginPath();
        context.arc(num(command.x), num(command.y), Math.max(0, num(command.r)), 0, Math.PI * 2);
        context.fill();
        break;
    case 'rect':
        context.fillStyle = command.color;
        context.fillRect(num(command.x), num(command.y), num(command.w), num(command.h));
        break;
    case 'line':
        context.strokeStyle = command.color;
        context.lineWidth = Math.max(0, num(command.width));
        context.beginPath();
        context.moveTo(num(command.x1), num(command.y1));
        context.lineTo(num(command.x2), num(command.y2));
        context.stroke();
        break;
    case 'text':
        context.fillStyle = command.color;
        context.font = `${Math.max(1, num(command.size))}px sans-serif`;
        context.fillText(String(command.text), num(command.x), num(command.y));
        break;
    }
};
