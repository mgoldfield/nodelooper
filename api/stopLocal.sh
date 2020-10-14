brew services stop rabbitmq
kill `cat .node_api_pid` || true
rm .node_api_pid