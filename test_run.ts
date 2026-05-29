import { spawn } from 'child_process';
const child = spawn('npx', ['tsx', 'server.ts']);
child.stdout.on('data', data => console.log(data.toString()));
child.stderr.on('data', data => console.error(data.toString()));
setTimeout(() => { child.kill(); process.exit(0); }, 5000);
