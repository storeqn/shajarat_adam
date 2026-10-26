import {cpSync,mkdirSync,rmSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});
for(const p of ['index.html','style.css','app.js','manifest.json','data','assets'])cpSync(p,'dist/'+p,{recursive:true});
