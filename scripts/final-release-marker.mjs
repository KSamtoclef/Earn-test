import fs from 'node:fs';
const path='assets/js/admin/core.js';
const oldVersion='20260801-source-consolidated-r1';
const newVersion='20260802-stability-r2';
const source=fs.readFileSync(path,'utf8');
if(!source.includes(oldVersion))throw new Error('Old Admin release marker not found');
fs.writeFileSync(path,source.replace(oldVersion,newVersion));
// Trigger the one-time release-marker workflow after its workflow file exists.
