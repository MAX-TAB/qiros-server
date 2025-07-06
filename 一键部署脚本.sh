#!/bin/bash
echo "正在进入 qiros-server 目录..."
cd "$(dirname "$0")" || exit
echo "正在执行 npm install..."
npm install
if [ $? -ne 0 ]; then
    echo "npm install 失败，请检查错误信息。"
    exit 1
fi
echo "正在执行 npm run build..."
npm run build
if [ $? -ne 0 ]; then
    echo "npm run build 失败，请检查错误信息。"
    exit 1
fi
echo "部署完成！"