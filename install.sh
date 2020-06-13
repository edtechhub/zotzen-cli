git submodule update --init --recursive
cd zotero-cli
npm install
npm run build
cd ..
cd zenodo-cli
pip3 install -r requirements.txt
cd ..
npm install
node zotzen.js --install
