import fs from'node:fs';

const replace=(src,from,to,label)=>{if(!src.includes(from))throw new Error(`Missing ${label}`);return src.replace(from,to)};
let html=fs.readFileSync('index.html','utf8');
html=replace(html,'<link rel="stylesheet" href="./assets/css/app.css?v=20260802-unified-r1">','<link rel="stylesheet" href="./assets/css/app.css?v=20260805-experience-r1">','app stylesheet release');
html=replace(html,'<link rel="stylesheet" href="./assets/css/experience-theme.css?v=20260802-unified-r1">','<link rel="stylesheet" href="./assets/css/experience-theme.css?v=20260805-experience-r1">\n<link rel="stylesheet" href="./assets/css/product-experience.css?v=20260805-experience-r1">','experience stylesheet release');
html=replace(html,'<script type="module" src="./assets/js/final-completion.js?v=20260802-unified-r1"></script>','<script type="module" src="./assets/js/final-completion.js?v=20260805-experience-r1"></script>','completion runtime release');
html=replace(html,'<script type="module" src="./assets/js/app.js?v=20260802-unified-r1"></script>','<script type="module" src="./assets/js/app.js?v=20260805-experience-r1"></script>\n<script type="module" src="./assets/js/product-experience.js?v=20260805-experience-r1"></script>','application runtime release');
fs.writeFileSync('index.html',html);

let app=fs.readFileSync('assets/js/app.js','utf8');
app=replace(app,"const RELEASE='20260802-countdown-r1';","const RELEASE='20260805-experience-r1';",'application release marker');
fs.writeFileSync('assets/js/app.js',app);

let validator=fs.readFileSync('scripts/validate-final-completion.mjs','utf8');
validator=replace(validator,"requireToken(html,'final-completion.js?v=20260802-unified-r1','Completion runtime is not loaded');","requireToken(html,'final-completion.js?v=20260805-experience-r1','Completion runtime is not loaded');\n requireToken(html,'product-experience.js?v=20260805-experience-r1','Product experience runtime is not loaded');\n requireToken(html,'product-experience.css?v=20260805-experience-r1','Product experience stylesheet is not loaded');",'final validator release contract');
fs.writeFileSync('scripts/validate-final-completion.mjs',validator);

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.scripts.build='npm run validate && node scripts/build-static.mjs && node scripts/validate-final-completion.mjs && node scripts/validate-product-experience.mjs';
pkg.scripts.test=pkg.scripts.build;
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('Product experience installed.');
