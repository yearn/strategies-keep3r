import { run, ethers } from 'hardhat';
import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk';
import SafeServiceClient, { SafeMultisigTransactionResponse } from '@gnosis.pm/safe-service-client';

const { Confirm } = require('enquirer');
const { Input } = require('enquirer');
const confirmPrompt = new Confirm({ message: 'Do you wish to sign a gnosis safe txHash?' });
const inputPrompt = new Input({
  message: 'Paste txHash to sign',
  initial: '0x...',
});

import * as gnosis from '../../utils/gnosis';
import { ZERO_ADDRESS } from '@utils/web3-utils';

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
      const tx: SafeMultisigTransactionResponse = await safeService.getTransaction(
        '0x254233efd244a9efb772fdd1ad4e7bc6092a3ffa1ee194433803941ff2560e77'
      );

      console.log(tx);

      const signature = await gnosis.getEIP712Signature(offchainSigner, {
        baseGas: tx.baseGas.toString(),
        data: tx.data || '0x0',
        gasPrice: tx.gasPrice,
        gasToken: tx.gasToken,
        nonce: tx.nonce,
        operation: tx.operation,
        refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
        safeTxGas: tx.safeTxGas.toString(),
        to: tx.to,
        valueInWei: tx.value,
        safeAddress: tx.safe,
        networkId: (await safeSdk.getChainId()).toString(),
      });

      console.log(signature);
      console.log(ethers.utils.hashMessage(signature));

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
