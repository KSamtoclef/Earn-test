import fs from 'node:fs';

const replace=(src,from,to,label)=>{if(!src.includes(from))throw new Error(`Missing ${label}`);return src.replace(from,to)};

let core=fs.readFileSync('assets/js/admin/core.js','utf8');
core=replace(core,
"const TABS=['overview','live','users','tasks','claims','chats','referrals','qualifications','withdrawals','kyc','payments','configuration','analytics','audit'];",
"const TABS=['overview','live','users','tasks','claims','chats','referrals','qualifications','withdrawals','kyc','payments','configuration','audit'];",
'Admin tabs');
core=replace(core,
"const LABELS={overview:'Overview',live:'Live users',users:'Users',tasks:'Tasks',claims:'Task claims',chats:'Chats',referrals:'Referrals',qualifications:'Qualifications',withdrawals:'Withdrawals',kyc:'KYC',payments:'Payments',configuration:'Configuration',analytics:'Analytics',audit:'Audit log'};",
"const LABELS={overview:'Overview',live:'Live users',users:'Users',tasks:'Tasks',claims:'Task claims',chats:'Chats',referrals:'Referrals',qualifications:'Qualifications',withdrawals:'Withdrawals',kyc:'KYC',payments:'Payments',configuration:'Configuration',audit:'Audit log'};",
'Admin labels');
fs.writeFileSync('assets/js/admin/core.js',core);

let ux=fs.readFileSync('assets/js/admin/admin-experience.js','utf8');
ux=replace(ux,
"const labels={overview:'Overview',live:'Live users',users:'Users',tasks:'Tasks',claims:'Task claims',chats:'Chats',referrals:'Referrals',qualifications:'Qualifications',withdrawals:'Withdrawals',kyc:'KYC',payments:'Payments',configuration:'Configuration',analytics:'Analytics',audit:'Audit log'};",
"const labels={overview:'Overview',live:'Live users',users:'Users',tasks:'Tasks',claims:'Task claims',chats:'Chats',referrals:'Referrals',qualifications:'Qualifications',withdrawals:'Withdrawals',kyc:'KYC',payments:'Payments',configuration:'Configuration',audit:'Audit log'};",
'Admin UX labels');
fs.writeFileSync('assets/js/admin/admin-experience.js',ux);

let validator=fs.readFileSync('scripts/validate-admin-experience.mjs','utf8');
validator=replace(validator,
"const app=read('assets/js/app.js'),admin=read('assets/js/admin/admin.js'),ux=read('assets/js/admin/admin-experience.js'),css=read('assets/css/admin-experience.css'),html=read('index.html');",
"const app=read('assets/js/app.js'),admin=read('assets/js/admin/admin.js'),core=read('assets/js/admin/core.js'),ux=read('assets/js/admin/admin-experience.js'),css=read('assets/css/admin-experience.css'),html=read('index.html');",
'validator inputs');
validator=replace(validator,
" ['admin overview',ux.includes('data-admin-overview')],",
" ['admin overview',ux.includes('data-admin-overview')],\n ['analytics removed from navigation',!core.includes(\"'configuration','analytics','audit'\")&&!core.includes(\"analytics:'Analytics'\")&&!ux.includes(\"analytics:'Analytics'\")],",
'validator analytics check');
fs.writeFileSync('scripts/validate-admin-experience.mjs',validator);

console.log('Removed Analytics from Admin navigation while preserving underlying event data.');
