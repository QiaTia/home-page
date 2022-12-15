servePath=/www/qiatia/dist

#!/bin/bash
execSCP(){
  echo "==================== SyncFile ===================="
  scp -r -P 922 ./dist/** root@122.112.177.219:$servePath

  echo "==================== Done! ===================="
}

echo "==================== Build Code ===================="
yarn build
if [ $? -ne 0 ];then 
npm run build
if [ $? -ne 0 ];then 
  echo "Build Fail！"
else
execSCP
fi
else
  echo "====================yarn 打包完成===================="
execSCP
fi
