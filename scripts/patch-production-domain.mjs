import fs from'node:fs';
const path='index.html';
let source=fs.readFileSync(path,'utf8');
if(!source.includes('<title>Earn Chat</title>'))throw new Error('Title marker missing');
if(!source.includes('rel="canonical"')){
 source=source.replace('<title>Earn Chat</title>','<title>Earn Chat</title>\n<meta name="description" content="Earn Chat helps members complete approved guided chats, tasks, sponsored visits and qualified referrals.">\n<link rel="canonical" href="https://earn-chat.com/">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Earn Chat">\n<meta property="og:title" content="Earn Chat">\n<meta property="og:description" content="Complete approved guided chats, tasks, sponsored visits and qualified referrals.">\n<meta property="og:url" content="https://earn-chat.com/">\n<meta name="twitter:card" content="summary">');
}
fs.writeFileSync(path,source);
// Triggered after workflow creation.
