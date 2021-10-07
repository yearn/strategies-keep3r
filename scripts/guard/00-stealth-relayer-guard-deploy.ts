import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import * as contracts from '../../utils/contracts';

const { Confirm } = require('enquirer');
const { Input } = require('enquirer');
const prompt = new Confirm({ message: 'Do you wish to stealthRelayerGuard contracts?' });
const safeInputPrompt = new Input({
  message: 'Paste gnosis safe address',
  initial: '0x...',
});

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const networkName = 'rinkeby';
    console.log('using address:', owner.address, 'on', networkName);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const safeAddress = await safeInputPrompt.run();
          if (safeAddress.length != 42) throw Error('invalid safeAddress length');
          const StealthRelayerGuard: ContractFactory = await ethers.getContractFactory('StealthRelayerGuard');

          console.log('StealthRelayerGuard:', safeAddress, contracts.stealthRelayer[networkName]);
          const stealthRelayerGuard = await StealthRelayerGuard.deploy(safeAddress, contracts.stealthRelayer[networkName]);
          console.log('StealthRelayerGuard address:', stealthRelayerGuard.address);
          console.log(`PLEASE: change utils/contracts.ts stealthRelayerGuard ${networkName} address to: ${stealthRelayerGuard.address}`);
          console.log();

          resolve();
        } catch (err) {
          reject(`Error while deploying v2 keep3r job contracts: ${(err as any).message}`);
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
