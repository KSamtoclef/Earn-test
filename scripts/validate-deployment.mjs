import fs from'node:fs';

const fail=[];
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const build=fs.readFileSync('scripts/build-static.mjs','utf8');

if(config.outputDirectory!=='public')fail.push('Vercel outputDirectory must be public.');
const headers=Array.isArray(config.headers)?config.headers:[];
const indexRule=headers.find(rule=>rule.source==='/index.html');
const assetRule=headers.find(rule=>rule.source==='/assets/(.*)');
const cacheValue=rule=>rule?.headers?.find(header=>String(header.key).toLowerCase()==='cache-control')?.value||'';
if(!/no-store/i.test(cacheValue(indexRule)))fail.push('index.html must remain no-store so new releases appear immediately.');
if(!/max-age=31536000/i.test(cacheValue(assetRule))||!/immutable/i.test(cacheValue(assetRule)))fail.push('Versioned assets must use one-year immutable caching.');
if(!String(pkg.scripts?.build||'').includes('build-static.mjs'))fail.push('The package build command must create the static bundle.');
if(!build.includes("path.join(root,'public')"))fail.push('The static build must write to public.');
if(!build.includes('sourceApp!==outputApp'))fail.push('The static build must verify source/output equality.');

if(fail.length){console.error(`Deployment validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`);process.exit(1)}
console.log('Earn Chat deployment configuration validation passed.');
