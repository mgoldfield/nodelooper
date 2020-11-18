let config = {
    env: 'PROD',
    api:{
        url: 'loopmagic.live',
        port: 443,
        path: ''
    },
    full_api_url:'https://loopmagic.live/',
    ws_url:'wss://loopmagic.live/ws',
    newLoopIdentifier:'xxxLOOPxxx',
    msgDivider:'|||',
    audioBucket: 'loop-audio',
    lossyCompress: true,
    limits:{
        loops: 50,
        length: 600, // 10 minutes  
    },    
};

export default config;