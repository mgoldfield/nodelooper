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
	base_loop_url: '/project',
	base_api_url: 'loopmagic.live',
	newLoopIdentifier: 'xxxLOOPxxx',
	s3: {
		audioBucket: 'loop-audio',
		backoff_tries: 5,
	},
	websockets: {
		url: 'loopmagic.live',
		port: 8080,
		timeout: 900000, // 15 minutes in milliseconds
	}
}


export { config }