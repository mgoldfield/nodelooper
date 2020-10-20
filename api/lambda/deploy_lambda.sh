zip -j fn.zip deleteLooperUsersAndQueues/*
aws lambda update-function-code --publish --zip-file fileb://fn.zip --function-name arn:aws:lambda:us-east-1:101444218054:function:deleteLooperUsersAndQueues
rm fn.zip
# toDo: update prod alias to new fn... to tired to do it now