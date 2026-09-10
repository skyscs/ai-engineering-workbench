import { homedir } from 'node:os';
import path from 'node:path';
import { StorageError } from './errors.js';

const appName = 'ai-engineering-workbench';

/** Pure path resolution; explicit inputs allow platform tests without user data. */
export function resolveDataRoot(options: {
  platform?: NodeJS.Platform;
  home?: string;
  env?: NodeJS.ProcessEnv;
} = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const absolute = (value: string) => paths.isAbsolute(value) &&
    (platform !== 'win32' || /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(value));
  if (env.AEW_DATA_DIR !== undefined) {
    if (!absolute(env.AEW_DATA_DIR) || env.AEW_DATA_DIR.includes('\0')) {
      throw new StorageError('INVALID_DATA_DIR', 'AEW_DATA_DIR must be an absolute path.');
    }
    return paths.normalize(env.AEW_DATA_DIR);
  }
  if (!absolute(home)) throw new StorageError('INVALID_DATA_DIR', 'The home directory must be absolute.');
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    return paths.join(local && absolute(local) ? local : paths.join(home, 'AppData', 'Local'), appName);
  }
  if (platform === 'darwin') return paths.join(home, 'Library', 'Application Support', appName);
  if (platform === 'linux') {
    const xdg = env.XDG_DATA_HOME;
    return paths.join(xdg && absolute(xdg) ? xdg : paths.join(home, '.local', 'share'), appName);
  }
  throw new StorageError('UNSUPPORTED_PLATFORM', 'This platform has no supported data-directory convention.');
}

export function storagePaths(root: string) {
  return { root, database: path.join(root, 'workbench.db'), owner: path.join(root, '.owner.db'),
    repositories: path.join(root, 'repositories'), tasks: path.join(root, 'tasks'),
    worktrees: path.join(root, 'worktrees'), logs: path.join(root, 'logs') };
}
