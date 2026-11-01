import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import Blocks from '../../containers/blocks.jsx';
import Alerts from '../../containers/alerts.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import PyApp from '../py-app/py-app.jsx';

import {Theme} from '../../lib/themes';

import styles from './gui.css';

const GUIComponent = props => {
    const {
        alertsVisible,
        basePath,
        blocksId,
        children,
        isCreating,
        isRtl,
        loading,
        theme,
        vm,
        ...componentProps
    } = omit(props, 'dispatch');

    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }

    return (
        <Box
            className={styles.pageWrapper}
            dir={isRtl ? 'rtl' : 'ltr'}
            {...componentProps}
        >
            {loading || isCreating ? <Loader isFullScreen /> : null}
            {alertsVisible ? <Alerts className={styles.alertsContainer} /> : null}
            <PyApp
                blocks={(
                    <Blocks
                        key={`${blocksId}/${theme.id}`}
                        grow={1}
                        isVisible
                        options={{
                            media: `${basePath}static/${theme.getBlocksMediaFolder()}/`
                        }}
                        stageSize="large"
                        theme={theme}
                        vm={vm}
                    />
                )}
                vm={vm}
            />
        </Box>
    );
};

GUIComponent.propTypes = {
    alertsVisible: PropTypes.bool,
    basePath: PropTypes.string,
    blocksId: PropTypes.string,
    children: PropTypes.node,
    isCreating: PropTypes.bool,
    isRtl: PropTypes.bool,
    loading: PropTypes.bool,
    theme: PropTypes.instanceOf(Theme),
    vm: PropTypes.instanceOf(VM).isRequired
};

GUIComponent.defaultProps = {
    basePath: './',
    blocksId: 'original',
    isCreating: false,
    loading: false
};

const mapStateToProps = state => ({
    // Ключ меняется, когда нужно пересоздать рабочую область
    blocksId: state.scratchGui.timeTravel.year.toString(),
    theme: state.scratchGui.theme.theme
});

export default connect(mapStateToProps)(GUIComponent);
