brew services start rabbitmq
sleep 1

# toDo: change testpass
rabbitmqctl await_startup
rabbitmqctl delete_user 'guest'
rabbitmqctl add_user 'loopadmin' 'testpass'
rabbitmqctl add_vhost 'looper'
rabbitmqctl set_permissions -p 'looper' 'loopadmin' ".*" ".*" ".*"
rabbitmqctl set_user_tags 'loopadmin' 'administrator'

node api.js &
echo "$!" > .node_api_pid