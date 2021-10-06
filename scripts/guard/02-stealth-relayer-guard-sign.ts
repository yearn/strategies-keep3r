import { run, ethers } from 'hardhat';
import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk';
import SafeServiceClient from '@gnosis.pm/safe-service-client';
import { SafeTransactionData } from '@gnosis.pm/safe-core-sdk-types';

const { Confirm } = require('enquirer');
const { Input } = require('enquirer');
const confirmPrompt = new Confirm({ message: 'Do you wish to sign a gnosis safe txHash?' });
const inputPrompt = new Input({
  message: 'Paste txHash to sign',
  initial: '0x...',
});

import * as gnosis from '../../utils/gnosis';
import { ZERO_ADDRESS } from '@utils/web3-utils';
import { EthSignSignature } from '@gnosis.pm/safe-core-sdk/dist/src/utils/signatures/SafeSignature';

async function main() {
  await run('compile');
  await confirmPrompt.run().then(async () => {
    await mainExecute();
  });
}

function mainExecute(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [offchainSigner] = await ethers.getSigners();
    const networkName = 'rinkeby';
    console.log('using address:', offchainSigner.address, 'on', networkName);

    try {
      const safeAddress = '0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4';
      const safeContract = await ethers.getContractAt('GnosisSafe', safeAddress);
      const ethAdapterExecutor = new EthersAdapter({ ethers, signer: offchainSigner });
      const safeSdk: Safe = await Safe.create({ ethAdapter: ethAdapterExecutor, safeAddress });

      const safeService = new SafeServiceClient('https://safe-transaction.rinkeby.gnosis.io');
      const pendingTxsResponse = await safeService.getPendingTransactions(safeAddress);
      const pendingTxs = pendingTxsResponse.results;
      if (pendingTxs.length == 0) return;
      const tx = pendingTxs[0];
      // const tx: SafeMultisigTransactionResponse = await safeService.getTransaction(
      //   pendingTxs[0].safeTxHash
      // );

      // console.log(tx);

      // const signature = await gnosis.getEIP712Signature(offchainSigner, {
      //   baseGas: tx.baseGas.toString(),
      //   data: tx.data || '0x0',
      //   gasPrice: tx.gasPrice,
      //   gasToken: tx.gasToken,
      //   nonce: tx.nonce,
      //   operation: tx.operation,
      //   refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
      //   safeTxGas: tx.safeTxGas.toString(),
      //   to: tx.to,
      //   valueInWei: tx.value,
      //   safeAddress: tx.safe,
      //   networkId: (await safeSdk.getChainId()).toString(),
      // });

      // console.log('manual signature');
      // console.log(signature);

      const safeChainId = await safeSdk.getChainId();
      const txDetails: gnosis.SafeTransactionData = await gnosis.getTransaction(safeChainId, tx.safeTxHash);

      const transactions: SafeTransactionData[] = [
        {
          to: txDetails.txData.to.value,
          value: txDetails.txData.value,
          data: txDetails.txData.hexData || '0x00',
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
      await safeSdk.signTransaction(safeTransaction);
      console.log(safeTransaction.signatures.get(offchainSigner.address.toLowerCase()));

      // console.log('gnosis UI signature');
      // console.log(tx.confirmations?.find((confirmation) => confirmation.owner == offchainSigner.address)?.signature);

      resolve();
    } catch (err) {
      reject(`Error while signing gnosis safe txHash: ${(err as any).message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
