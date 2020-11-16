let config = {
    env: 'PROD',
    api:{
        url: 'loopmagic.live',
        port: 443,
        path: ''
    },
    ws_url:'wss://loopmagic.live/ws',
    newLoopIdentifier:'xxxLOOPxxx',
    msgDivider:'|||',
    audioBucket: 'loop-audio',
    lossyCompress: true,
};

export default config;