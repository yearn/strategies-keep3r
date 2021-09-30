import { ContractFactory } from 'ethers';
import { run, ethers } from 'hardhat';
import * as contracts from '../../utils/contracts';

const { Confirm } = require('enquirer');
const prompt = new Confirm('Do you wish to stealthRelayerGuard contracts?');

async function main() {
  await run('compile');
  await promptAndSubmit();
}

function promptAndSubmit(): Promise<void | Error> {
  return new Promise(async (resolve, reject) => {
    const [owner] = await ethers.getSigners();
    const networkName = 'rinkeby';
    const safe = '0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4';
    console.log('using address:', owner.address, 'on', networkName);
    prompt.run().then(async (answer: any) => {
      if (answer) {
        try {
          const StealthRelayerGuard: ContractFactory = await ethers.getContractFactory('StealthRelayerGuard');

          console.log('StealthRelayerGuard:', safe, contracts.stealthRelayer[networkName]);
          const stealthRelayerGuard = await StealthRelayerGuard.deploy(safe, contracts.stealthRelayer[networkName]);
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
