let config = {
    env: 'DEV',
    api:{
        url: 'localhost',
        port: 3000,
        path: ''
    },
    full_api_url:'http://localhost:3000/',
    ws_url:'ws://localhost:3000/ws',
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