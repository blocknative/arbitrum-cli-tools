import { ethers } from 'ethers';
import { Transaction } from 'ethers';
import brotli from 'brotli';
import { rlp, bufArrToArr } from 'ethereumjs-util';
import { NestedUint8Array } from 'ethereumjs-util';
import { TransactionFactory } from '@ethereumjs/tx';
import { Decoded, Input } from 'rlp';
import { getL2Network } from '@arbitrum/sdk';
import { Interface } from 'ethers/lib/utils';
import { seqFunctionAbi } from './abi';
import { unzipSync, gunzipSync, inflateSync } from 'zlib';
import { inflateRawSync } from 'zlib';

//import RLP from 'rlp';
import { RLP } from '@ethereumjs/rlp';

const BatcherTxVersionByte = 0;
const ChannelIdSize = 16; // bytes
const FrameNumberSize = 2; // bytes
const FrameDataLengthSize = 4; // bytes
const MaxRlpBytesPerChannel = 10000000 //bytes
const BatchVersionByte = 0;

/*
const MaxL2MessageSize = 256 * 1024;
const BrotliMessageHeaderByte = 0;

const BatchSegmentKindL2Message = 0;
const BatchSegmentKindL2MessageBrotli = 1;
const BatchSegmentKindDelayedMessages = 2;

const L2MessageKind_Batch = 3;
const L2MessageKind_SignedTx = 4;
*/

// Get related sequencer batch data from a sequencer batch submission transaction.
export const getRawData = async (
  sequencerTx: string,
  provider: ethers.providers.JsonRpcProvider,
): Promise<Uint8Array> => {

  const txReceipt = await provider.getTransactionReceipt(sequencerTx);
  const tx = await provider.getTransaction(sequencerTx);
  if (!tx || !txReceipt || (txReceipt && !txReceipt.status)) {
    throw new Error('No such a l1 transaction or transaction reverted');
  }

  const seqData = tx.data.substring(2); //remove '0x'
  const rawData = Uint8Array.from(Buffer.from(seqData, 'hex'));
  return rawData;
};

export const processRawData = (rawData: Uint8Array): Uint8Array => {
  // This is to make sure this message is Nitro Rollups type. (For example: Anytrust use 0x80 here)
  if (rawData[0] !== BatcherTxVersionByte) {
    throw Error('Can only process batcher version 0 data.');
  }

  const channelId = rawData.subarray(1, 1 + ChannelIdSize);

  const frameNumber = rawData.subarray(1 + ChannelIdSize, 1 + ChannelIdSize + FrameNumberSize);

  const frameDataLength = parseInt(ethers.utils.hexlify(rawData.subarray(1 + ChannelIdSize + FrameNumberSize,
					   1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize)), 16);

  const frameData = rawData.subarray(1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize,
					   1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize + frameDataLength);
  const isLast = rawData.subarray(-1);

  /*
  console.log("frameDataLength: ", frameDataLength);
  console.log("channelId: ", ethers.utils.hexlify(channelId));
  console.log("frameNumber: ", ethers.utils.hexlify(frameNumber));
  console.log("frameData: ", ethers.utils.hexlify(frameData));
  console.log("isLast: ", ethers.utils.hexlify(isLast));
  */

  return frameData;
};

export const processFrame = (frame: Uint8Array): (Uint8Array | NestedUint8Array)[] => {

  const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frame)).subarray(4);

  // [parent_hash, epoch_number, epoch_hash, timestamp, transaction_list])
  //use rlp to decode stream type
  let res = RLP.decode(decompressedFrame, true);
  const decodedFrame: (Uint8Array | NestedUint8Array)[] = [];

  while (res.remainder !== undefined) {
    var a = res.data;
    decodedFrame.push(a);
    //res = RLP.decode(res.remainder as Input, true) as Decoded;
    res = RLP.decode(res.remainder, true);
  }
  //use rlp to decode stream type
  

  return decodedFrame;

};

export const decodeBatch = (decodedFrame: (Uint8Array | NestedUint8Array)[]): void => {
  const parentHash = ethers.utils.hexlify(decodedFrame[0][0] as Uint8Array);
  const epochNumber = parseInt(ethers.utils.hexlify(decodedFrame[0][1] as number));
  const epochHash = ethers.utils.hexlify(decodedFrame[0][2] as Uint8Array);
  const timestamp = parseInt(ethers.utils.hexlify(decodedFrame[0][3] as number));

  const rawL2Txs = decodedFrame[0][4] as Uint8Array[];
  const l2Txs: Transaction[] = [];

  for (let i = 0; i < rawL2Txs.length; i++) {
    //const tx = ethers.utils.parseTransaction(decodedFrame[4][i]);
    const tx = ethers.utils.parseTransaction(rawL2Txs[i] as Uint8Array);
    l2Txs.push(tx);
    //console.log(tx);
  }

  const opBatch = {'parentHash': parentHash, // block hash of the previous L2 block
	       'epochNumber': epochNumber, // number of L1 block
               'epochHash': epochHash, // hash of L1 block
	       'timestamp': timestamp, // timestamp of L2 block
	       'txs': l2Txs}

  console.log(opBatch);
  console.log(`${opBatch.txs.length} l2 transactions`);
}
