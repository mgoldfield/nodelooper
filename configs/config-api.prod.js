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
	env: 'PROD',
	base_loop_url: 'https://project.loopmagic.live',
	base_api_url: 'https://loopmagic.live',
	newLoopIdentifier: 'xxxLOOPxxx',
	project_persist: 43200000, // 500 days
	ssl: {
		key: '/etc/letsencrypt/live/loopmagic.live/privkey.pem',
		cert: '/etc/letsencrypt/live/loopmagic.live/cert.pem'
	},
	s3: {
		audioBucket: 'loop-audio',
		backoff_tries: 5,
	},
	websockets: {
		url: 'loopmagic.live',
		port: 3002,
		timeout: 900000, // 15 minutes in milliseconds
	},
}


export { config }