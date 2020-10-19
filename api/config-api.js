let config = {
	dynamodb: {
		looper_table: 'looper-development',
		rabbit_ttls: 'looper-rabbit',
	},
	env: 'DEV',
	base_loop_url: 'localhost:3000',
	base_api_url: 'localhost:3001',
	rabbit: {
		//amqp://user:pass@host.com/vhost
		url: 'localhost',
		admin_port: 15672,
		vhost: 'looper',
		user: 'loopadmin',
		// toDo: change testpass
		pass: 'testpass',
	}
}


export { config }