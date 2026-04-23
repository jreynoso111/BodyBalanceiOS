import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');

function readExpoConfig() {
  const output = execFileSync('npx', ['expo', 'config', '--json'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return JSON.parse(output);
}

function matchRequired(text, regex, label) {
  const match = text.match(regex);
  if (!match) {
    throw new Error(`Could not read ${label}.`);
  }
  return match[1];
}

function normalizeBooleanString(value) {
  return String(value).trim().toLowerCase() === 'true' ? 'true' : 'false';
}

if (!fs.existsSync(androidDir)) {
  console.log('verify-android-config-sync: skipped because android/ does not exist locally.');
  process.exit(0);
}

if (!fs.existsSync(manifestPath) || !fs.existsSync(buildGradlePath)) {
  console.error('verify-android-config-sync: android/ exists but required app files are missing.');
  process.exit(1);
}

const expoConfig = readExpoConfig();
const expoAndroid = expoConfig.android || {};
const manifestText = fs.readFileSync(manifestPath, 'utf8');
const buildGradleText = fs.readFileSync(buildGradlePath, 'utf8');

const expectedVersionCode = Number(expoAndroid.versionCode);
const expectedAllowBackup = normalizeBooleanString(expoAndroid.allowBackup ?? true);
const blockedPermissions = Array.isArray(expoAndroid.blockedPermissions)
  ? expoAndroid.blockedPermissions.map((value) => String(value).trim()).filter(Boolean)
  : [];

const actualVersionCode = Number(matchRequired(buildGradleText, /versionCode\s+(\d+)/, 'android versionCode'));
const actualAllowBackup = normalizeBooleanString(
  matchRequired(manifestText, /android:allowBackup="(true|false)"/, 'android allowBackup')
);

const problems = [];

if (!Number.isFinite(expectedVersionCode)) {
  problems.push('Expo config is missing android.versionCode.');
} else if (actualVersionCode !== expectedVersionCode) {
  problems.push(`android/app/build.gradle has versionCode ${actualVersionCode}, expected ${expectedVersionCode}.`);
}

if (actualAllowBackup !== expectedAllowBackup) {
  problems.push(
    `android/app/src/main/AndroidManifest.xml has allowBackup=${actualAllowBackup}, expected ${expectedAllowBackup}.`
  );
}

for (const permission of blockedPermissions) {
  const removalPattern = new RegExp(
    `<uses-permission[^>]+android:name="${permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]+tools:node="remove"`,
    'i'
  );

  if (!removalPattern.test(manifestText)) {
    problems.push(`Blocked permission ${permission} is not explicitly removed in android/app/src/main/AndroidManifest.xml.`);
  }
}

if (problems.length > 0) {
  console.error('verify-android-config-sync: native Android files are out of sync with Expo config:');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log('verify-android-config-sync: android/ matches Expo config for versionCode, allowBackup, and blocked permissions.');
