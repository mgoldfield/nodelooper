let config = {
    env: 'DEV',
    api:{
        url: 'localhost',
        port: 80,
        path: ''
    },
    full_api_url:'http://localhost/',
    ws_url:'ws://localhost/ws',
    newLoopIdentifier:'xxxLOOPxxx',
    msgDivider:'|||',
    audioBucket: 'loop-audio',
    lossyCompress: true,
    limits: {
        loops: 50,
        length: 600, // 10 minutes  
    },      
};

export default config;