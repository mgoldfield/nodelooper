kill `cat .node_api_pid` || true
node api.js &
echo "$!" > .node_api_pid