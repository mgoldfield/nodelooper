let config = {
	dynamodb: {
		looper_table: 'looper-development',
		socket_ids: 'msg-groups',
		backoff_tries: 5,
	},
	env: 'DEV',
	base_loop_url: 'localhost:3000',
	base_api_url: 'localhost:3001',
	newLoopIdentifier: 'xxxLOOPxxx',
	s3: {
		audioBucket: 'loop-audio',
		backoff_tries: 5,
	},
	websockets: {
		url: 'localhost',
		port: 8080,
		timeout: 900000, // 15 minutes in milliseconds
	}
}


export { config }