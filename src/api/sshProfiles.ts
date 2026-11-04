import { authorizedRequest } from './client';
import type { AuthSession } from '../types';
import { createServerSshProfiles, sshProfileHttpExchange }
  from '../../vendor/shared/terminal/serverSshProfiles';
import { sshProfileResponse } from '../../vendor/shared/terminal/sshProfileResponse';

export const createNativeSshProfiles = (session: AuthSession) => createServerSshProfiles(sshProfileHttpExchange(
  async (path, init) => sshProfileResponse(await authorizedRequest(session, path, init)),
));
