import { onePagerApi } from '../onePagerApi';

/** List and export one-pager reports. */
export type OnePagerListApiPort = Pick<
  typeof onePagerApi,
  'getOnePagers' | 'deleteOnePager' | 'exportOnePagerPptx'
>;

/** Load and mutate a single one-pager. */
export type OnePagerEditorApiPort = Pick<
  typeof onePagerApi,
  'getOnePager' | 'createOnePager' | 'updateOnePager' | 'exportOnePagerPptx'
>;

export const defaultOnePagerListApi: OnePagerListApiPort = onePagerApi;
export const defaultOnePagerEditorApi: OnePagerEditorApiPort = onePagerApi;
