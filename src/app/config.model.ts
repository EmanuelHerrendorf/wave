export default {
    MAPPING_URL: '/cgi-bin/mapping',
    WMS: {
        VERSION: '1.3.0',
        FORMAT: 'image/png',
    },
    WFS: {
        VERSION: '2.0.0',
        FORMAT: 'application/json',
    },
    WCS: {
        SERVICE: 'WCS',
        VERSION: '2.0.1',
    },
    DEVELOPER_MODE: true,
    MAPPING_DEBUG_MODE: false,
    USER: {
        GUEST: {
            NAME: 'guest',
            PASSWORD: 'guest',
        },
    },
    COLORS: {
        DEFAULT: 'whitesmoke',
        PRIMARY: '#009688',
        ACCENT: '#9c27b0',
        WARN: '#f44336',
        TEXT: {
            DEFAULT: 'rgba(0, 0, 0, 0.87)',
            PRIMARY: 'rgba(255, 255, 255, 0.870588)',
            ACCENT: 'rgba(255, 255, 255, 0.870588)',
            WARN: 'rgba(255, 255, 255, 0.870588)',
        },
    },
    DELAYS: {
        LOADING: {
            MIN: 500,
        },
        DEBOUNCE: 400,
    },
};