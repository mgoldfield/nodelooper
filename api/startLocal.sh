brew services start rabbitmq
sleep 5

# toDo: change testpass
# toDo: create cluster
rabbitmqctl await_startup
rabbitmqctl delete_user 'guest'
rabbitmqctl add_user 'loopadmin' 'testpass'
rabbitmqctl add_vhost 'looper'
rabbitmqctl set_permissions -p 'looper' 'loopadmin' ".*" ".*" ".*"
rabbitmqctl set_user_tags 'loopadmin' 'administrator'

node api.js &
echo "$!" > .node_api_pid