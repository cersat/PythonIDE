import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import VM from 'scratch-vm';

import {onProgramChange} from '../../lib/py/workspace';
import {Session} from '../../lib/py/session';
import {drawCommand, resetCanvas} from '../../lib/py/gfx-canvas';
import Preview from './preview.jsx';

import styles from './py-app.css';

const PY_FILTERS = [{name: 'Python', extensions: ['py']}];
const PROJECT_FILTERS = [{name: 'Проект PythonIDE', extensions: ['pyide', 'sb3']}];

const downloadText = (name, text) => {
    const url = URL.createObjectURL(new Blob([text], {type: 'text/x-python'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
};

class PyApp extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            program: {code: '', usesGraphics: false},
            segments: [],
            running: false,
            gfxSeen: false,
            python: null
        };
        this.commands = [];
        this.canvas = null;
        this.bridge = typeof window === 'undefined' ? null : window.pyide;

        this.setCanvas = element => {
            this.canvas = element;
            if (element) {
                resetCanvas(element);
                this.commands.forEach(command => drawCommand(element, command));
            }
        };
        this.handleRun = this.handleRun.bind(this);
        this.handleStop = this.handleStop.bind(this);
        this.handleSubmitInput = this.handleSubmitInput.bind(this);
        this.handleSavePy = this.handleSavePy.bind(this);
        this.handleSaveProject = this.handleSaveProject.bind(this);
        this.handleOpenProject = this.handleOpenProject.bind(this);
    }

    componentDidMount () {
        this.unsubscribeProgram = onProgramChange(program => this.setState({program}));
        if (this.bridge) {
            this.session = new Session(this.bridge, {
                onStart: () => {
                    this.commands = [];
                    if (this.canvas) resetCanvas(this.canvas);
                    this.setState({segments: [], running: true, gfxSeen: false});
                },
                onText: ({stream, text}) => this.appendText(stream, text),
                onGfx: command => {
                    this.commands.push(command);
                    if (this.canvas) drawCommand(this.canvas, command);
                    if (!this.state.gfxSeen) this.setState({gfxSeen: true});
                },
                onExit: ({code}) => {
                    this.appendText('info', `\n[программа завершена, код ${code === null ? '—' : code}]\n`);
                    this.setState({running: false});
                }
            });
            this.bridge.pythonInfo().then(python => this.setState({python}));
        }
    }

    componentWillUnmount () {
        this.unsubscribeProgram();
        if (this.session) {
            this.session.stop();
            this.session.dispose();
        }
    }

    appendText (stream, text) {
        this.setState(state => {
            const segments = state.segments.slice();
            const last = segments[segments.length - 1];
            if (last && last.stream === stream) {
                segments[segments.length - 1] = {stream, text: last.text + text};
            } else {
                segments.push({stream, text});
            }
            return {segments};
        });
    }

    handleRun () {
        this.session.run(this.state.program.code);
    }

    handleStop () {
        this.session.stop();
    }

    handleSubmitInput (text) {
        this.appendText('input', `${text}\n`);
        this.session.input(text);
    }

    async handleSavePy () {
        const {code} = this.state.program;
        if (this.bridge) {
            await this.bridge.saveFile({defaultName: 'program.py', filters: PY_FILTERS, data: code});
        } else {
            downloadText('program.py', code);
        }
    }

    async handleSaveProject () {
        if (!this.bridge) {
            this.appendText('info', 'Сохранение проекта работает только в приложении.\n');
            return;
        }
        try {
            const data = await this.props.vm.saveProjectSb3('arraybuffer');
            await this.bridge.saveFile({defaultName: 'project.pyide', filters: PROJECT_FILTERS, data});
        } catch (e) {
            this.appendText('stderr', `Не удалось сохранить проект: ${e.message}\n`);
        }
    }

    async handleOpenProject () {
        if (!this.bridge) {
            this.appendText('info', 'Открытие проекта работает только в приложении.\n');
            return;
        }
        try {
            const file = await this.bridge.openFile({filters: PROJECT_FILTERS});
            if (file) await this.props.vm.loadProject(file.data);
        } catch (e) {
            this.appendText('stderr', `Не удалось открыть проект: ${e.message}\n`);
        }
    }

    render () {
        const {blocks} = this.props;
        const {program, segments, running, gfxSeen, python} = this.state;
        const canRun = Boolean(this.bridge) && Boolean(python && python.found) && !running && program.code.length > 0;
        let pythonStatus = 'Запуск доступен только в приложении';
        if (this.bridge && python) pythonStatus = python.found ? python.version : 'Python не найден';
        return (
            <div className={styles.root}>
                <div className={styles.toolbar}>
                    <span className={styles.title}>{'PythonIDE'}</span>
                    <button
                        className={classNames(styles.button, styles.run)}
                        disabled={!canRun}
                        onClick={this.handleRun}
                    >{'▶ Запустить'}</button>
                    <button
                        className={classNames(styles.button, styles.stop)}
                        disabled={!running}
                        onClick={this.handleStop}
                    >{'■ Стоп'}</button>
                    <span className={styles.separator} />
                    <button
                        className={styles.button}
                        disabled={program.code.length === 0}
                        onClick={this.handleSavePy}
                    >{'Сохранить .py'}</button>
                    <button
                        className={styles.button}
                        onClick={this.handleSaveProject}
                    >{'Сохранить проект'}</button>
                    <button
                        className={styles.button}
                        onClick={this.handleOpenProject}
                    >{'Открыть проект'}</button>
                    <span className={styles.spacer} />
                    <span
                        className={classNames(styles.pythonStatus, python && !python.found && styles.pythonMissing)}
                    >{pythonStatus}</span>
                </div>
                <div className={styles.body}>
                    <div className={styles.blocks}>{blocks}</div>
                    <div className={styles.side}>
                        <div className={styles.panel}>
                            <div className={styles.panelTitle}>{'Превью'}</div>
                            <Preview
                                canvasRef={this.setCanvas}
                                graphics={program.usesGraphics || gfxSeen}
                                running={running}
                                segments={segments}
                                onSubmitInput={this.handleSubmitInput}
                            />
                        </div>
                        <div className={styles.panel}>
                            <div className={styles.panelTitle}>{'Python-код'}</div>
                            <pre className={styles.code}>
                                {program.code || '# Собери программу из блоков — код появится здесь\n'}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

PyApp.propTypes = {
    blocks: PropTypes.node,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default PyApp;
