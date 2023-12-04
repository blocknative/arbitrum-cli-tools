import { ethers } from 'ethers';
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


const MaxL2MessageSize = 256 * 1024;
const BrotliMessageHeaderByte = 0;

const BatchSegmentKindL2Message = 0;
const BatchSegmentKindL2MessageBrotli = 1;
const BatchSegmentKindDelayedMessages = 2;

const L2MessageKind_Batch = 3;
const L2MessageKind_SignedTx = 4;

// Use brotli to decompress the compressed data and use rlp to decode to l2 message segments
export const decompressAndDecode = (compressedData: Uint8Array): Uint8Array[] => {
  //decompress data
  const decompressedData = brotli.decompress(Buffer.from(compressedData));
  const hexData = ethers.utils.hexlify(decompressedData);

  //use rlp to decode stream type
  let res = rlp.decode(hexData, true) as Decoded;
  const l2Segments: Uint8Array[] = [];
  while (res.remainder !== undefined) {
    l2Segments.push(bufArrToArr(res.data as Buffer));
    res = rlp.decode(res.remainder as Input, true) as Decoded;
  }
  return l2Segments;
};

//Check if the raw data valid
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

  console.log("frameDataLength: ", frameDataLength);
  console.log("channelId: ", ethers.utils.hexlify(channelId));
  console.log("frameNumber: ", ethers.utils.hexlify(frameNumber));
  //console.log("frameData: ", ethers.utils.hexlify(frameData));
  console.log("isLast: ", ethers.utils.hexlify(isLast));

  return frameData;
};

export const processFrame = (frame: Uint8Array): Uint8Array | NestedUint8Array => {
  console.log("frame length", frame.length);

  const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frame)).subarray(4);
  //const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frame)).subarray(1);
  //const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frame));
  //const decompressedFrame = unzipSync(frame);

  //console.log("decompressedFrame: ", ethers.utils.hexlify(decompressedFrame).slice(0,10));

  /*
  if (decompressedFrame[0] !== BatchVersionByte) {
    throw Error('Can only process batch version 0 data.');
  }
  */

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
  
  console.log("decodedFrame length", decodedFrame.length);
  //console.log(decodedFrame.subarray(0, 5));
  //const a = decodedFrame[0][4] + 10;
  //console.log(decodedFrame[0][4].length);

  /*
  console.log(ethers.utils.hexlify(decodedFrame[0][0]));
  console.log("decodedFrame[0][1]");
  console.log(parseInt(ethers.utils.hexlify(decodedFrame[0][1]), 16));
  console.log("decodedFrame[0][2]");
  console.log(ethers.utils.hexlify(decodedFrame[0][2]));
  console.log("decodedFrame[0][3]");
  console.log(parseInt(ethers.utils.hexlify(decodedFrame[0][3])));
  console.log("decodedFrame[1]");
  console.log(decodedFrame[1]);
  console.log("decodedFrame[2]");
  console.log(decodedFrame[2]);
  console.log("decodedFrame[3]");
  console.log(decodedFrame[3]);
  */

  return decodedFrame;

};

export const decodeFrameTxs = (decodedFrame: Uint8Array[]): Uint8Array[] => {
  const parentHash = ethers.utils.hexlify(decodedFrame[0][0]);
  const epochNumber = parseInt(ethers.utils.hexlify(decodedFrame[0][1]));
  const epochHash = ethers.utils.hexlify(decodedFrame[0][2]);
  const timestamp = parseInt(ethers.utils.hexlify(decodedFrame[0][3]));
  console.log("parentHash: ", parentHash);
  console.log("epochNumber: ", epochNumber);
  console.log("epochHash: ", epochHash);
  console.log("timestamp: ", timestamp);
  /*
  for (let i = 0; i < decodedFrame[0][4].length; i++) {
      //var tx = ethers.utils.parseTransaction(decodedFrame[i]);
      var tx = TransactionFactory.fromSerializedData(decodedFrame[0][4][i]);
      //console.log(tx)
  }
  */
  return decodedFrame
}

export const decodeFrameTxsOld = (decodedFrame: Uint8Array[]): Uint8Array[] => {
  // [parent_hash, epoch_number, epoch_hash, timestamp, transaction_list])
  for (let i = 0; i < decodedFrame.length; i++) {
    try {
      //var tx = TransactionFactory.fromSerializedData(decodedFrame[i]);
      var tx = ethers.utils.parseTransaction(decodedFrame[i]);
      console.log(tx.hash);
    } catch(e) {
      console.log(e)
    }
  }
  return decodedFrame
}
export const decodeBatches = (decodedFrame: Uint8Array[]): Uint8Array[] => {
  // [parent_hash, epoch_number, epoch_hash, timestamp, transaction_list])
  for (let i = 0; i < decodedFrame.length; i++) {
    try {
      console.log(ethers.utils.hexlify(decodedFrame[i]));
    } catch(e) {
      //console.log(e)
    }
  }
  return decodedFrame
}

const getNextSerializedTransactionSize = (remainData: Uint8Array, start: number): number => {
  //the size tag of each message here length 8 bytes
  const sizeBytes = remainData.subarray(start, start + 8);
  const size = ethers.BigNumber.from(sizeBytes).toNumber();
  if (size > MaxL2MessageSize) {
    throw new Error('size too large in getOneSerializedTransaction');
  }
  return size;
};

export const getAllL2Msgs = (l2segments: Uint8Array[]): Uint8Array[] => {
  const l2Msgs: Uint8Array[] = [];

  for (let i = 0; i < l2segments.length; i++) {
    const kind = l2segments[i][0];
    let segment = l2segments[i].subarray(1);
    /**
     * Here might contain Timestamp updates and l1 block updates message here, but it is useless
     * in finding tx hash here, so we just need to find tx related messages.
     */
    if (kind === BatchSegmentKindL2Message || kind === BatchSegmentKindL2MessageBrotli) {
      if (kind === BatchSegmentKindL2MessageBrotli) {
        segment = brotli.decompress(Buffer.from(segment));
      }
      l2Msgs.push(segment);
    }
    if (kind === BatchSegmentKindDelayedMessages) {
      //TODO
    }
  }

  if (l2Msgs.length > MaxL2MessageSize) {
    throw Error('Message too large');
  }

  return l2Msgs;
};

export const decodeL2Msgs = (l2Msgs: Uint8Array): string[] => {
  const txHash: string[] = [];

  const kind = l2Msgs[0];
  if (kind === L2MessageKind_SignedTx) {
    const serializedTransaction = l2Msgs.subarray(1); // remove kind tag
    const tx = ethers.utils.parseTransaction(serializedTransaction);
    console.log(tx)
    const currentHash = tx.hash!; // calculate tx hash
    txHash.push(currentHash);
  } else if (kind === L2MessageKind_Batch) {
    const remainData: Uint8Array = l2Msgs.subarray(1);
    const lengthOfData = remainData.length;
    let current = 0;
    while (current < lengthOfData) {
      const nextSize = getNextSerializedTransactionSize(remainData, Number(current));
      current += 8; // the size of next data length value is 8 bytes, so we need to skip it
      const endOfNext = current + nextSize;
      // read next segment data which range from ${current} to ${endOfNext}
      const nextData = remainData.subarray(Number(current), Number(endOfNext));
      txHash.push(...decodeL2Msgs(nextData));
      current = endOfNext;
    }
  }
  return txHash;
};

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

export const decodeAll = async (
  sequencerTx: string,
  provider: ethers.providers.JsonRpcProvider,
): Promise<void> => {

  // Fetch
  const txReceipt = await provider.getTransactionReceipt(sequencerTx);
  const tx = await provider.getTransaction(sequencerTx);
  if (!tx || !txReceipt || (txReceipt && !txReceipt.status)) {
    throw new Error('No such a l1 transaction or transaction reverted');
  }

  const seqData = tx.data.substring(2); //remove '0x'
  const rawData = Uint8Array.from(Buffer.from(seqData, 'hex'));

  if (rawData[0] !== BatcherTxVersionByte) {
    throw Error('Can only process batcher version 0 data.');
  }

  // Parse channel 
  const channelId = rawData.subarray(1, 1 + ChannelIdSize);

  const frameNumber = rawData.subarray(1 + ChannelIdSize, 1 + ChannelIdSize + FrameNumberSize);

  const frameDataLength = parseInt(ethers.utils.hexlify(rawData.subarray(1 + ChannelIdSize + FrameNumberSize,
					   1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize)), 16);

  const frameData = rawData.subarray(1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize,
					   1 + ChannelIdSize + FrameNumberSize + FrameDataLengthSize + frameDataLength);
  const isLast = rawData.subarray(-1);
  console.log("frameDataLength: ", frameDataLength);
  console.log("channelId: ", ethers.utils.hexlify(channelId));
  console.log("frameNumber: ", ethers.utils.hexlify(frameNumber));
  //console.log("frameData: ", ethers.utils.hexlify(frameData));
  console.log("isLast: ", ethers.utils.hexlify(isLast));

  // Decompress frameData
  const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frameData)).subarray(4);

  // Decode frameData
  //const decompressedFrame: Uint8Array = Uint8Array.from(unzipSync(frameData)).subarray(4);
  // [parent_hash, epoch_number, epoch_hash, timestamp, transaction_list])
  let res = RLP.decode(decompressedFrame, true);
  const decodedFrame: (Uint8Array | NestedUint8Array)[] = [];

  while (res.remainder !== undefined) {
    var a = res.data;
    decodedFrame.push(a);
    //res = RLP.decode(res.remainder as Input, true) as Decoded;
    res = RLP.decode(res.remainder, true);
  }
  return;
  
};
