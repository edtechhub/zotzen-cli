#git submodule update --init --recursive
cd zotero-cli
npm install
npm build run
cd ..
cd zenodo-cli
pip3 install -r requirements.txt
cd ..
