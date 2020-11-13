let config = {
    env: 'DEV',
    api:{
        url: 'localhost',
        port: 3000,
        path: '/api'
    },
    ws_url:'ws://localhost:3000/ws',
    newLoopIdentifier:'xxxLOOPxxx',
    msgDivider:'|||',
    audioBucket: 'loop-audio',
    lossyCompress: true,
};

export default config;