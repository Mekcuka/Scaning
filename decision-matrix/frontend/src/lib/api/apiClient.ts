import { adminApi } from './adminApi';
import { analysisApi } from './analysisApi';
import { authApi } from './authApi';
import { flowApi } from './flowApi';
import { importApi } from './importApi';
import { jobsApi } from './jobsApi';
import { mapApi } from './mapApi';
import { networkApi } from './networkApi';
import { onePagerApi } from './onePagerApi';
import { projectsApi } from './projectsApi';
import { sandLogisticsApi } from './sandLogisticsApi';

/** Composed REST client — preserves legacy `import { api } from '../lib/api'`. */
export const api = {
  ...authApi,
  ...adminApi,
  ...projectsApi,
  ...analysisApi,
  ...mapApi,
  ...networkApi,
  ...importApi,
  ...jobsApi,
  ...sandLogisticsApi,
  ...flowApi,
  ...onePagerApi,
};
