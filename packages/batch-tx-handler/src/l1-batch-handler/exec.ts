import {
  getRawData,
  getInputData,
  processRawData,
  decompressAndDecode,
  getAllL2Msgs,
  decodeL2Msgs,
} from './utils';
import { ethers } from 'ethers';
import fs from 'fs';
import args from '../getClargs';
import { providers, Transaction } from 'ethers';

const ARB_BLOCK_OFFSET = 22207817;

export const startL1BatchHandler = async (
  sequencerTx: string,
  provider: providers.JsonRpcProvider,
) => {
  if (!args.l2NetworkId) {
    throw new Error('No l2NetworkId! (You should add --l2NetworkId)');
  }

  const inputData = await getInputData(sequencerTx, args.l2NetworkId, provider);
  const sequenceNumber = inputData['sequenceNumber'].toNumber();
  const firstL2Block = inputData['prevMessageCount'].toNumber() + ARB_BLOCK_OFFSET;
  const lastL2Block = inputData['newMessageCount'].toNumber() -1 + ARB_BLOCK_OFFSET;

  const rawData = getRawData(inputData);
  const compressedData = processRawData(rawData);
  const l2segments = decompressAndDecode(compressedData);
  const l2Msgs = getAllL2Msgs(l2segments);

  const txs: Transaction[] = [];
  for (let i = 0; i < l2Msgs.length; i++) {
    txs.push(...decodeL2Msgs(l2Msgs[i]));
  }

  const arbBatch = {'sequenceNumber': sequenceNumber,
	            'firstBlock': firstL2Block,
                    'lastBlock': lastL2Block,
		    'l2Txs': txs}

  console.log(arbBatch);


  console.log(
    `${txs.length} l2 transactions and ${l2Msgs.length} blocks in this batch`,
  );
};
