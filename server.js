import http from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/domain.js':'domain.js'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404).end('Not found');return}try{res.setHeader('Content-Type',types[file.split('.').pop()]);res.setHeader('X-Content-Type-Options','nosniff');res.end(await readFile(new URL(file,import.meta.url)))}catch{res.writeHead(500).end('Server error')}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Zakher running on port '+(process.env.PORT||3000)));
