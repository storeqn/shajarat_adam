import {cpSync,mkdirSync,rmSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});
for(const p of ['index.html','admin.html','style.css','app.js','manifest.json','admin-manifest.json','data','assets'])cpSync(p,'dist/'+p,{recursive:true});
