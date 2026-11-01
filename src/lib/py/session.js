/**
 * Запуск программы и разбор её вывода: обычный текст идёт в терминал,
 * строки с особым префиксом (их печатает pyide_gfx.py) — команды рисования для холста.
 */

export const MARKER = '\u001epyide-gfx:';

const textEvent = (stream, text) => ({type: 'text', stream, text: text.replace(/\r\n/g, '\n')});

export class OutputParser {
    constructor () {
        this.buffer = '';
        this.midLine = false;
    }

    /**
     * @param {string} chunk - очередной кусок stdout
     * @returns {Array} события {type: 'text', stream, text} и {type: 'gfx', command}
     */
    push (chunk) {
        const events = [];
        this.buffer += chunk;
        for (;;) {
            if (this.midLine) {
                const end = this.buffer.indexOf('\n');
                if (end < 0) {
                    if (this.buffer) events.push(textEvent('stdout', this.buffer));
                    this.buffer = '';
                    break;
                }
                events.push(textEvent('stdout', this.buffer.slice(0, end + 1)));
                this.buffer = this.buffer.slice(end + 1);
                this.midLine = false;
                continue;
            }
            if (this.buffer.startsWith(MARKER)) {
                const end = this.buffer.indexOf('\n');
                if (end < 0) break; // команда пришла не целиком
                const json = this.buffer.slice(MARKER.length, end);
                this.buffer = this.buffer.slice(end + 1);
                try {
                    events.push({type: 'gfx', command: JSON.parse(json)});
                } catch (e) {
                    events.push(textEvent('stdout', `${MARKER}${json}\n`));
                }
                continue;
            }
            // начало строки ещё может оказаться префиксом команды — ждём остаток
            if (this.buffer.length < MARKER.length && MARKER.startsWith(this.buffer)) break;
            this.midLine = true;
        }
        return events;
    }
}

/**
 * Сеанс запуска: связывает мост приложения (window.pyide) с обработчиками интерфейса.
 */
export class Session {
    /**
     * @param {object} bridge - window.pyide
     * @param {{onText: function, onGfx: function, onStart: function, onExit: function}} handlers - обработчики
     */
    constructor (bridge, handlers) {
        this.bridge = bridge;
        this.handlers = handlers;
        this.parser = new OutputParser();
        this.unsubscribe = [
            bridge.onData(({stream, text}) => this.handleData(stream, text)),
            bridge.onExit(info => handlers.onExit(info))
        ];
    }

    handleData (stream, text) {
        if (stream !== 'stdout') {
            this.handlers.onText({stream, text: text.replace(/\r\n/g, '\n')});
            return;
        }
        for (const event of this.parser.push(text)) {
            if (event.type === 'gfx') this.handlers.onGfx(event.command);
            else this.handlers.onText(event);
        }
    }

    async run (code) {
        this.parser = new OutputParser();
        this.handlers.onStart();
        const result = await this.bridge.run(code);
        if (!result.started) {
            this.handlers.onText({stream: 'stderr', text: `${result.error}\n`});
            this.handlers.onExit({code: null, signal: null});
        }
    }

    input (text) {
        return this.bridge.sendInput(text);
    }

    stop () {
        return this.bridge.stop();
    }

    dispose () {
        this.unsubscribe.forEach(fn => fn());
    }
}
