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

if ! npx vite build; then
  echo "Build Fail！"
  exit 1
fi

echo "====================打包完成===================="
execSCP
