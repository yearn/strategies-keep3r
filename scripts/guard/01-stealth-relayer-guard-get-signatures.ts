import { run, ethers } from 'hardhat';
import * as gnosis from '../../utils/gnosis';
import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk';
import { EthSignSignature } from '@gnosis.pm/safe-core-sdk/dist/src/utils/signatures/SafeSignature';
import { SafeTransactionData } from '@gnosis.pm/safe-core-sdk-types';

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to get queued transactions signatures from safe?');

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const networkName = 'rinkeby';
    const safeAddress = '0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4';
    console.log('using address:', owner.address, 'on', networkName);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const ethAdapterExecutor = new EthersAdapter({ ethers: owner.provider, signer: owner });
          const safeSdk: Safe = await Safe.create({ ethAdapter: ethAdapterExecutor, safeAddress });

          const safeChainId = await safeSdk.getChainId();
          const safeNonce = await safeSdk.getNonce();
          console.log({ safeNonce });

          const safeQueuedTransactions: gnosis.SafeTransaction[] = await gnosis.getSafeQueuedTransactions(safeChainId, safeAddress);
          if (safeQueuedTransactions.length == 0) {
            console.log('no queued transactions');
            return;
          }
          for (const safeQueuedTransaction of safeQueuedTransactions) {
            if (safeQueuedTransaction.txStatus !== 'AWAITING_EXECUTION') {
              console.log(`invalid tx status: ${safeQueuedTransaction.txStatus}`);
              return;
            }
            console.log('safeQueuedTransaction');
            console.log(safeQueuedTransaction);
            const txHash = safeQueuedTransaction.id.split('_')[2];
            const txDetails: gnosis.SafeTransactionData = await gnosis.getTransaction(safeChainId, txHash);

            const transactions: SafeTransactionData[] = [
              {
                to: txDetails.txData.to.value,
                value: txDetails.txData.value,
                data: txDetails.txData.hexData,
                operation: txDetails.txData.operation,
                safeTxGas: Number(txDetails.detailedExecutionInfo.safeTxGas),
                baseGas: Number(txDetails.detailedExecutionInfo.baseGas),
                gasPrice: Number(txDetails.detailedExecutionInfo.gasPrice),
                gasToken: txDetails.detailedExecutionInfo.gasToken,
                refundReceiver: txDetails.detailedExecutionInfo.refundReceiver.value,
                nonce: txDetails.detailedExecutionInfo.nonce,
              },
            ];
            const safeTransaction = await safeSdk.createTransaction(...transactions);
            for (const confirmation of txDetails.detailedExecutionInfo.confirmations) {
              safeTransaction.addSignature(new EthSignSignature(confirmation.signer.value, confirmation.signature));
            }

            const executeTxResponse = await safeSdk.executeTransaction(safeTransaction);
            console.log(executeTxResponse);
            await executeTxResponse.transactionResponse?.wait();
            console.log('executed!');
          }

          resolve();
        } catch (err) {
          reject(`Error while getting signatures from safe: ${(err as any).message}`);
        }
      } else {
        console.error('Aborted!');
        resolve();
      }
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
