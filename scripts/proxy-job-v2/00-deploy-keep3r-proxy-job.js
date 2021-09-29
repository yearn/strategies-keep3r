const { Confirm } = require('enquirer');
const hre = require('hardhat');
const ethers = hre.ethers;
const config = require('../../.config.json');
const escrowContracts = config.contracts.mainnet.escrow;
const mechanicsContracts = config.contracts.mainnet.mechanics;

const { e18, ZERO_ADDRESS } = require('../../utils/web3-utils');

const prompt = new Confirm({
  message: 'Do you wish to deploy Keep3rProxyJobV2 contract?',
});

async function main() {
  await hre.run('compile');
  const Keep3rProxyJobV2 = await ethers.getContractFactory('Keep3rProxyJobV2');

  await promptAndSubmit(Keep3rProxyJobV2);
}

function promptAndSubmit(Keep3rProxyJobV2) {
  return new Promise(async (resolve) => {
    const [owner] = await ethers.getSigners();
    console.log('using address:', owner.address);
    try {
      prompt.run().then(async (answer) => {
        if (answer) {
          console.time('Keep3rProxyJobV2 deployed');
          // Setup Keep3rProxyJobV2
          console.log(
            mechanicsContracts.registry,
            escrowContracts.keep3r,
            ZERO_ADDRESS, // // KP3R bond
            e18.mul('50').toString(), // 50 KP3Rs bond requirement
            0,
            0,
            true
          );
          const keep3rProxyJobV2 = await Keep3rProxyJobV2.deploy(
            mechanicsContracts.registry,
            escrowContracts.keep3r,
            ZERO_ADDRESS, // // KP3R bond
            e18.mul('50'), // 50 KP3Rs bond requirement
            0,
            0,
            true
          );
          console.timeEnd('Keep3rProxyJobV2 deployed');
          console.log('Keep3rProxyJobV2 address:', keep3rProxyJobV2.address);
          console.log('PLEASE: change .config.json & example.config.json proxyJobV2 address to:', keep3rProxyJobV2.address);
          resolve();
        } else {
          console.error('Aborted!');
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
