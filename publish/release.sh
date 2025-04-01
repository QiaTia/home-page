servePath=/www/qiatia/dist

#!/bin/bash
execSCP(){
  node ./publish/setup.js
  # echo "==================== SyncFile ===================="
#  scp -r -P 922 ./dist/** root@122.112.177.219:$servePath
#  服务器过期
  echo "==================== Done! ===================="
}

echo "==================== Build Code ===================="

npx vite build
if [ $? -ne 0 ];then 
  echo "Build Fail！"
else
  echo "====================打包完成===================="
execSCP
fi
