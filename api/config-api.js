let config = {
	dynamodb: {
		looper_table: 'looper-development',
		rabbit_ttls: 'looper-rabbit',
	},
	env: 'DEV',
	base_loop_url: 'localhost:3000',
	base_api_url: 'localhost:3001',
	newLoopIdentifier: 'xxxLOOPxxx',
	audioBucket: 'loop-audio',
	websockets: {
		url: 'localhost',
		port: 8080
	}
}


export { config }