brew services start rabbitmq
node api.js &
echo "$!" > .node_api_pid