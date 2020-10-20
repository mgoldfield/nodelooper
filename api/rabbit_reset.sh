rabbitmqctl stop_app
sleep 5
rabbitmqctl reset
./stopLocal.sh
./startLocal.sh