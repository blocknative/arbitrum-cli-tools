import {
  getRawData,
  processRawData,
  processFrame,
  decodeBatch,
} from './utils';
import fs from 'fs';
import args from '../getClargs';
import { providers } from 'ethers';

export const startOpL1BatchHandler = async (
  sequencerTx: string,
  provider: providers.JsonRpcProvider,
) => {

  const rawData = await getRawData(sequencerTx, provider);
  const frameData = processRawData(rawData);
  const txData = processFrame(frameData);

  decodeBatch(txData);
  
};
