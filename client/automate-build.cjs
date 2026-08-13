const { spawn } = require('child_process');
const path = require('path');

// Add the JDK bin folder to the environment PATH so build tools can find JDK binaries
process.env.PATH = 'C:\\Users\\user\\.bubblewrap\\jdk\\bin;' + process.env.PATH;

// Paths
const androidDir = path.resolve(__dirname, 'placement-tracker-android');

console.log('Spawning bubblewrap build...');
const child = spawn('npx', [
  '-y', '@bubblewrap/cli', 'build'
], { 
  shell: true,
  cwd: androidDir
});

child.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);

  const lower = text.toLowerCase();

  // If it asks for password (key store or key alias password)
  if (lower.includes('password')) {
    child.stdin.write('password\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
  process.exit(code);
});
