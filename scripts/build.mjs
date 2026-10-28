import {cpSync,mkdirSync,rmSync} from 'node:fs';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});
for(const p of ['index.html','admin.html','style.css','app.js','viewport.js','store.js','admin.js','enhancements.css','admin.css','sw.js','_headers','robots.txt','sitemap.xml','manifest.json','admin-manifest.json','data','assets'])cpSync(p,'dist/'+p,{recursive:true});

