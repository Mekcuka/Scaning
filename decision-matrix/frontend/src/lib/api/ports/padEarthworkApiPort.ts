import { padEarthworkApi } from '../padEarthworkApi';

export type PadEarthworkApiPort = typeof padEarthworkApi;

export const defaultPadEarthworkApi: PadEarthworkApiPort = padEarthworkApi;
