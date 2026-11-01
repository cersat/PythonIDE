import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import styles from './py-app.css';

/**
 * Превью: терминал, если программа ничего не рисует, и холст (с маленьким терминалом под ним), если рисует.
 */
class Preview extends React.Component {
    constructor (props) {
        super(props);
        this.state = {value: ''};
        this.handleChange = e => this.setState({value: e.target.value});
        this.handleKeyDown = e => {
            if (e.key !== 'Enter') return;
            this.props.onSubmitInput(this.state.value);
            this.setState({value: ''});
        };
    }

    componentDidUpdate () {
        const output = this.output;
        if (output) output.scrollTop = output.scrollHeight;
    }

    render () {
        const {segments, graphics, running, canvasRef} = this.props;
        const terminal = (
            <div className={classNames(styles.terminal, graphics && styles.terminalCompact)}>
                <pre
                    className={styles.output}
                    ref={element => {
                        this.output = element;
                    }}
                >
                    {segments.length === 0 ? (
                        <span className={styles.hint}>{'Нажми «Запустить» — вывод программы появится здесь'}</span>
                    ) : segments.map((segment, i) => (
                        <span
                            className={classNames(
                                segment.stream === 'stderr' && styles.stderr,
                                segment.stream === 'input' && styles.echo,
                                segment.stream === 'info' && styles.hint
                            )}
                            key={i}
                        >
                            {segment.text}
                        </span>
                    ))}
                </pre>
                <div className={styles.inputRow}>
                    <input
                        className={styles.input}
                        disabled={!running}
                        placeholder={running ? 'Ввод для input() — Enter отправляет' : 'Программа не запущена'}
                        value={this.state.value}
                        onChange={this.handleChange}
                        onKeyDown={this.handleKeyDown}
                    />
                </div>
            </div>
        );

        return (
            <React.Fragment>
                {graphics ? (
                    <div className={styles.canvasWrap}>
                        <canvas
                            className={styles.canvas}
                            ref={canvasRef}
                        />
                    </div>
                ) : null}
                {terminal}
            </React.Fragment>
        );
    }
}

Preview.propTypes = {
    canvasRef: PropTypes.func,
    graphics: PropTypes.bool,
    onSubmitInput: PropTypes.func,
    running: PropTypes.bool,
    segments: PropTypes.arrayOf(PropTypes.shape({
        stream: PropTypes.string,
        text: PropTypes.string
    }))
};

export default Preview;
