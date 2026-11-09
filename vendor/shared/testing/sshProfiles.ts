import type { SshProfile } from '../terminal/sshProfiles';

export const composerSshProfiles: SshProfile[] = [
  { id: 'development', name: '开发服务器', host: 'dev.example.test', port: 22,
    username: 'developer', auth: 'key', revision: 3, fingerprint: 'SHA256:fixture' },
  { id: 'production', name: '生产环境 · 华东地区应用与数据库维护服务器', host: '192.0.2.10', port: 2222,
    username: 'operator', auth: 'password', revision: 5, fingerprint: 'SHA256:fixture' },
];
