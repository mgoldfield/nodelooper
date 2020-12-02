let config = {
	dynamodb: {
		looper_table: 'looper-development',
		socket_ids: 'msg-groups',
		backoff_tries: 5,
		chat_table: 'loopmagic-chat',		
	},
	aws:{
		region: 'us-east-1',
		role: 'arn:aws:iam::101444218054:instance-profile/loopmagic-server',
	},
	env: 'DEV',
	base_loop_url: 'http://localhost:3000/project',
	base_api_url: 'http://localhost:3001',
	newLoopIdentifier: 'xxxLOOPxxx',
	project_persist: 432000,
	s3: {
		audioBucket: 'loop-audio',
		backoff_tries: 5,
	},
	websockets: {
		url: 'localhost',
		port: 3002,
		timeout: 900000, // 15 minutes in milliseconds
	},
}


export { config }