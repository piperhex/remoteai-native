const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const work = path.join(root, '.codex-tmp/update-url-checks');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';
const cache = path.join(process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'), 'caches/modules-2/files-2.1');
fs.mkdirSync(work, { recursive: true });
function jar(artifact) {
  const directory = path.join(cache, artifact);
  for (const hash of fs.readdirSync(directory)) {
    const file = fs.readdirSync(path.join(directory, hash)).find(name => name.endsWith('.jar'));
    if (file) return path.join(directory, hash, file);
  }
  throw new Error(`Build Android first: missing ${artifact}`);
}
function run(args) {
  const result = spawnSync(java, args, { cwd: root, stdio: 'inherit', windowsHide: true, timeout: 60_000 });
  if (result.error || result.status !== 0) throw result.error || new Error(`Java exited with ${result.status}`);
}
// Match Expo 53's Android Kotlin compiler, already downloaded by the Gradle build.
const compiler = ['org.jetbrains.kotlin/kotlin-compiler-embeddable/2.0.21', 'org.jetbrains.kotlin/kotlin-stdlib/2.0.21',
  'org.jetbrains.kotlin/kotlin-script-runtime/2.0.21', 'org.jetbrains.kotlin/kotlin-reflect/1.6.10',
  'org.jetbrains.intellij.deps/trove4j/1.0.20200330', 'org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm/1.6.4',
  'org.jetbrains/annotations/13.0'].map(jar);
const output = path.join(work, 'checks.jar');
run(['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler',
  '-no-stdlib', '-no-reflect', '-jvm-target', '1.8', '-classpath', compiler.join(path.delimiter), '-d', output,
  'plugins/appUpdate/UpdateMirrorUrl.kt', 'e2e/update-download/UpdateUrlChecks.kt']);
run(['-cp', [output, compiler[1]].join(path.delimiter), 'com.codexswitch.update.UpdateUrlChecksKt']);
