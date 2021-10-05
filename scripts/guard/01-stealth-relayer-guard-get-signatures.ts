import { run, ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk';
import { EthSignSignature } from '@gnosis.pm/safe-core-sdk/dist/src/utils/signatures/SafeSignature';
import { SafeTransactionData } from '@gnosis.pm/safe-core-sdk-types';
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
  FlashbotsTransaction,
  FlashbotsTransactionResponse,
  SimulationResponse,
} from '@flashbots/ethers-provider-bundle';

import { gwei } from '../../utils/web3-utils';
import { makeid } from '../../utils/hash';
import * as gnosis from '../../utils/gnosis';
import * as contracts from '../../utils/contracts';
import { Provider } from '@ethersproject/abstract-provider';

const { Confirm } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to get queued transactions signatures from safe?' });

async function main() {
  await run('compile');
  await prompt.run().then(async () => {
    await mainExecute();
  });
}

function mainExecute(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [executor] = await ethers.getSigners();
    const networkName = 'rinkeby';
    const safeAddress = '0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4';
    console.log('using address:', executor.address, 'on', networkName);

    try {
      let executorNonce = ethers.BigNumber.from(await executor.getTransactionCount());

      const safeContract = await ethers.getContractAt('GnosisSafe', safeAddress);
      const ethAdapterExecutor = new EthersAdapter({ ethers: executor.provider, signer: executor });
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
          continue;
        }
        const txDetails: gnosis.SafeTransactionData = await gnosis.getTransaction(safeChainId, safeQueuedTransaction.id);
        console.log(txDetails);

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
        for (const confirmation of txDetails.detailedExecutionInfo.confirmations) {
          safeTransaction.addSignature(new EthSignSignature(confirmation.signer.value, confirmation.signature));
        }

        // stealth-txs
        const rawSafeTx = await safeContract.populateTransaction.execTransaction(
          safeTransaction.data.to, // address to,
          safeTransaction.data.value, // uint256 value,
          safeTransaction.data.data, // bytes calldata data,
          safeTransaction.data.operation, // uint8 operation,
          safeTransaction.data.safeTxGas, // uint256 safeTxGas,
          safeTransaction.data.baseGas, // uint256 dataGas,
          safeTransaction.data.gasPrice, // uint256 gasPrice,
          safeTransaction.data.gasToken, // address gasToken,
          safeTransaction.data.refundReceiver, // address refundReceiver,
          safeTransaction.encodedSignatures() // bytes calldata signatures
        );

        const stealthHash = ethers.utils.solidityKeccak256(['string'], [makeid(32)]);
        const provider: Provider = executor.provider as Provider;

        const stealthRelayer = await ethers.getContractAt('IStealthRelayer', contracts.stealthRelayer[networkName]);
        const pendingBlock = await provider.getBlock('latest');
        const blockGasLimit = BigNumber.from(pendingBlock.gasLimit);

        if (safeChainId != 1) {
          console.log('not on mainnet, do not use flashbots');

          const staticResult = await stealthRelayer.callStatic.executeWithoutBlockProtection(
            rawSafeTx.to, // address _job,
            rawSafeTx.data, // bytes memory _callData,
            stealthHash // bytes32 _stealthHash,
          );
          console.log({ staticResult });
          const result = await stealthRelayer.executeWithoutBlockProtection(
            rawSafeTx.to, // address _job,
            rawSafeTx.data, // bytes memory _callData,
            stealthHash // bytes32 _stealthHash,
          );
          console.log({ result });
        } else {
          // mainnet
          const gasPriceResponse = await gnosis.getGasPrice();
          const gasPrice = ethers.BigNumber.from(gasPriceResponse.fast);
          const maxGwei = 150;
          if (gasPrice.gt(gwei.mul(maxGwei))) {
            reject(`gas price > ${maxGwei}gwei`);
          }

          const blockNumber = await provider.getBlockNumber();
          const targetBlockNumber = blockNumber + 2;
          const fairGasPrice = gasPrice.mul(100 + 5).div(100); // + 5%
          console.log('fairGasPrice in gwei:', fairGasPrice.div(gwei).toNumber());

          const executeTx = await stealthRelayer.populateTransaction.execute(
            rawSafeTx.to, // address _job,
            rawSafeTx.data, // bytes memory _callData,
            stealthHash, // bytes32 _stealthHash,
            targetBlockNumber, // uint256 _blockNumber
            {
              nonce: executorNonce,
              gasPrice: fairGasPrice,
              gasLimit: blockGasLimit.sub(5_000),
            }
          );

          // flashbots
          const signer = new ethers.Wallet(process.env[`${networkName.toUpperCase()}_PRIVATE_KEY`] as string).connect(ethers.provider);
          const flashbotSigner = new ethers.Wallet(process.env.FLASHBOTS_PRIVATE_KEY as string).connect(ethers.provider);
          const flashbotsProvider = await FlashbotsBundleProvider.create(ethers.provider, flashbotSigner);
          const signedTransaction = await signer.signTransaction(executeTx);

          const bundle = [
            {
              signedTransaction,
            },
          ];
          const signedBundle = await flashbotsProvider.signBundle(bundle);
          let simulation: SimulationResponse;
          try {
            simulation = await flashbotsProvider.simulate(signedBundle, blockNumber + 1);
          } catch (error: any) {
            if ('body' in error && 'message' in JSON.parse(error.body).error) {
              console.log('[Simulation Error] Message:', JSON.parse(error.body).error.message);
            } else {
              console.log(error);
            }
            return reject('simulation error');
          }
          if ('error' in simulation) {
            return reject(`Simulation Error: ${simulation.error.message}`);
          } else {
            console.log(`Simulation Success: ${JSON.stringify(simulation, null, 2)}`);
          }
          console.log(simulation);

          // NOTE: here you can rebalance payment using (results[0].gasPrice * gasUsed) + a % as miner bonus

          // send bundle
          const flashbotsTransactionResponse: FlashbotsTransaction = await flashbotsProvider.sendBundle(bundle, blockNumber + 1);

          const resolution = await (flashbotsTransactionResponse as FlashbotsTransactionResponse).wait();

          if (resolution == FlashbotsBundleResolution.BundleIncluded) {
            console.log('BundleIncluded, sucess!');
            return resolve();
          }
          if (resolution == FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log('BlockPassedWithoutInclusion, re-build and re-send bundle...');
            return await mainExecute();
          }
          if (resolution == FlashbotsBundleResolution.AccountNonceTooHigh) {
            return reject('AccountNonceTooHigh, adjust nonce');
          }
        }

        // const executeTxResponse = await safeSdk.executeTransaction(safeTransaction);
        // console.log(executeTxResponse);
        // await executeTxResponse.transactionResponse?.wait();
        // console.log('executed!');
      }

      resolve();
    } catch (err) {
      reject(`Error while getting signatures from safe: ${(err as any).message}`);
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    0x0000000031669ab4083265e0850030fa8dec8daf;
    console.error(error);
    process.exit(1);
  });
