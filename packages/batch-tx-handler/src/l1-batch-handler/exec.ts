import {
  getRawData,
  processRawData,
  decompressAndDecode,
  getAllL2Msgs,
  decodeL2Msgs,
} from './utils';
import fs from 'fs';
import args from '../getClargs';
import { providers, Transaction } from 'ethers';

export const startL1BatchHandler = async (
  sequencerTx: string,
  provider: providers.JsonRpcProvider,
) => {
  if (!args.l2NetworkId) {
    throw new Error('No l2NetworkId! (You should add --l2NetworkId)');
  }

  const rawData = await getRawData(sequencerTx, args.l2NetworkId, provider);
  const compressedData = processRawData(rawData);
  const l2segments = decompressAndDecode(compressedData);
  const l2Msgs = getAllL2Msgs(l2segments);

  const txs: Transaction[] = [];
  for (let i = 0; i < l2Msgs.length; i++) {
    txs.push(...decodeL2Msgs(l2Msgs[i]));
  }

  console.log(
    `Get all ${txs.length} l2 transaction and ${l2Msgs.length} blocks in this batch`,
  );
};
