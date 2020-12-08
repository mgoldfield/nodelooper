if [ "$1" = "prod" ]; then
    cp configs/config-app.prod.js app/src/config-app.js
    cp configs/config-api.prod.js api/config-api.js
elif [ "$1" = "dev" ]; then
    cp configs/config-app.js app/src/config-app.js
    cp configs/config-api.js api/config-api.js
elif [ "$1" = "local" ]; then
    cp configs/config-app.local.js app/src/config-app.js
    cp configs/config-api.local.js api/config-api.js
else
    echo "unknown environment"
fi

