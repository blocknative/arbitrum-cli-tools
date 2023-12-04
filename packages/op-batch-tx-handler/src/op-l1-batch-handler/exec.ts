import {
  decodeAll,
  getRawData,
  processRawData,
  processFrame,
  decodeFrameTxs,
  decodeBatches,
  decompressAndDecode,
  decodeL2Msgs,
} from './utils';
import fs from 'fs';
import args from '../getClargs';
import { providers } from 'ethers';

export const startOpL1BatchHandler = async (
  sequencerTx: string,
  provider: providers.JsonRpcProvider,
) => {
  await decodeAll(sequencerTx, provider);

  //const rawData = await getRawData(sequencerTx, provider); // returns Uint8Array
  //const frameData = processRawData(rawData); // returns Uint8Array
  //const txData = processFrame(frameData); // returns Uint8Array[]

  //const decodedTxData = decodeFrameTxs(txData); // returns Uint8Array[]
  //const decodedTxData = decodeBatches(txData); // returns Uint8Array[]
  /*
  const l2segments = decompressAndDecode(compressedData);
  const l2Msgs = getAllL2Msgs(l2segments);

  const txHash: string[] = [];
  for (let i = 0; i < l2Msgs.length; i++) {
    txHash.push(...decodeL2Msgs(l2Msgs[i]));
  }

  console.log(
    `Get all ${txHash.length} l2 transaction and ${l2Msgs.length} blocks in this batch, writing tx to ${args.outputFile}`,
  );
  fs.writeFileSync(args.outputFile, txHash.toString());
  */
};
