import { startOpL1BatchHandler } from './op-l1-batch-handler/exec';
import * as dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import args from './getClargs';
import { providers } from 'ethers';

const myEnv = dotenv.config();
dotenvExpand.expand(myEnv);

const main = async () => {
  if (!process.env.L1RPC) {
    throw new Error(`You need set l1 rpc in env in action: ${args.action}`);
  }
  switch (args.action) {
    case 'OpL1BatchHandler':
      if (!args.l1TxHash) {
        throw new Error('No l1TxHash! (You should add --l1TxHash)');
      }
      const provider = new providers.JsonRpcProvider(process.env.L1RPC);
      // yargs will read l1TxHash as number wrongly so we need add this convert.
      const txHash = args.l1TxHash?.toString();
      await startOpL1BatchHandler(txHash, provider);
      break;
    default:
      console.log(`Unknown action: ${args.action}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
