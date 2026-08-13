const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Add the JDK bin folder to the environment PATH so keytool is available
process.env.PATH = 'C:\\Users\\user\\.bubblewrap\\jdk\\bin;' + process.env.PATH;

// Paths
const distDir = path.resolve(__dirname, 'dist');
const publicDir = path.resolve(__dirname, 'public');
const androidDir = path.resolve(__dirname, 'placement-tracker-android');

// Start temporary local HTTP server to serve the manifest and icon for Bubblewrap initialization
const server = http.createServer((req, res) => {
  console.log(`[Local Server] Request: ${req.url}`);
  if (req.url === '/manifest.webmanifest') {
    const manifestPath = path.join(distDir, 'manifest.webmanifest');
    if (fs.existsSync(manifestPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(manifestPath));
      console.log('[Local Server] Served manifest.webmanifest');
    } else {
      res.writeHead(204);
      res.end();
      console.error('[Local Server] Error: manifest.webmanifest not found');
    }
  } else if (req.url === '/pwa-512x512.png') {
    const iconPath = path.join(publicDir, 'pwa-512x512.png');
    if (fs.existsSync(iconPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(iconPath));
      console.log('[Local Server] Served pwa-512x512.png');
    } else {
      res.writeHead(204);
      res.end();
      console.error('[Local Server] Error: pwa-512x512.png not found');
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(8000, () => {
  console.log('[Local Server] Running on http://localhost:8000. Starting Bubblewrap...');

  const child = spawn('npx', [
    '-y', '@bubblewrap/cli', 'init',
    '--manifest=http://localhost:8000/manifest.webmanifest',
    `--directory=${androidDir}`
  ], {
    shell: true,
    cwd: __dirname
  });

  let answeredDomain = false;
  let answeredUrlPath = false;
  let answeredAppName = false;
  let answeredShortName = false;
  let answeredAppId = false;
  let answeredVersionCode = false;
  let answeredVersionName = false;
  let answeredDisplayMode = false;
  let answeredOrientation = false;
  let answeredStatusBarColor = false;
  let answeredSplashColor = false;
  let answeredIconUrl = false;
  let answeredMaskableIconUrl = false;
  let answeredMonochromeIconUrl = false;
  let answeredPlayBilling = false;
  let answeredGeolocation = false;
  let answeredSiteSettings = false;
  let answeredShortcuts = false;
  let answeredKeyStoreLocation = false;
  let answeredKeyAlias = false;
  let answeredKeyName = false;
  let answeredCreateKeyStore = false;
  let answeredOverwrite = false;
  let answeredLicense = false;

  // Keystore generation prompts
  let answeredFirstName = false;
  let answeredOrgUnit = false;
  let answeredOrg = false;
  let answeredCity = false;
  let answeredState = false;
  let answeredCountry = false;
  let answeredIsCorrect = false;

  child.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);

    const lower = text.toLowerCase();

    // Check for standard prompts
    if (lower.includes('domain') && !answeredDomain) {
      answeredDomain = true;
      child.stdin.write('placementtracker.com\n');
    } else if (lower.includes('url path') && !answeredUrlPath) {
      answeredUrlPath = true;
      child.stdin.write('/\n');
    } else if (lower.includes('application name') && !answeredAppName) {
      answeredAppName = true;
      child.stdin.write('Placement Tracker\n');
    } else if (lower.includes('short name') && !answeredShortName) {
      answeredShortName = true;
      child.stdin.write('Placement\n');
    } else if (lower.includes('application id') && !answeredAppId) {
      answeredAppId = true;
      child.stdin.write('com.placementtracker.twa\n');
    } else if (lower.includes('version code') && !answeredVersionCode) {
      answeredVersionCode = true;
      child.stdin.write('1\n');
    } else if (lower.includes('version name') && !answeredVersionName) {
      answeredVersionName = true;
      child.stdin.write('1.0.0\n');
    } else if (lower.includes('display mode') && !answeredDisplayMode) {
      answeredDisplayMode = true;
      child.stdin.write('standalone\n');
    } else if (lower.includes('orientation') && !answeredOrientation) {
      answeredOrientation = true;
      child.stdin.write('portrait\n');
    } else if (lower.includes('status bar color') && !answeredStatusBarColor) {
      answeredStatusBarColor = true;
      child.stdin.write('#0d1117\n');
    } else if (lower.includes('splash screen color') && !answeredSplashColor) {
      answeredSplashColor = true;
      child.stdin.write('#0d1117\n');
    } else if (lower.includes('maskable icon url') && !answeredMaskableIconUrl) {
      answeredMaskableIconUrl = true;
      child.stdin.write('\n');
    } else if (lower.includes('icon url') && !answeredIconUrl) {
      answeredIconUrl = true;
      child.stdin.write('http://localhost:8000/pwa-512x512.png\n');
    } else if (lower.includes('monochrome icon url') && !answeredMonochromeIconUrl) {
      answeredMonochromeIconUrl = true;
      child.stdin.write('\n');
    } else if (lower.includes('play billing') && !answeredPlayBilling) {
      answeredPlayBilling = true;
      child.stdin.write('no\n');
    } else if (lower.includes('geolocation') && !answeredGeolocation) {
      answeredGeolocation = true;
      child.stdin.write('no\n');
    } else if (lower.includes('site settings') && !answeredSiteSettings) {
      answeredSiteSettings = true;
      child.stdin.write('no\n');
    } else if (lower.includes('add shortcuts?') && !answeredShortcuts) {
      answeredShortcuts = true;
      child.stdin.write('no\n');
    } else if (lower.includes('key store location') && !answeredKeyStoreLocation) {
      answeredKeyStoreLocation = true;
      child.stdin.write('android.keystore\n');
    } else if (lower.includes('key name') && !answeredKeyName) {
      answeredKeyName = true;
      child.stdin.write('alias\n');
    } else if (lower.includes('create one now?') && !answeredCreateKeyStore) {
      answeredCreateKeyStore = true;
      child.stdin.write('yes\n');
    } else if (lower.includes('password') && !lower.includes('confirm')) {
      child.stdin.write('password\n');
    } else if (lower.includes('confirm')) {
      child.stdin.write('password\n');
    } else if (lower.includes('first and last') && !answeredFirstName) {
      answeredFirstName = true;
      child.stdin.write('User\n');
    } else if (lower.includes('organizational unit') && !answeredOrgUnit) {
      answeredOrgUnit = true;
      child.stdin.write('Unit\n');
    } else if (lower.includes('organization') && !answeredOrg) {
      answeredOrg = true;
      child.stdin.write('Org\n');
    } else if (lower.includes('city or locality') && !answeredCity) {
      answeredCity = true;
      child.stdin.write('City\n');
    } else if (lower.includes('state or province') && !answeredState) {
      answeredState = true;
      child.stdin.write('State\n');
    } else if (lower.includes('country') && !answeredCountry) {
      answeredCountry = true;
      child.stdin.write('US\n');
    } else if (lower.includes('correct?') && !answeredIsCorrect) {
      answeredIsCorrect = true;
      child.stdin.write('yes\n');
    } else if ((lower.includes('overwrite') || lower.includes('already exists')) && !answeredOverwrite) {
      answeredOverwrite = true;
      child.stdin.write('yes\n');
    } else if ((lower.includes('license') || lower.includes('agree')) && !answeredLicense) {
      answeredLicense = true;
      child.stdin.write('yes\n');
    }
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data.toString());
  });

  child.on('close', (code) => {
    console.log(`[Local Server] Closing local server. Bubblewrap process exited with code ${code}`);
    server.close(() => {
      process.exit(code);
    });
  });
});
