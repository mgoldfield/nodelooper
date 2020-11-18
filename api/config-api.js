let config = {
	dynamodb: {
		looper_table: 'looper-development',
		socket_ids: 'msg-groups',
		backoff_tries: 5,
	},
	aws:{
		region: 'us-east-1',
		role: 'arn:aws:iam::101444218054:instance-profile/loopmagic-server',
	},
	env: 'DEV',
	base_loop_url: 'http://localhost/project',
	base_api_url: 'http://localhost',
	newLoopIdentifier: 'xxxLOOPxxx',
	project_persist: 432000,
	s3: {
		audioBucket: 'loop-audio',
		backoff_tries: 5,
	},
	websockets: {
		url: 'localhost',
		port: 8080,
		timeout: 900000, // 15 minutes in milliseconds
	},
	max:{
		loops: 50,
		length: 600, // 10 minutes	
	}
}


export { config }